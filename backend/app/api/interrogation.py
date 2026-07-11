"""Suspect interrogation. POST streams the reply as Server-Sent Events:

  event: token   -> {"text": "..."}          (chunks of the suspect's line)
  event: meta    -> full message record       (emotion, trust/patience, etc.)
  event: error   -> {"detail": "..."}

The full Gemini response is generated first (we need validated JSON), then the
text is streamed in small chunks for the typing effect.
"""

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.deps import load_case, load_investigation, oid
from app.core.auth import AuthUser, get_current_user
from app.core.db import get_db
from app.models.investigation import InterrogationMessage, SuspectState
from app.services import gemini

router = APIRouter(prefix="/api/investigations/{investigation_id}/suspects", tags=["interrogation"])

CHUNK_SIZE = 12  # characters per SSE token event


class PlayerMessage(BaseModel):
    content: str
    input_type: str = "text"  # text | voice
    evidence_id: str | None = None


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def _public_message(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id", ""))
    doc.pop("user_id", None)
    doc["created_at"] = doc["created_at"].isoformat()
    return doc


@router.get("/{suspect_id}/messages")
async def get_messages(
    investigation_id: str, suspect_id: str, user: AuthUser = Depends(get_current_user)
):
    await load_investigation(investigation_id, user)
    messages = []
    async for doc in (
        get_db()
        .interrogations.find({"investigation_id": investigation_id, "suspect_id": suspect_id})
        .sort("created_at", 1)
    ):
        messages.append(_public_message(doc))
    return messages


@router.post("/{suspect_id}/messages")
async def send_message(
    investigation_id: str,
    suspect_id: str,
    body: PlayerMessage,
    user: AuthUser = Depends(get_current_user),
):
    inv = await load_investigation(investigation_id, user)
    if inv["status"] != "in_progress":
        raise HTTPException(status_code=409, detail="Investigation is closed")

    _, case = await load_case(inv["case_id"])
    suspect = case.suspect(suspect_id)
    if not suspect:
        raise HTTPException(status_code=404, detail="Suspect not found")

    state = SuspectState(**inv["suspect_state"].get(suspect_id, {}))
    if state.conversation_ended:
        raise HTTPException(status_code=409, detail=f"{suspect.name} refuses to speak with you again.")

    presented = None
    if body.evidence_id:
        item = case.evidence_item(body.evidence_id)
        if not item:
            raise HTTPException(status_code=404, detail="Evidence not found")
        presented = {"title": item.title, "description": item.description}

    history = []
    async for doc in (
        get_db()
        .interrogations.find({"investigation_id": investigation_id, "suspect_id": suspect_id})
        .sort("created_at", 1)
    ):
        history.append({"player_message": doc["player_message"], "response": doc["response"]})

    async def event_stream():
        try:
            reply = await gemini.suspect_reply(
                case, suspect, state, history, body.content, presented
            )
        except HTTPException as exc:
            yield _sse("error", {"detail": exc.detail})
            return
        except Exception:
            yield _sse("error", {"detail": "The suspect stares at you in silence. (LLM error — try again.)"})
            return

        trust_after = max(0, min(100, state.trust + reply.trust_change))
        patience_after = max(0, min(100, state.patience + reply.patience_change))
        ended = reply.conversation_ended or patience_after == 0

        record = InterrogationMessage(
            investigation_id=investigation_id,
            user_id=user.id,
            suspect_id=suspect_id,
            player_message=body.content,
            input_type=body.input_type,
            evidence_id=body.evidence_id,
            response=reply.response,
            emotion=reply.emotion,
            emotion_intensity=reply.emotion_intensity,
            delivery=reply.delivery,
            trust_before=state.trust,
            trust_after=trust_after,
            patience_before=state.patience,
            patience_after=patience_after,
            conversation_ended=ended,
        )
        result = await get_db().interrogations.insert_one(record.model_dump())
        await get_db().investigations.update_one(
            {"_id": oid(investigation_id)},
            {
                "$set": {
                    f"suspect_state.{suspect_id}": SuspectState(
                        trust=trust_after, patience=patience_after, conversation_ended=ended
                    ).model_dump()
                }
            },
        )

        text = reply.response
        for i in range(0, len(text), CHUNK_SIZE):
            yield _sse("token", {"text": text[i : i + CHUNK_SIZE]})
            await asyncio.sleep(0.02)

        doc = record.model_dump()
        doc["_id"] = result.inserted_id
        doc["created_at"] = record.created_at
        yield _sse("meta", _public_message(doc))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
