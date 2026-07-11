# CLAUDE.md

Guidance for Claude Code (claude.ai/code) when working in this repository.

## Project Overview

**Detective K — Investigator Game** is a single-player, browser-based AI
detective game built as a hackathon MVP (cuHacking). Players pick a case from a
commission dashboard, read the briefing, review evidence, interrogate
Gemini-powered suspect agents by text or voice, and submit a final accusation.

This is a stripped-down rewrite of the larger Detective K Telegram Mini App
(separate repo, Vue + Supabase). **Do not** port features from that project:
no multiplayer, reputation, credits, payments, Telegram integration, retry
cooldowns, leaderboards — and **no 3D crime scene** (evidence is text/media
cards only). See `docs/GDD.md` §11 for the full out-of-scope list.

**Stack:** React 19 + TypeScript + Vite + Tailwind v4 (frontend) · FastAPI,
Python 3.12 (backend) · MongoDB (Motor) · Gemini API (`google-genai`) ·
ElevenLabs TTS · Clerk (optional Google Sign-In).

## Commands

```bash
# Everything (recommended) — Mongo + backend + frontend with hot reload
docker compose up --build
docker compose down            # add -v to also wipe Mongo data

# Frontend only (frontend/)
pnpm install
pnpm dev                       # Vite dev server on :5173
pnpm type-check                # tsc -b
pnpm build                     # type-check + production build

# Backend only (backend/)
pip install -r requirements.txt
uvicorn app.main:app --reload  # API on :8000, Swagger at /api... docs at /docs
python -m scripts.seed_demo_case [--force]   # re-seed the demo case
```

There are no automated tests yet. Verify changes by running the stack and
walking the demo flow (dashboard → briefing → interrogate → accuse → resolve).

## Environment

Copy `.env.example` → `.env` (repo root; compose passes it to the backend).

- `GEMINI_API_KEY` — required for suspect replies, case generation, verdict
  analysis. Without it those endpoints return 503, but the app still boots and
  the seeded demo case is browsable.
- `ELEVENLABS_API_KEY` — required only for voice playback (503 otherwise; the
  frontend treats TTS failures as non-fatal).
- `DEV_AUTH_BYPASS=true` (default) — every request resolves to user `dev-user`;
  the frontend shows "Continue as Guest". For real Google Sign-In set
  `DEV_AUTH_BYPASS=false`, `CLERK_JWKS_URL`, and `VITE_CLERK_PUBLISHABLE_KEY`.

## Architecture

```
frontend (React SPA) ── REST + SSE ──> backend (FastAPI) ──> MongoDB
                                          ├──> Gemini (google-genai)
                                          └──> ElevenLabs (httpx REST)
```

The frontend NEVER calls Gemini, ElevenLabs, or MongoDB directly.

### The one rule that matters: public vs private case data

A case document stores the briefing AND the solution. Anything the player must
not see before resolution lives in `Suspect.private`, `Case.canonical_timeline`,
or `Case.solution` ([backend/app/models/case.py](backend/app/models/case.py)).
**Every** endpoint response goes through
[backend/app/services/sanitize.py](backend/app/services/sanitize.py) — never
return a raw case document. `sanitize.resolution()` is only reachable after a
verdict is stored.

### Backend layout (backend/app/)

- `api/` — routers: `cases.py`, `investigations.py` (notes/suspects/evidence),
  `interrogation.py` (SSE chat), `verdict.py`, `audio.py`. Shared loaders with
  ownership checks in `deps.py`.
- `core/` — `config.py` (pydantic-settings, reads `.env`), `db.py` (Motor
  client), `auth.py` (dev bypass or Clerk JWKS JWT verification).
- `models/` — Pydantic models. `case.py` (Case/Suspect/Evidence/Solution),
  `investigation.py` (Investigation, SuspectState, InterrogationMessage,
  SuspectReply — the schema Gemini must return).
- `services/` — `gemini.py` (all LLM calls), `prompts.py` (suspect system
  prompts + case generator, adapted from Detective K v3 prompts), `voice.py`
  (ElevenLabs REST), `sanitize.py`, `seed.py`.
