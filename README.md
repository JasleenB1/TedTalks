# TedTalks

TedTalks is a voice-enabled teddy bear companion plus a parent-facing monitoring dashboard.

This repository contains four connected parts:

1. A Raspberry Pi runtime that listens, transcribes, generates a child-safe reply, speaks it back, and writes the interaction into MySQL.
2. A backend worker that continuously analyzes new conversation rows and enriches them with topic, emotion, summary, and flag metadata.
3. A lightweight Python API server that launches the worker automatically and exposes parent-safe JSON endpoints.
4. A React frontend that shows summaries, alerts, mood trends, and parent review screens.

## Technical Overview

### Runtime components

`backend-raspi/chatbot.py`

- Records audio with `parec`
- Detects end-of-speech with simple RMS-based VAD
- Transcribes with Faster-Whisper
- Generates replies with Ollama
- Speaks responses with Kokoro TTS and `pacat`
- Inserts a raw conversation row into MySQL with `analysis_status = 'PENDING'`

`backend/analytics/worker.py`

- Polls the `events` table for `PENDING` chat rows
- Claims rows as `PROCESSING`
- Analyzes the interaction with Gemini or fallback heuristics
- Writes `topic_label`, `emotion_label`, `summary_text`, `flagged`, `flag_reasons_json`, and related metadata back to the same row
- Sends a short email alert when a flagged conversation is detected

`backend/api_server.py`

- Starts the backend worker automatically
- Reads analyzed rows from MySQL
- Returns frontend-ready JSON
- Filters parent-facing timeline data to `DONE` rows so unfinished analysis stays hidden

`frontend/`

- React + Vite application
- Polls backend endpoints for dashboard updates
- Shows summarized non-flagged conversations
- Shows raw flagged content for parent review
- Renders Ontario time for timeline and dashboard displays

## End-to-End Flow

### 1. Child talks to TedTalks

The child speaks into the Raspberry Pi device.

The Pi runtime:

- opens the microphone with PulseAudio
- records until silence is detected
- saves audio to a temporary WAV
- transcribes speech with Faster-Whisper
- sends the text prompt to Ollama
- receives a child-friendly response
- speaks the reply with Kokoro TTS

### 2. Raw interaction is stored

Each interaction is saved to the MySQL `events` table with fields like:

- `user_id`
- `device_id`
- `session_id`
- `timestamp_utc`
- `child_text`
- `ai_text`
- `event_type`
- `analysis_status`

New chat rows are inserted as:

- `event_type = 'CHAT'`
- `analysis_status = 'PENDING'`

### 3. Worker enriches the row

The backend worker continuously scans for pending rows.

For each new row it:

- claims the row by updating it to `PROCESSING`
- analyzes the child text and assistant text
- infers topic and emotion
- generates a summary
- checks for flag patterns such as bullying, threats, self-harm, abuse, or unsafe situations
- marks the row `DONE`

If the row is flagged, the worker also sends a short alert email to the current demo alert recipient configured in code.

### 4. API serves parent-safe data

The frontend does not talk to MySQL directly.

Instead, the API server reads analyzed rows and returns:

- summary cards
- mood trends
- flagged alerts
- timeline groups
- parent advice
- user preferences

This keeps MySQL credentials off the frontend and centralizes privacy decisions in the backend.

### 5. Frontend displays the result

The parent dashboard polls the backend on a short interval.

Current behavior:

- non-flagged items show topic and child emotion in a privacy-aware card
- flagged items show the raw child message and the TedTalks reply
- alerts surface flagged conversations
- dashboard cards summarize recent activity and mood

## Database Notes

The core table is `events`.

Important raw fields:

- `id`
- `user_id`
- `device_id`
- `session_id`
- `timestamp_utc`
- `child_text`
- `ai_text`
- `event_type`
- `analysis_status`

Important enriched fields:

- `processing_at`
- `analyzed_at`
- `failed_at`
- `fail_reason`
- `keywords_json`
- `emotion_label`
- `mood_emoji`
- `topic_label`
- `summary_text`
- `analysis_mode`
- `analysis_error`
- `interaction_count`
- `flagged`
- `flag_reasons_json`
- `flagged_at`

## Environment Files

TedTalks now uses three env locations:

Root `.env`

- shared database settings used across the project
- defaults like `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DB`, `DEVICE_ID`, and `USER_ID`

`backend/.env`

- backend-specific overrides
- SMTP configuration for flagged email alerts

Example backend SMTP settings:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_sender_email@gmail.com
SMTP_PASSWORD=your_app_password
SMTP_FROM=your_sender_email@gmail.com
```

`frontend/.env`

- Vite frontend settings

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_AI_BASE_URL=http://localhost:8000
```

## API Endpoints

Current API routes:

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/events?userId=...`
- `GET /api/dashboard/summary?userId=...`
- `GET /api/dashboard/mood-trends?userId=...&days=7`
- `GET /api/alerts?userId=...&size=10`
- `GET /api/conversations?userId=...&size=100`
- `GET /api/preferences/{userId}`
- `PUT /api/preferences/{userId}`
- `POST /api/ai/parent-advice`

## How To Run

### Backend API and worker

From the repo root:

```powershell
cd C:\Users\owake\Desktop\TedTalks
python backend\api_server.py
```

The API now launches `backend/analytics/worker.py` automatically, so this is the main backend command to keep running.

### Frontend

```powershell
cd C:\Users\owake\Desktop\TedTalks\frontend
cmd /c npm run dev
```

Open the local Vite URL, usually:

```text
http://localhost:5173
```

### Raspberry Pi runtime

Run this on the Pi:

```bash
python3 backend-raspi/chatbot.py
```

## Alert Email Behavior

Flagged email alerts are generated by the worker after a row is marked flagged.

Current demo behavior:

- recipient is hardcoded in `backend/analytics/worker.py`
- sender account comes from `backend/.env`
- if SMTP settings are missing or invalid, the worker logs an email failure but still completes row analysis

## Current Limitations

- Parent auth is still a lightweight development flow
- Frontend updates use polling instead of websockets or server-sent events
- Alert email recipient is still hardcoded for demo use and should be externalized
- Backend email delivery depends on a valid SMTP sender account and app password
- The API server is a local/demo server, not production-hardened infrastructure
- The system still stores raw child and Teddy text in MySQL
- Some frontend duplicate requests still appear during development polling
- Fallback analysis is heuristic-based when Gemini is unavailable

## Planned Improvements

- Replace polling with real-time updates
- Move alert recipients into user-managed settings
- Add stronger auth and parent account controls
- Improve summarization and safety classification quality
- Add production-grade deployment and logging
- Add explicit delivery tracking for alert emails
- Reduce end-to-end latency between conversation close and dashboard update

## Summary

The implemented pipeline is:

Raspberry Pi voice runtime -> MySQL `events` table -> backend worker -> API server -> React parent dashboard -> flagged email alerts
