from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.deps import invalidate_case, load_case, load_investigation, oid
from app.core.auth import AuthUser, get_current_user
from app.core.db import get_db
from app.core.messages import ErrorMessages
from app.models.investigation import Investigation, SuspectState
from app.services import sanitize
from app.services.case_pool import kick_case_pool

router = APIRouter(prefix="/api/investigations", tags=["investigations"])

# A resolved verdict reveals the culprit, so a case is retired the moment
# someone starts it rather than left open for others to also attempt. Each
# player is capped on concurrently open (unresolved) investigations so the
# claim mechanic can't be used to hoard cases indefinitely.
MAX_ACTIVE_INVESTIGATIONS = 3


class CreateInvestigation(BaseModel):
    case_id: str


class NotesUpdate(BaseModel):
    notes: str = Field(max_length=50_000)


def _public_investigation(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "case_id": doc["case_id"],
        "status": doc["status"],
        "notes": doc["notes"],
        "reviewed_evidence": doc["reviewed_evidence"],
        "suspect_state": doc["suspect_state"],
        "verdict_submitted": doc.get("verdict") is not None,
        "created_at": doc["created_at"].isoformat(),
    }


@router.post("", status_code=201)
async def create_investigation(body: CreateInvestigation, user: AuthUser = Depends(get_current_user)):
    case_id, case = await load_case(body.case_id)

    # Resuming an already-claimed-by-me case is always fine, regardless of cap.
    existing = await get_db().investigations.find_one(
        {"user_id": user.id, "case_id": case_id, "status": "in_progress"}
    )
    if existing:
        return _public_investigation(existing)

    active_count = await get_db().investigations.count_documents(
        {"user_id": user.id, "status": "in_progress"}
    )
    if active_count >= MAX_ACTIVE_INVESTIGATIONS:
        raise HTTPException(status_code=409, detail=ErrorMessages.MAX_ACTIVE_INVESTIGATIONS_REACHED)

    # Atomically claim the case — first player to hit this wins; everyone
    # else (including a second click from a slow connection) gets a clean
    # "already claimed" instead of two people investigating the same case.
    claimed = await get_db().cases.find_one_and_update(
        {"_id": oid(case_id), "status": "available"}, {"$set": {"status": "in_progress"}}
    )
    if not claimed:
        raise HTTPException(status_code=409, detail=ErrorMessages.CASE_ALREADY_CLAIMED)
    invalidate_case(case_id)

    investigation = Investigation(
        user_id=user.id,
        case_id=case_id,
        suspect_state={s.id: SuspectState() for s in case.suspects},
    )
    result = await get_db().investigations.insert_one(investigation.model_dump())
    doc = await get_db().investigations.find_one({"_id": result.inserted_id})
    kick_case_pool()  # the docket just lost a case — start topping it up now, not on next poll
    return _public_investigation(doc)


@router.get("/active")
async def list_active_investigations(user: AuthUser = Depends(get_current_user)):
    """The player's own in-progress investigations, for a 'continue investigating'
    dashboard rail — each carries its case summary so the frontend doesn't need
    a second round trip per card."""
    results = []
    async for doc in (
        get_db()
        .investigations.find({"user_id": user.id, "status": "in_progress"})
        .sort("created_at", -1)
    ):
        case_id, case = await load_case(doc["case_id"])
        results.append(
            {**_public_investigation(doc), "case_summary": sanitize.public_case_summary(case_id, case)}
        )
    return results


@router.get("/{investigation_id}")
async def get_investigation(investigation_id: str, user: AuthUser = Depends(get_current_user)):
    doc = await load_investigation(investigation_id, user)
    case_id, case = await load_case(doc["case_id"])
    return {
        **_public_investigation(doc),
        "case": sanitize.public_case_briefing(case_id, case),
    }


@router.put("/{investigation_id}/notes")
async def update_notes(
    investigation_id: str, body: NotesUpdate, user: AuthUser = Depends(get_current_user)
):
    await load_investigation(investigation_id, user)
    await get_db().investigations.update_one(
        {"_id": oid(investigation_id)}, {"$set": {"notes": body.notes}}
    )
    return {"ok": True}


@router.get("/{investigation_id}/suspects")
async def list_suspects(investigation_id: str, user: AuthUser = Depends(get_current_user)):
    doc = await load_investigation(investigation_id, user)
    _, case = await load_case(doc["case_id"])
    return [
        {**sanitize.public_suspect(s), "state": doc["suspect_state"].get(s.id, {})}
        for s in case.suspects
    ]


@router.get("/{investigation_id}/evidence")
async def list_evidence(investigation_id: str, user: AuthUser = Depends(get_current_user)):
    doc = await load_investigation(investigation_id, user)
    _, case = await load_case(doc["case_id"])
    reviewed = set(doc["reviewed_evidence"])
    return [
        {**e.model_dump(exclude={"canonical_facts"}), "reviewed": e.id in reviewed}
        for e in case.evidence
    ]


@router.post("/{investigation_id}/evidence/{evidence_id}/review")
async def mark_evidence_reviewed(
    investigation_id: str, evidence_id: str, user: AuthUser = Depends(get_current_user)
):
    doc = await load_investigation(investigation_id, user)
    _, case = await load_case(doc["case_id"])
    if not case.evidence_item(evidence_id):
        raise HTTPException(status_code=404, detail=ErrorMessages.EVIDENCE_NOT_FOUND)
    await get_db().investigations.update_one(
        {"_id": oid(investigation_id)}, {"$addToSet": {"reviewed_evidence": evidence_id}}
    )
    return {"ok": True}
