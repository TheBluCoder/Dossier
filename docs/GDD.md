# Detective K — Hackathon MVP Game Design Document

## Document Information

- **Project:** Detective K
- **Platform:** Browser-based web application
- **Genre:** AI-powered detective / investigation game
- **MVP Type:** Single-player hackathon prototype
- **Frontend:** React + TypeScript
- **Backend:** Python + FastAPI
- **Authentication:** Clerk or Firebase Authentication with Google Sign-In
- **Database:** MongoDB Atlas
- **AI:** Gemini API, including Veo for generated video evidence
- **Voice:** ElevenLabs
- **Status:** Hackathon MVP specification

---

# 1. Game Overview

Detective K is a single-player detective game where players act as investigators working for a commission that assigns criminal cases.

The commission presents the player with a list of available cases. The player chooses a case, reads the briefing, reviews the evidence, interrogates suspects, and submits a final accusation.

Every case is generated dynamically using the Gemini API. Each case has its own crime, victim, crime scene, briefing, timeline, suspects, relationships, evidence, hidden secrets, motive, culprit, and final solution.

The goal is simple:

> **Identify the culprit and explain the crime using evidence gathered during the investigation.**

---

# 2. Core Player Experience

The player should feel like they are conducting an actual investigation rather than selecting options from a scripted story.

There are no fixed dialogue trees.

Players can ask suspects any question through text or voice. Suspects respond based on their own personality, knowledge, relationships, objectives, emotional state, trust, and patience.

The player must combine case information, evidence, testimony, contradictions, emotional cues, relationships, and hidden motives.

A suspect who lies is not automatically guilty. Innocent suspects may hide affairs, financial problems, embarrassing incidents, or unrelated wrongdoing.

The player must distinguish between someone hiding something, someone lying, someone protecting another person, and someone who actually committed the crime.

---

# 3. Core Gameplay Loop

```text
Sign in with Google
        ↓
View Available Cases
        ↓
Select a Case
        ↓
Read Case Briefing
        ↓
Review Suspects and Evidence
        ↓
Interrogate Suspects by Text or Voice
        ↓
Find Contradictions and Hidden Information
        ↓
Submit Final Accusation
        ↓
View Case Resolution
```

---

# 4. Hackathon MVP Features

## 4.1 Google Sign-In

Players sign in using their Google account.

Use either:

- **Clerk**, or
- **Firebase Authentication**

The authentication provider handles Google OAuth, user sessions, login and logout, identity verification, and secure authentication tokens.

The application does not store passwords.

The backend only needs the authenticated user's provider ID and basic profile information required to associate investigations with that user.

For the fastest web MVP, Clerk is recommended. Firebase Authentication is also acceptable if the team already has Firebase experience.

## 4.2 Commission Dashboard

After signing in, the player sees the commission dashboard.

The dashboard displays a small list of available cases.

Each case card should show:

- Case title
- Crime type
- Short summary
- Difficulty
- Number of suspects
- Status
- Open Case button

For the hackathon demo, the dashboard should contain approximately three cases.

Cases can be generated before the demo and stored in MongoDB to avoid making judges wait.

Supported statuses:

- Available
- In progress
- Solved

No shared case claiming, global ownership, or multiplayer state is required.

## 4.3 Case Generation

Gemini generates each complete case as structured JSON.

A generated case should contain:

- Case title
- Crime type
- Crime summary
- Crime scene
- Victim profile
- Public timeline
- Canonical private timeline
- Three suspects
- Relationships between characters
- Four to six evidence items
- Hidden facts
- One culprit
- Culprit motive
- Complete solution
- Information known by each suspect

Each case must have exactly one canonical truth.

The generated case is stored once and must not change during the investigation.

The backend must verify that:

- There is exactly one culprit.
- Every suspect has a distinct role.
- Evidence supports the solution.
- Innocent suspects have believable reasons to appear suspicious.
- The case can be solved from the available information.
- No private solution fields are returned to the player before the case ends.

## 4.4 Case Briefing

When the player opens a case, they receive the commission briefing.

The briefing includes:

- Crime summary
- Victim profile
- Crime scene description
- Estimated time of the crime
- Initial timeline
- Suspect roster
- Initial evidence

The briefing must not reveal the culprit, private suspect memories, hidden motives, canonical private timeline, or complete solution.

## 4.5 Suspect Files

Each suspect has a public profile visible to the player.

A suspect file may contain:

- Name
- Age
- Occupation
- Relationship with the victim
- Public background
- Claimed alibi
- Basic personality description
- Profile image or placeholder avatar

The public profile must be stored separately from the suspect's private AI state.

