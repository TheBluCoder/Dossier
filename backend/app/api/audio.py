from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from app.core.auth import AuthUser, get_current_user
from app.services import voice

router = APIRouter(prefix="/api/audio", tags=["audio"])


class SynthesizeRequest(BaseModel):
    text: str = Field(max_length=1000)
    voice_id: str | None = None


@router.post("/synthesize")
async def synthesize(body: SynthesizeRequest, user: AuthUser = Depends(get_current_user)):
    audio = await voice.synthesize(body.text, body.voice_id)
    return Response(content=audio, media_type="audio/mpeg")
