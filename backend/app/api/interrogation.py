"""Suspect interrogation. POST streams the reply as Server-Sent Events:

  event: token   -> {"text": "..."}          (chunks of the suspect's line)
  event: meta    -> full message record       (emotion, trust/patience, etc.)
  event: error   -> {"detail": "..."}

Tokens are streamed live from Gemini while the reply is still generating; the
validated full message is persisted and sent as the final `meta` event. A leak
guard swaps in an in-character deflection if the reply ever contains
system-prompt markers, so no meta content reaches the player.
"""

import asyncio
import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.api.deps import load_case, load_investigation, oid, recent_history
from app.core.auth import AuthUser, get_current_user
from app.core.config import get_settings
from app.core.db import get_db
from app.core.messages import ErrorMessages
from app.core.ratelimit import check_rate_limit
from app.models.investigation import InterrogationMessage, SuspectState
from app.services import gemini

router = APIRouter(prefix="/api/investigations/{investigation_id}/suspects", tags=["interrogation"])

MESSAGES_PER_MINUTE = 20  # each message is a Gemini call — cap the burn rate
SUSPECT_COOLDOWN = timedelta(minutes=3)  # walking out on a suspect keeps them off-limits a while


def _naive_utcnow() -> datetime:
    # suspect_state round-trips through Mongo, which strips tzinfo on read —
    # comparisons against cooldown_until must stay naive on both sides.
    return datetime.now(timezone.utc).replace(tzinfo=None)


class PlayerMessage(BaseModel):
    content: str = Field(max_length=1000)
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


@router.post("/{suspect_id}/leave")
async def leave_suspect(
    investigation_id: str, suspect_id: str, user: AuthUser = Depends(get_current_user)
):
    """Called when the player walks out of the interrogation room. Starts a
    cooldown before this suspect can be questioned again — no benefit to
    hopping in and out of the room to dodge a bad patience swing."""
    inv = await load_investigation(investigation_id, user)
    _, case = await load_case(inv["case_id"])
    suspect = case.suspect(suspect_id)
    if not suspect:
        raise HTTPException(status_code=404, detail=ErrorMessages.SUSPECT_NOT_FOUND)

    state = SuspectState(**inv["suspect_state"].get(suspect_id, {}))
    if state.conversation_ended:
        return {"cooldown_until": None}

    cooldown_until = _naive_utcnow() + SUSPECT_COOLDOWN
    await get_db().investigations.update_one(
        {"_id": oid(investigation_id)},
        {"$set": {f"suspect_state.{suspect_id}.cooldown_until": cooldown_until}},
    )
    return {"cooldown_until": cooldown_until.isoformat()}


@router.post("/{suspect_id}/messages")
async def send_message(
    investigation_id: str,
    suspect_id: str,
    body: PlayerMessage,
    user: AuthUser = Depends(get_current_user),
):
    check_rate_limit(f"msg:{user.id}", MESSAGES_PER_MINUTE)
    inv = await load_investigation(investigation_id, user)
    if inv["status"] != "in_progress":
        raise HTTPException(status_code=409, detail=ErrorMessages.INVESTIGATION_CLOSED)

    _, case = await load_case(inv["case_id"])
    suspect = case.suspect(suspect_id)
    if not suspect:
        raise HTTPException(status_code=404, detail=ErrorMessages.SUSPECT_NOT_FOUND)

    state = SuspectState(**inv["suspect_state"].get(suspect_id, {}))
    if state.conversation_ended:
        raise HTTPException(status_code=409, detail=ErrorMessages.suspect_refuses(suspect.name))
    if state.cooldown_until and state.cooldown_until > _naive_utcnow():
        remaining = int((state.cooldown_until - _naive_utcnow()).total_seconds())
        raise HTTPException(
            status_code=429, detail=ErrorMessages.suspect_cooling_down(suspect.name, remaining)
        )

    presented = None
    if body.evidence_id:
        item = case.evidence_item(body.evidence_id)
        if not item:
            raise HTTPException(status_code=404, detail=ErrorMessages.EVIDENCE_NOT_FOUND)
        presented = {"title": item.title, "description": item.description}

    history = await recent_history(
        investigation_id, suspect_id, get_settings().max_history_messages
    )

    async def event_stream():
        released = ""
        reply = None
        leaked = False
        try:
            stream = gemini.suspect_reply_stream(
                case, suspect, state, history, body.content, presented
            )
            async for kind, payload in stream:
                if kind == "token":
                    # Stop releasing text the moment a system-prompt marker
                    # appears — the stored reply becomes a deflection below.
                    if leaked:
                        continue
                    if gemini.contains_meta_leak(released + payload):
                        leaked = True
                        continue
                    released += payload
                    yield _sse("token", {"text": payload})
                else:
                    reply = payload
        except HTTPException as exc:
            yield _sse("error", {"detail": exc.detail})
            return
        except Exception:
            yield _sse("error", {"detail": ErrorMessages.SUSPECT_RESPONSE_UNAVAILABLE})
            return

        if reply is None or leaked or gemini.contains_meta_leak(reply.response):
            reply = gemini.deflection_reply()

        trust_after = max(0, min(100, state.trust + reply.trust_change))
        patience_after = max(0, min(100, state.patience + reply.patience_change))
        # Patience hitting 0 is a precondition, never a trigger on its own — the
        # suspect (model) still has to actually choose to end it (see
        # prompts.SUSPECT_SYSTEM). A patience_change that reaches 0 does not by
        # itself end the conversation.
        ended = patience_after == 0 and reply.conversation_ended

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
        db = get_db()
        insert_result, _ = await asyncio.gather(
            db.interrogations.insert_one(record.model_dump()),
            db.investigations.update_one(
                {"_id": oid(investigation_id)},
                {
                    "$set": {
                        f"suspect_state.{suspect_id}": SuspectState(
                            trust=trust_after, patience=patience_after, conversation_ended=ended
                        ).model_dump()
                    }
                },
            ),
        )

        doc = record.model_dump()
        doc["_id"] = insert_result.inserted_id
        doc["created_at"] = record.created_at
        yield _sse("meta", _public_message(doc))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
