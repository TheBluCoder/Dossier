import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import audio, cases, interrogation, investigations, users, verdict
from app.core.config import get_settings
from app.core.db import close_db
from app.services.seed import seed_demo_case

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await seed_demo_case()
    except Exception:
        logger.exception("Demo case seeding failed (continuing without it)")
    yield
    await close_db()


app = FastAPI(title="Detective K — Investigator Game API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cases.router)
app.include_router(investigations.router)
app.include_router(interrogation.router)
app.include_router(verdict.router)
app.include_router(audio.router)
app.include_router(users.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
