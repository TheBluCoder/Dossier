# Detective K — Investigator Game (Hackathon MVP)

Single-player, browser-based AI detective game. Players pick a case from the
commission dashboard, review evidence, interrogate Gemini-powered suspects by
text or voice, and submit a final accusation.

**Stack:** React + TypeScript + Vite + Tailwind v4 · FastAPI (Python 3.12) ·
MongoDB · Gemini API · ElevenLabs · Clerk (Google Sign-In)

## Features

- **Commission dashboard** — case docket with AI-generated mysteries, your
  reputation, tier, and solve stats
- **Investigation workspace** — suspects, evidence viewer, auto-saved notes
- **Interrogation room** — free-form questioning of independent AI suspect
  agents (streamed replies, emotional cues, trust/patience meters), evidence
  presentation, voice input, and ElevenLabs voice replies
- **Verdict & resolution** — accuse a suspect, earn or lose reputation, and
  see the full case reconstruction
- **Progression** — reputation score with detective tiers
  (Rookie → Inspector → Senior → Master → Legend), global leaderboard, and
  player profiles with case history
- **Versus (coming soon)** — multiplayer lobby is visible but locked for the
  hackathon build

## Quick start (Docker)

```bash
cp .env.example .env   # add GEMINI_API_KEY / ELEVENLABS_API_KEY (optional for first boot)
docker compose up --build
```

| Service  | URL                        |
| -------- | -------------------------- |
| Frontend | http://localhost:5173      |
| Backend  | http://localhost:8000/docs |
| MongoDB  | mongodb://localhost:27017  |

On first boot the backend seeds one handcrafted demo case, so the game is
browsable immediately without API keys. Suspect replies need `GEMINI_API_KEY`;
voice playback needs `ELEVENLABS_API_KEY`.

Auth defaults to **dev bypass** (`DEV_AUTH_BYPASS=true`) — the frontend shows a
"Continue as Guest" button. Set Clerk keys in `.env` to enable Google Sign-In.

Both containers hot-reload: source directories are volume-mounted.

## Without Docker

```bash
# backend
cd backend && python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# frontend
cd frontend && pnpm install && pnpm dev
```

## Git workflow

- Branch from `dev`: `feature/<name>`
- Merge into `dev` when approved, delete the feature branch
- `dev` is promoted to `main` after review

## Documentation

- [docs/GDD.md](docs/GDD.md) — game design document: gameplay, screens, API
  surface, build priorities, and what's explicitly out of scope
- [CLAUDE.md](CLAUDE.md) — architecture, conventions, game mechanics
  (reputation/tiers, trust/patience), current status, and agent guidance
