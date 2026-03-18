# TedTalks

TedTalks is a parent-facing monitoring dashboard plus a Raspberry Pi voice chatbot for kids.

The current codebase works like this:

1. The Raspberry Pi listens for speech, transcribes it, generates a Teddy reply, speaks the reply back, and saves each exchange into MySQL.
2. The backend analysis worker reads new MySQL rows marked `PENDING`, analyzes them, and writes back mood, summary, topic, keywords, and alert metadata.
3. A lightweight Python API server reads those MySQL rows and exposes dashboard-friendly endpoints.
4. The React frontend calls that API and shows parents a privacy-aware dashboard:
   - summarized timeline entries for normal conversations
   - full raw text only for flagged alerts
   - mood trends, alerts, and parent advice

## Repository Layout

- `backend-raspi/`
  Raspberry Pi runtime. Records audio, transcribes it, generates a response, speaks it, and inserts raw events into MySQL.

- `backend/analytics/worker.py`
  Analysis worker. Polls the `events` table for `analysis_status = 'PENDING'` and updates rows with analysis results.

- `backend/api_server.py`
  Lightweight local API server used by the frontend during demos and local development.

- `frontend/`
  React + Vite parent dashboard.

- `.env`
  Shared backend-side environment variables, including MySQL credentials and default `USER_ID`.

## End-to-End Data Flow

### 1. Raspberry Pi captures a conversation

The Raspberry Pi app in [chatbot.py](/c:/Users/owake/Desktop/TedTalks/backend-raspi/chatbot.py):

- records audio with `parec`
- uses simple voice activity detection to stop recording after silence
- transcribes speech with Faster-Whisper
- generates a child-safe reply using Ollama
- speaks the reply with Kokoro TTS and `pacat`

For each turn, it writes one row into the MySQL `events` table:

- `user_id`
- `device_id`
- `session_id`
- `timestamp_utc`
- `child_text`
- `ai_text`
- `event_type`
- `analysis_status`

New rows are inserted with:

- `event_type = 'CHAT'`
- `analysis_status = 'PENDING'`

That means the raw conversation is stored first, then analyzed afterward.

### 2. The analysis worker enriches the row

The worker in [worker.py](/c:/Users/owake/Desktop/TedTalks/backend/analytics/worker.py):

- connects to the same MySQL database
- ensures required columns and indexes exist
- repeatedly polls for `PENDING` rows
- claims rows by changing them to `PROCESSING`
- analyzes the conversation text
- writes results back to the same row

The worker fills fields such as:

- `keywords_json`
- `emotion_label`
- `mood_emoji`
- `topic_label`
- `summary_text`
- `flagged`
- `flag_reasons_json`
- `interaction_count`
- `analysis_status = 'DONE'`

Analysis can happen in two modes:

- Gemini mode, if `GEMINI_API_KEY` is set
- fallback heuristic mode, if Gemini is unavailable

### 3. The API server exposes frontend endpoints

The frontend does not connect directly to MySQL. Instead, [api_server.py](/c:/Users/owake/Desktop/TedTalks/backend/api_server.py) reads MySQL and exposes JSON endpoints.

This is important for privacy and security because:

- browser code must not contain raw MySQL credentials
- the backend controls what fields the parent UI receives
- privacy rules can be enforced centrally

Current API endpoints:

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

The API reads from the MySQL `events` table and transforms raw rows into frontend-friendly structures.

### 4. The frontend displays parent-safe data

The React frontend in `frontend/` calls the API and renders:

- dashboard summary cards
- mood trend charts
- flagged alerts
- conversation timeline
- parent advice

Privacy behavior in the timeline:

- non-flagged conversations are shown as summaries or overviews
- flagged conversations show the raw child message and Teddy reply for review

The frontend polls in the background so new conversations appear automatically without full-page flicker.

## MySQL Schema

The core table is `events`.

Important raw conversation fields:

- `id`
- `user_id`
- `device_id`
- `session_id`
- `timestamp_utc`
- `child_text`
- `ai_text`
- `event_type`
- `analysis_status`

Important analysis fields added/used by the worker:

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

In practice:

- Raspberry Pi inserts raw rows
- worker enriches the same rows
- API reads the enriched rows
- frontend shows the transformed results

## Environment Variables

Root `.env` currently contains backend-side database settings such as:

```env
MYSQL_HOST=172.20.xx.x
MYSQL_PORT=3306
MYSQL_USER=pi_user
MYSQL_PASSWORD=password123
MYSQL_DB=teddy_db
DEVICE_ID=pi-1
USER_ID=child-1
```

The backend API server also supports:

```env
API_HOST=0.0.0.0
API_PORT=8000
```

The analysis worker optionally uses:

```env
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-1.5-flash
BATCH_LIMIT=200
SLEEP_ON_IDLE_SEC=0.2
```

The frontend uses `frontend/.env`:

```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_AI_BASE_URL=http://localhost:8000
```

## How To Run The Project

### Backend API

From the repo root:

```powershell
cd C:\Users\owake\Desktop\TedTalks
python backend\api_server.py
```

This starts the local API on `http://localhost:8000`.

### Analysis worker

In another terminal:

```powershell
cd C:\Users\owake\Desktop\TedTalks
python backend\analytics\worker.py
```

This continuously analyzes new `PENDING` rows in MySQL.

### Frontend

In a third terminal:

```powershell
cd C:\Users\owake\Desktop\TedTalks\frontend
npm install
npm run dev
```

Then open the Vite URL, usually:

```text
http://localhost:5173
```

For demos, log in using:

```text
child-1
```

### Raspberry Pi runtime

Run the Pi-side app from the Pi environment:

```bash
python3 backend-raspi/chatbot.py
```

That process will:

- listen for a child utterance
- generate a Teddy reply
- save the turn into MySQL

If the worker is running, the row will soon be analyzed and then appear in the parent dashboard.

## Demo Sequence

Recommended demo order:

1. Start `backend/api_server.py`
2. Start `backend/analytics/worker.py`
3. Start `frontend` with `npm run dev`
4. Log in with `child-1`
5. Trigger a new Pi conversation
6. Show the dashboard updating from MySQL-backed data

## Privacy Notes

The current privacy model is:

- raw child and Teddy text is stored in MySQL
- the parent UI avoids showing raw text for normal conversations
- raw text is shown for flagged alerts only

This is more private than always rendering verbatim conversation text in the timeline, but the API still has access to raw text because it needs that data for flagged review and alert generation.

## Known Limitations

- The local API server is intended for demo/local use, not production hardening
- Parent login is currently a lightweight development flow, not a full auth system
- Frontend updates use background polling, not websockets/SSE
- Large frontend bundle warnings still exist in production build output

## Summary

The current implemented architecture is:

Raspberry Pi voice app -> MySQL `events` table -> analysis worker -> local API server -> React parent dashboard

That is the flow reflected by the code in this repository today.