Private information must never be sent directly to the frontend.

## 4.6 Independent Suspect Agents

Every suspect is an independent Gemini-powered agent.

Each suspect has their own:

- Personality
- Background
- Relationship with the victim
- Relationships with other suspects
- Private memories
- Known facts
- Unknown facts
- Secret
- Objective
- Emotional state
- Trust toward the player
- Patience level
- Conversation history
- Culprit status

Only the culprit knows that they committed the crime.

Other suspects may know useful information without knowing the identity of the culprit.

Example:

- Suspect A knows Suspect B had an affair with the victim.
- Suspect B knows the victim argued with Suspect C.
- Suspect C saw someone leave the building but could not identify them.
- Suspect D may not know Suspect A exists.
- Only the culprit knows the complete details of the crime.

Each agent must receive only the information that their character knows.

An innocent suspect must not receive the complete solution.

## 4.7 Suspect Secrets and False Leads

The culprit is not the only person hiding something.

Innocent suspects may lie or refuse to cooperate because they want to:

- Hide an affair
- Protect a friend or family member
- Conceal financial problems
- Protect their job
- Hide unrelated wrongdoing
- Avoid embarrassment
- Protect their reputation

This creates believable false leads.

Finding a lie should create a new question, not automatically solve the case.

## 4.8 Text Interrogation

Players can interrogate suspects by typing natural-language questions.

There are no predefined dialogue options.

Example questions:

- Where were you at 9 PM?
- What was your relationship with the victim?
- Why did you lie about your alibi?
- Did you know about the argument?
- What do you know about the other suspects?

Gemini generates the response as the selected suspect.

The response should stream into the interface as text.

## 4.9 Voice Interrogation

Players can also interrogate suspects using their microphone.

```text
Player records a question
        ↓
Speech is converted to text
        ↓
The transcript is sent to the selected suspect agent
        ↓
Gemini generates the suspect's response
        ↓
Response text streams into the interface
        ↓
ElevenLabs generates and plays the suspect's voice
```

Players may switch between text and voice at any time.

The complete transcript remains visible regardless of input method.

Text input must remain available as a fallback when microphone access fails.

## 4.10 Emotional and Vocal Clues

Interrogations are about both what suspects say and how they say it.

Gemini should return structured emotional information with every response.

```json
{
  "response": "I already told you. I was at home that evening.",
  "emotion": "nervous",
  "emotion_intensity": 0.72,
  "delivery": {
    "pace": "slow",
    "hesitation": true,
    "confidence": 0.38
  },
  "trust_change": -2,
  "patience_change": -4,
  "conversation_ended": false
}
```

Possible clues include:

- Hesitation
- Nervous stuttering
- Long pauses
- Sudden changes in tone
- Increased defensiveness
- Anger
- Frustration
- Unusual confidence
- Avoiding a person's name
- Becoming uncertain about specific events
- Speaking differently after evidence is presented

ElevenLabs uses the response and emotional metadata to produce the suspect's voice.

These cues must not act as a perfect lie detector.

An innocent person may sound nervous, while a guilty person may sound calm and convincing.

## 4.11 Trust and Patience

Each suspect has two simple interaction values.

```text
Trust: 50/100
Patience: 100/100
```

Trust represents how comfortable the suspect feels with the player.

Trust may increase when the player shows empathy, remains respectful, demonstrates knowledge of the case, or avoids unsupported accusations.

Trust may decrease when the player makes false accusations, threatens the suspect, repeatedly asks the same question, or presents obvious lies.

Higher trust may cause a suspect to reveal more sensitive information.

Patience represents how willing the suspect is to continue the interrogation.

Patience may decrease when the player becomes aggressive, repeats questions, pressures the suspect, or accuses them without evidence.

At low patience, the suspect becomes less cooperative. At zero patience, the suspect may end the conversation.

Gemini may suggest trust and patience changes, but the backend validates and clamps all values between 0 and 100.

## 4.12 Conversation Memory

Every interrogation message is stored in MongoDB.

A conversation record includes:

- User ID
- Investigation ID
- Case ID
- Suspect ID
- Player message
- Suspect response
- Input type: text or voice
- Emotion
- Trust before and after
- Patience before and after
- Timestamp
- Audio URL, when available

Before generating a new response, the backend retrieves the suspect's private state, facts known by the suspect, current trust and patience, recent conversation history, and evidence currently being presented.

For the MVP, use recent messages plus an optional conversation summary to reduce prompt size.

## 4.13 Evidence Viewer

The investigation screen contains an evidence section.

Each evidence item includes:

- Title
- Type
- Description
- Timestamp
- Related people
- Media URL, when applicable
- Reviewed status

