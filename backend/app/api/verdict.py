from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.api.deps import load_case, load_investigation, oid
from app.core.auth import AuthUser, get_current_user
from app.core.db import get_db
from app.models.investigation import Verdict
from app.services import gemini, sanitize

router = APIRouter(prefix="/api/investigations/{investigation_id}", tags=["verdict"])


@router.post("/verdict")
async def submit_verdict(
    investigation_id: str, body: Verdict, user: AuthUser = Depends(get_current_user)
):
    inv = await load_investigation(investigation_id, user)
    if inv.get("verdict"):
        raise HTTPException(status_code=409, detail="Verdict already submitted")

    _, case = await load_case(inv["case_id"])
    if not case.suspect(body.accused_id):
        raise HTTPException(status_code=404, detail="Accused suspect not found")

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
    return sanitize.resolution(case, verdict_doc)


@router.get("/resolution")
async def get_resolution(investigation_id: str, user: AuthUser = Depends(get_current_user)):
    inv = await load_investigation(investigation_id, user)
    if not inv.get("verdict"):
        raise HTTPException(status_code=403, detail="Submit a verdict first")
    _, case = await load_case(inv["case_id"])
    return sanitize.resolution(case, inv["verdict"])