- `data/demo_case.json` — handcrafted case "The Gallery After Hours"
  (culprit: s2 Julian Cross). Auto-seeded on startup when `cases` is empty.

### Game mechanics

- **Trust (start 50) / Patience (start 100)** per suspect per investigation,
  stored in `investigations.suspect_state`. Gemini suggests deltas in its JSON
  reply (`trust_change` −15..+15, `patience_change` −25..+10); the backend
  clamps to 0–100. Patience 0 → conversation permanently ended.
- **Suspect knowledge boundaries**: each agent's system prompt contains only
  its own `known_facts` / `unknown_facts` / `knows_about_others`. Only the
  culprit's prompt references the crime details.
- **Verdict correctness is decided by the backend** (accused_id ==
  solution.culprit_id). Gemini only writes the flavor "commission review".
- Conversation history sent to Gemini is capped at `max_history_messages` (12).

### SSE protocol (interrogation)

`POST /api/investigations/{id}/suspects/{sid}/messages` responds
`text/event-stream`: `token` events (`{"text": ...}`) for the typing effect,
one final `meta` event (the full stored message: emotion, trust/patience after,
conversation_ended), or `error`. The full Gemini reply is generated and
persisted before streaming starts. Client parser:
[frontend/src/lib/api.ts](frontend/src/lib/api.ts) `streamMessage()`.

### Frontend layout (frontend/src/)

- `pages/` — `SignIn`, `Dashboard`, `Briefing`, `Investigation` (workspace:
  suspects + evidence + notes), `Interrogation`, `Accusation`, `Resolution`.
  Routes in `App.tsx`; all but SignIn are behind `RequireAuth`.
- `lib/auth.tsx` — auth abstraction. Guest mode (localStorage) or Clerk,
  selected by presence of `VITE_CLERK_PUBLISHABLE_KEY`. Pages only use
  `useAuth()`; nothing else imports Clerk. Registers the bearer-token provider
  with the API client.
- `lib/api.ts` — typed fetch wrapper (`api.*`), SSE reader, TTS helper.
- `store/investigationStore.ts` — Zustand store for the active investigation
  (investigation, suspects, evidence, notes autosave).
- `index.css` — Tailwind v4 (`@theme` tokens `noir-*`, `gold-*`) + shared
  classes `panel`, `btn-gold`, `btn-ghost`, `input-noir`. Aesthetic: detective
  noir — dark stone/amber, Georgia display font.
- Voice input uses the browser SpeechRecognition API (Chrome/Edge); text input
  is always the fallback.

### MongoDB collections

`cases`, `investigations`, `interrogations` (one doc per Q/A exchange). No
`suspects`/`evidence` collections — they are embedded in the case document.

## Current status (2026-07-11)

Done: full playable loop with docker compose — dashboard, briefing,
investigation workspace, SSE interrogation with evidence presentation and
emotional metadata, voice in (browser STT) / voice out (ElevenLabs), notes,
accusation, resolution reveal; Gemini case generation endpoint; demo case
seeding; guest + Clerk auth paths.

Not done (Priority 3/4 in `docs/GDD.md` §10):
- Veo-generated CCTV video evidence (models support `media_url`; generation
  and storage not implemented — pre-generate for the demo if needed)
- Media storage (Cloudinary/GCS); TTS audio is synthesized per playback, not
  persisted (`audio_url` field exists but is always null)
- Two more pre-generated cases for the dashboard (run POST /api/cases/generate)
- Relationship map, interactive timeline, contradiction highlighting
- Real token-level streaming from Gemini (currently the validated full reply is
  chunked into SSE tokens)
- Clerk flow is untested against a real Clerk app; guest mode is the tested path

## Git workflow

- Never commit directly to `main` or `dev`.
- Create `feature/<name>` from `dev`; when approved, merge into `dev` and
  delete the feature branch.
- `dev` is promoted to `main` after review.
- Remote: https://github.com/TheBluCoder/investigator-game.git
- Conventional commits (`feat(backend): ...`, `fix(frontend): ...`, `chore:`,
  `docs:`). No AI co-author trailers.

## Design reference

`docs/GDD.md` is the authoritative spec for gameplay, screens, endpoints, and
scope. Check it before adding features — especially §11 (out of scope).