Supported MVP evidence types may include:

- Crime scene report
- Witness statement
- Email
- Phone record
- Receipt
- Security log
- Photograph
- Audio recording
- CCTV footage

Most evidence can be text-based.

At least one case should include a visual or audio evidence item for the demo.

## 4.14 Video Evidence Through Gemini API and Veo

Veo, accessed through the Gemini API ecosystem, generates short video evidence.

Examples include:

- CCTV footage
- Doorbell camera footage
- Hallway security footage
- Parking lot surveillance

The canonical facts represented by the footage must be created before video generation.

```json
{
  "title": "Office Hallway CCTV",
  "timestamp": "21:04",
  "canonical_facts": [
    "A person wearing a grey coat enters the office.",
    "The person walks with a slight limp.",
    "The person's face is not visible."
  ]
}
```

The video is only a visual representation of those facts.

Accidental details introduced by the generated video must not become official evidence.

Because video generation may be slow, the MVP should pre-generate the demo footage or start generation when the case is created and let the player investigate while it processes.

If video generation fails, show a written CCTV report and placeholder image.

The core game must still work without generated video.

## 4.15 Presenting Evidence to Suspects

During an interrogation, the player may select an evidence item and present it to the suspect.

The suspect responds based on whether they know about the evidence, whether it contradicts their testimony, whether they are involved, their personality, trust, patience, and objective.

Presenting evidence may cause:

- Admission of a smaller lie
- Change in alibi
- Nervousness
- Anger
- Deflection
- Revelation of another person's secret
- Refusal to answer

For the MVP, evidence presentation can be implemented as a dropdown beside the message input.

## 4.16 Investigation Notes

The player has a simple notes panel.

Notes are saved against the player's current investigation.

No AI processing is required for notes in the MVP.

## 4.17 Final Accusation

The player may submit a final accusation at any point.

The accusation form requires:

- Accused suspect
- Proposed motive
- Explanation
- Supporting evidence

The backend determines correctness by comparing the selected suspect with the stored culprit.

Gemini may evaluate the player's reasoning, but Gemini does not decide whether the selected suspect is correct.

The resolution screen displays:

- Correct or incorrect verdict
- Actual culprit
- Actual motive
- Complete timeline
- Explanation of the crime
- Why innocent suspects lied
- Evidence supporting the solution
- Important clues the player missed

For the hackathon, the full solution is revealed after the final accusation.

---

# 5. MVP Screens

## 5.1 Sign-In Screen

- Game logo
- Short description
- Continue with Google button

## 5.2 Commission Dashboard

- Signed-in player name and avatar
- Available case cards
- Case status
- Open Case button
- Cases are generated in the background: the commission always holds N open
  cases, and solved ones are replaced automatically (no player-facing
  generate button)

## 5.3 Case Briefing

- Crime summary
- Victim profile
- Crime scene description
- Initial timeline
- Evidence preview
- Suspect roster
- Begin Investigation button

## 5.4 Investigation Workspace

- Case title
- Suspect list
- Evidence list
- Selected evidence view
- Notes panel
- Open Interrogation button
- Submit Accusation button

## 5.5 Interrogation Room

- Suspect profile
- Conversation transcript
- Streaming response text
- Text input
- Microphone control
- Evidence selector
- Trust indicator
- Patience indicator
- Audio playback control

## 5.6 Final Accusation

- Suspect selector
- Motive field
- Explanation field
- Evidence selector
- Submit button

## 5.7 Resolution Screen

- Correct or incorrect result
- Actual culprit
- Motive
- Complete timeline
- Explanation
- Suspect secrets
- Missed clues

---

# 6. Technology Stack and Responsibilities

## 6.1 React and TypeScript

React builds the player-facing web interface.

It is responsible for the sign-in screen, commission dashboard, case briefing, evidence viewer, suspect files, interrogation interface, microphone controls, streaming text display, audio playback, trust and patience indicators, notes, accusation form, and resolution screen.

TypeScript defines reliable frontend types for cases, suspects, evidence, messages, and verdicts.

The frontend must never receive private case information before the resolution screen.

## 6.2 Vite

Vite provides the local development server, fast hot reload, frontend builds, and environment-variable support.

## 6.3 React State Management

Zustand manages temporary frontend state such as the current authenticated user, selected case, current investigation, selected suspect, evidence, messages, notes, audio settings, and loading states.

Persistent investigation state remains in MongoDB.

## 6.4 Tailwind CSS

Tailwind CSS is used to create the interface quickly.

The visual direction should be modern detective noir with a dark background, high-contrast text, gold or amber accents, evidence cards, file-folder styling, and a clear interrogation transcript.

