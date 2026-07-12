from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import invalidate_case, load_case, load_investigation, oid
from app.core.auth import AuthUser, get_current_user
from app.core.db import get_db
from app.core.messages import ErrorMessages
from app.models.investigation import Verdict
from app.services import gemini, sanitize
from app.services.case_pool import kick_case_pool
from app.services.profiles import apply_verdict_result

router = APIRouter(prefix="/api/investigations/{investigation_id}", tags=["verdict"])


@router.post("/verdict")
async def submit_verdict(
    investigation_id: str, body: Verdict, user: AuthUser = Depends(get_current_user)
):
    inv = await load_investigation(investigation_id, user)
    if inv.get("verdict"):
        raise HTTPException(status_code=409, detail=ErrorMessages.VERDICT_ALREADY_SUBMITTED)

    _, case = await load_case(inv["case_id"])
    if not case.suspect(body.accused_id):
        raise HTTPException(status_code=404, detail=ErrorMessages.ACCUSED_SUSPECT_NOT_FOUND)

    # Correctness is decided by the backend, never by the LLM.
    correct = body.accused_id == case.solution.culprit_id
    analysis = await gemini.analyze_verdict(
        case, body.accused_id, correct, body.motive, body.explanation
    )

    verdict_doc = {
        **body.model_dump(),
        "correct": correct,
        "analysis": analysis,
        "submitted_at": datetime.now(timezone.utc),
    }
    await get_db().investigations.update_one(
        {"_id": oid(investigation_id)},
        {
            "$set": {
                "verdict": verdict_doc,
                "status": "solved" if correct else "failed",
                "completed_at": datetime.now(timezone.utc),
            }
        },
    )
    reputation_change = await apply_verdict_result(user.id, correct, case.difficulty)

    # The case was already pulled from the docket the moment this investigation
    # was created (see investigations.py). A verdict — right or wrong — just
    # finalizes it: the resolution reveals the culprit, so it's never handed
    # to another player either way. failure_count is kept only as a stat.
    await get_db().cases.update_one(
        {"_id": oid(inv["case_id"])},
        {
            "$set": {"status": "solved" if correct else "archived"},
            **({} if correct else {"$inc": {"failure_count": 1}}),
        },
    )
    kick_case_pool()
    invalidate_case(inv["case_id"])

    return {**sanitize.resolution(case, verdict_doc), "reputation_change": reputation_change}


@router.get("/resolution")
async def get_resolution(investigation_id: str, user: AuthUser = Depends(get_current_user)):
    inv = await load_investigation(investigation_id, user)
    if not inv.get("verdict"):
        raise HTTPException(status_code=403, detail=ErrorMessages.VERDICT_REQUIRED)
    _, case = await load_case(inv["case_id"])
    return sanitize.resolution(case, inv["verdict"])
