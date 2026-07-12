"""The ONLY path case data may take to the frontend before resolution.

Never return raw case documents from an endpoint — strip private fields here.
"""

from typing import Any

from app.models.case import Case, Suspect
from app.models.user import reputation_delta
from app.services.voice import voice_for_suspect


def public_suspect(suspect: Suspect) -> dict[str, Any]:
    data = suspect.model_dump()
    data.pop("private", None)
    data["voice_id"] = voice_for_suspect(suspect)
    return data


def public_case_summary(case_id: str, case: Case) -> dict[str, Any]:
    return {
        "id": case_id,
        "title": case.title,
        "crime_type": case.crime_type,
        "difficulty": case.difficulty,
        "summary": case.summary,
        "status": case.status,
        "suspect_count": len(case.suspects),
        "evidence_count": len(case.evidence),
        "failure_count": case.failure_count,
        "reward_rs": reputation_delta(True, case.difficulty),
    }


def public_case_briefing(case_id: str, case: Case) -> dict[str, Any]:
    return {
        "id": case_id,
        "title": case.title,
        "crime_type": case.crime_type,
        "difficulty": case.difficulty,
        "summary": case.summary,
        "status": case.status,
        "victim": case.victim.model_dump(),
        "crime_scene": case.crime_scene.model_dump(),
        "public_timeline": [t.model_dump() for t in case.public_timeline],
        "suspects": [public_suspect(s) for s in case.suspects],
        "evidence": [e.model_dump(exclude={"canonical_facts"}) for e in case.evidence],
    }


def resolution(case: Case, verdict: dict) -> dict[str, Any]:
    """Full reveal — only served AFTER a verdict has been submitted."""
    culprit = case.suspect(case.solution.culprit_id)
    return {
        "correct": verdict["correct"],
        "accused_id": verdict["accused_id"],
        "analysis": verdict.get("analysis", ""),
        "culprit": public_suspect(culprit) if culprit else None,
        "motive": case.solution.motive,
        "explanation": case.solution.explanation,
        "canonical_timeline": [t.model_dump() for t in case.canonical_timeline],
        "suspect_secrets": case.solution.suspect_secrets,
        "key_clues": case.solution.key_clues,
    }