## 6.5 Clerk or Firebase Authentication

Clerk or Firebase Authentication handles identity.

It is responsible for Google Sign-In, authentication sessions, secure tokens, sign-out, and the user's basic profile.

The application does not store passwords.

The FastAPI backend validates the authentication token before allowing access to protected endpoints.

The user's provider ID may be stored in MongoDB to associate them with investigations. This does not mean the application manages their authentication credentials.

## 6.6 Python and FastAPI

FastAPI is the protected backend and game engine.

It is responsible for:

- Verifying authentication tokens
- Returning available cases
- Generating new cases
- Sanitizing public case data
- Loading private suspect state
- Calling Gemini
- Calling ElevenLabs
- Streaming suspect text responses
- Updating trust and patience
- Persisting conversations
- Managing evidence
- Processing accusations
- Revealing the final solution
- Preventing private information from reaching the frontend

The frontend must never call Gemini, ElevenLabs, or MongoDB directly.

## 6.7 Pydantic

Pydantic validates case generation output, suspect-agent output, emotional metadata, evidence objects, API requests, API responses, and verdict submissions.

AI output must never be written directly to MongoDB without validation.

## 6.8 MongoDB Atlas

MongoDB stores persistent game data.

It stores generated cases, public briefings, private solutions, suspect public profiles, suspect private states, evidence, conversations, trust and patience, player notes, investigation progress, verdicts, media metadata, and authentication provider user IDs.

MongoDB does not store user passwords.

## 6.9 Gemini API

Gemini powers the game's intelligence.

It is responsible for case generation, suspect reasoning, personality consistency, knowledge boundaries, emotional reactions, responses to presented evidence, verdict analysis, explanation of missed clues, and final case reconstruction.

Veo, accessed through the Gemini API ecosystem, generates CCTV and other short surveillance-style evidence.

## 6.10 ElevenLabs

ElevenLabs provides the suspect voice-chat experience.

It is responsible for converting suspect responses to speech, assigning a consistent voice to each suspect, reflecting personality and emotion, and producing audio for playback.

The suspect response is always preserved as text.

## 6.11 Speech-to-Text

Speech-to-text converts the player's spoken question into text.

For the MVP, use either browser speech recognition or an external transcription service.

Text chat remains the fallback.

## 6.12 Server-Sent Events

Server-Sent Events stream Gemini's suspect response from FastAPI to React.

This allows the player to begin reading the answer immediately.

SSE is sufficient for the MVP because the main streaming direction is backend to frontend.

## 6.13 Media Storage

Generated audio and video files should be stored outside the main MongoDB documents.

Possible options:

- Cloudinary
- Google Cloud Storage
- AWS S3
- MongoDB GridFS

MongoDB stores the file URL and metadata.

For the hackathon, temporary backend file storage is acceptable if deployment persistence is not essential.

---

# 7. Suggested Architecture

```text
┌───────────────────────────────────┐
│        React Web Application      │
│                                   │
│ Google Sign-In                    │
│ Commission Dashboard              │
│ Case Briefing                     │
│ Evidence Viewer                   │
│ Interrogation Interface           │
│ Voice Recorder                    │
│ Final Accusation                  │
└─────────────────┬─────────────────┘
                  │
                  │ REST + SSE
                  ▼
┌───────────────────────────────────┐
│          FastAPI Backend          │
│                                   │
│ Authentication Verification       │
│ Case Service                      │
│ Suspect Agent Service             │
│ Evidence Service                  │
│ Voice Service                     │
│ Verdict Service                   │
└───────┬──────────┬──────────┬─────┘
        │          │          │
        ▼          ▼          ▼
┌────────────┐ ┌───────────┐ ┌──────────────┐
│ MongoDB    │ │ Gemini API│ │ ElevenLabs   │
│ Atlas      │ │ + Veo     │ │              │
│            │ │           │ │ Voice Output │
│ Cases      │ │ Case Gen  │ │              │
│ Suspects   │ │ Agents    │ └──────────────┘
│ Evidence   │ │ Verdicts  │
│ Messages   │ │ Video     │
└────────────┘ └───────────┘

Authentication:
React → Clerk or Firebase
FastAPI verifies provider-issued tokens.
```

---

# 8. Recommended MongoDB Collections

## `cases`

Stores the public briefing, victim, public timeline, canonical timeline, culprit, motive, solution, and case status.

## `suspects`

Stores the public profile, private state, known facts, unknown facts, relationships, personality, objective, and voice ID.

## `evidence`

Stores evidence details, canonical facts, media URLs, related suspects, and timestamps.

## `investigations`

