# Detective K — Investigator Game (Hackathon MVP)

Single-player, browser-based AI detective game. Players pick a case from the
commission dashboard, review evidence, interrogate Gemini-powered suspects by
text or voice, and submit a final accusation.

**Stack:** React + TypeScript + Vite + Tailwind v4 · FastAPI (Python 3.12) ·
MongoDB · Gemini API · ElevenLabs

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

See [CLAUDE.md](CLAUDE.md) for architecture, conventions, and current status.
Game design: [docs/GDD.md](docs/GDD.md).
