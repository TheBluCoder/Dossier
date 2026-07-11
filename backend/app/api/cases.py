from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.api.deps import load_case
from app.core.auth import AuthUser, get_current_user
from app.core.db import get_db
from app.models.case import Case
from app.services import gemini, sanitize

router = APIRouter(prefix="/api/cases", tags=["cases"])


class GenerateRequest(BaseModel):
    crime_type: str = "murder"


@router.get("")
async def list_cases(user: AuthUser = Depends(get_current_user)):
    cases = []
    async for doc in get_db().cases.find().sort("_id", -1).limit(20):
        case_id = str(doc.pop("_id"))
        cases.append(sanitize.public_case_summary(case_id, Case(**doc)))
    return cases


@router.post("/generate", status_code=201)
async def generate_case(body: GenerateRequest, user: AuthUser = Depends(get_current_user)):
    case = await gemini.generate_case(body.crime_type)
    result = await get_db().cases.insert_one(case.model_dump())
    return sanitize.public_case_summary(str(result.inserted_id), case)


@router.get("/{case_id}")
async def get_case_briefing(case_id: str, user: AuthUser = Depends(get_current_user)):
    doc_id, case = await load_case(case_id)
    return sanitize.public_case_briefing(doc_id, case)