Stores authentication provider user ID, case ID, status, reviewed evidence, trust and patience, notes, verdict, and start and completion time.

## `interrogations`

Stores investigation ID, suspect ID, player message, input type, suspect response, emotion, trust and patience changes, audio URL, and timestamp.

> Implementation note: this repo embeds suspects and evidence inside the case
> document instead of separate collections — simpler for the MVP, same privacy
> rules apply.

---

# 9. Suggested API Endpoints

## Authentication

Authentication occurs through Clerk or Firebase.

FastAPI validates the bearer token on protected routes.

```text
GET /api/me
```

## Cases

```text
GET  /api/cases
POST /api/cases/generate
GET  /api/cases/{case_id}
```

## Investigations

```text
POST /api/investigations
GET  /api/investigations/{investigation_id}
PUT  /api/investigations/{investigation_id}/notes
```

## Suspects and Interrogations

```text
GET  /api/investigations/{investigation_id}/suspects
GET  /api/investigations/{investigation_id}/suspects/{suspect_id}/messages
POST /api/investigations/{investigation_id}/suspects/{suspect_id}/messages
```

The message endpoint supports streamed responses.

## Evidence

```text
GET  /api/investigations/{investigation_id}/evidence
POST /api/investigations/{investigation_id}/evidence/{evidence_id}/review
```

Evidence presentation is part of the message endpoint (`evidence_id` field).

## Voice

```text
POST /api/audio/synthesize
```

Speech-to-text uses the browser SpeechRecognition API in the MVP.

## Verdict

```text
POST /api/investigations/{investigation_id}/verdict
GET  /api/investigations/{investigation_id}/resolution
```

---

# 10. Build Priority

## Priority 1 — Core Game

- Google Sign-In
- Commission dashboard
- Three available cases
- Case briefing
- Three suspects
- Evidence viewer
- Text interrogation
- Independent suspect knowledge
- Conversation persistence
- Final accusation
- Resolution screen

## Priority 2 — Sponsor Integrations

- Gemini case generation
- Gemini suspect agents
- MongoDB persistence
- ElevenLabs suspect voices
- Voice input
- Text streaming
- Emotional metadata

## Priority 3 — Demo Polish

- Distinct suspect voices
- Trust and patience indicators
- Evidence presentation
- One generated or pre-generated CCTV clip
- Notes panel
- Strong noir interface
- Loading and generation states

## Priority 4 — Stretch Goals

- Relationship map
- Interactive timeline
- Automatic contradiction highlighting
- Additional generated video
- More than three suspects

---

# 11. Explicitly Out of Scope

> Scope amendment (2026-07-11): a simplified **reputation system, detective
> ranks (tiers), global leaderboard, and player profiles** were pulled INTO
> scope (+75+difficulty×5 RS on correct verdicts / −50 on wrong; tiers
> Rookie 0 / Inspector 300 / Senior 800 / Master 1500 / Legend 2000). The
> **multiplayer menu exists** in the nav but its functionality stays out of
> scope (locked "coming soon" lobby).

Do not implement the following until the core single-player game works:

- Multiplayer (functionality — the locked menu/lobby page is in scope)
- Team investigations
- Competitive modes
- Tournaments
- XP
- Credits
- Payments
- Premium tools
- Retry cooldowns
- Daily rewards
- Daily cases
- Achievements
- Notifications
- Telegram Mini App integration
- Telegram Stars
- Cold case archive
- Global shared case claiming
- Web3
- NFTs
- Cryptocurrency
- Complex role-based permissions
- 3D crime scene / procedural scene generation

---

# 12. Demo Flow

The hackathon demo should support this sequence:

1. Sign in with Google.
2. Open the commission dashboard.
3. Select an available case.
4. Read the briefing.
5. Review the suspects and evidence.
6. Ask one suspect a typed question.
7. Ask another suspect a voice question.
8. Hear the response while reading streamed text.
9. Notice an emotional cue or contradiction.
10. Present evidence to a suspect.
11. Submit an accusation.
12. Reveal the full case.

The complete demo should take approximately five minutes.

---

# 13. Definition of Done

The MVP is complete when:

- A player can sign in with Google.
- A signed-in player can view available cases.
- A player can open and investigate a case.
- The case contains exactly one culprit.
- Private case data is protected by the backend.
- Three suspects can be interrogated separately.
- Every suspect uses only their assigned knowledge.
- Conversations remain available after changing screens.
- Players can use text interrogation.
- At least one suspect can answer using ElevenLabs audio.
- The audio response also appears as text.
- Players can review evidence.
- Players can submit an accusation.
- The game reveals the correct solution.
- The complete experience runs without manually editing MongoDB.
