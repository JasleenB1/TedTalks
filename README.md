# TedTalks

TedTalks is a voice-based chatbot for kids that runs locally on a Raspberry Pi, stores conversations in MongoDB Atlas, and automatically analyzes each conversation to extract **keywords**, infer the child’s **mood/emotion**, and **flag** potentially important or unsafe conversations for parents to review.

This README explains the repository layout, how the Raspberry Pi side works, how conversations are saved to the database, how the backend worker (worker.py) processes and annotates conversations, and how the app surfaces that data to parents.

---

## Table of contents
- [Project overview](#project-overview)
- [Repository layout / directories](#repository-layout--directories)
- [Raspberry Pi (voice capture & local runtime)](#raspberry-pi-voice-capture--local-runtime)
- [How conversations are stored in MongoDB Atlas](#how-conversations-are-stored-in-mongodb-atlas)
- [backend/worker.py — analysis pipeline (keywords, mood, flags)](#backendworkerpy---analysis-pipeline-keywords-mood-flags)
- [How the app uses the analyzed data (parent dashboard)](#how-the-app-uses-the-analyzed-data-parent-dashboard)
- [Data model (example)](#data-model-example)
- [Running locally / environment variables (summary)](#running-locally--environment-variables-summary)
- [Privacy & safety notes](#privacy--safety-notes)
- [Contributing](#contributing)

---

## Project overview
TedTalks provides a safe, local voice chatbot experience for children:
- The child interacts by voice with the chatbot running on a Raspberry Pi.
- Conversations (transcripts and metadata) are saved to a secure MongoDB Atlas cluster.
- A backend worker automatically analyzes each conversation to:
  - extract important **keywords**
  - infer the child’s **mood/emotion**
  - **flag** conversations that may need parental attention
- Parents get a dashboard view that aggregates and visualizes the child's mood trends, flagged items, and keyword summaries.

---

## Repository layout / directories
The repository is organized to separate the Raspberry Pi client, backend services (API + worker), and the frontend (parent dashboard). The following lists the primary directories and their roles.

- `pi/`  
  Scripts and code that run on the Raspberry Pi hardware. Responsible for:
  - capturing audio from a microphone
  - local speech-to-text (or streaming audio to a STT service)
  - sending transcripts/messages to the backend API
  - local configuration and startup scripts (systemd service files, boot scripts)

- `backend/`  
  Python-based backend API and supporting modules. Expected contents:
  - `backend/worker.py` — the analysis worker that processes conversations (see below)
  - `requirements.txt` / `pyproject.toml` — Python dependencies

- `frontend/`  
  TypeScript-based parent dashboard (single-page app). Expected contents:
  - `frontend/src/` — React/Vue/Solid components and TypeScript code
  - `frontend/public/` — static assets
  - `frontend/package.json` — project metadata and scripts
  - `frontend/styles/` or `frontend/css/` — CSS or scoped styles

- `models/` (optional)  
  Reusable data model definitions and example schemas shared between backend and frontend.

- `config/`  
  Configuration templates and example env files:
  - `.env.example` — variables like `MONGODB_URI`, `DB_NAME`, `JWT_SECRET`, etc.
  - Kubernetes/ Docker Compose manifests (if present)

- `scripts/`  
  Dev and deploy scripts (e.g., provisioning Pi image, setup scripts, backup scripts).

- `docs/`  
  Additional design documents, architecture diagrams, and privacy/security notes.

- `tests/`  
  Unit and integration tests for backend and frontend.

- `assets/`  
  Images, icons, and other assets for the app.

Note: The repository composition indicates TypeScript is the primary language (frontend), and Python is used for backend components (including worker.py).

---

## Raspberry Pi (voice capture & local runtime)
The Raspberry Pi runs the voice interface and provides a low-latency, local experience:

- Audio capture:
  - Microphone input is captured by a small client program (in `pi/`) that either:
    - performs on-device speech-to-text (if feasible), or
    - streams audio to a local service or backend STT endpoint
- Local interaction:
  - The Pi runs the chatbot logic for immediate responses (this may call local lightweight models or a remote model depending on resource constraints and privacy policy).
- Connectivity:
  - The Pi posts conversation transcripts and metadata to the backend API over HTTPS.
  - If offline, the Pi queues conversation items locally and retries when network is restored.
- Startup & service:
  - `pi/` includes systemd unit templates or a bootstrap script to ensure the voice service runs at boot.

Security and privacy considerations on the Pi:
- All network traffic to MongoDB or backend must use TLS.
- Store only minimal persistent data on the Pi; push transcripts to the secure backend as soon as possible.

---

## How conversations are saved to the database
Conversations flow from the Pi to MongoDB Atlas via the backend API:

1. The Pi sends a conversation object to the backend API (POST /conversations).
   - Conversation payload includes: child ID (or local device ID), timestamp, messages (speaker + text), optional audio references (URLs or S3/Cloud storage pointers), and metadata (device model, Pi uptime).
2. The backend API validates and persists the raw conversation into a `conversations` collection in MongoDB Atlas.
   - The initial document contains the raw transcript and minimal analysis fields (empty or `pending`).
3. The API returns an acknowledgement (conversation id) to the Pi.

This separation ensures raw data is stored safely and gives the worker an independent event-driven way to pick up new conversations for analysis.

---

## backend/worker.py — analysis pipeline (keywords, mood, flags)
The analysis worker (typically `backend/worker.py`) is responsible for automating NLP and safety checks. High-level responsibilities:

- Input:
  - Poll new or updated conversation documents (e.g., via a queue, change streams, or periodic DB query for `analysis.status: pending`)
- Processing steps:
  1. Preprocessing: clean transcripts, normalize text, split into utterances
  2. Keyword extraction: use methods like RAKE, spaCy noun/phrase extraction, or transformer-based keyphrase extraction to produce a compact list of keywords
  3. Mood/emotion inference:
     - Run a sentiment/emotion classifier (e.g., a lightweight transformer or an on-device model) to infer emotions such as happy, sad, anxious, angry, neutral
     - Produce per-utterance and overall conversation mood scores
  4. Safety & flagging rules:
     - Apply deterministic heuristics (e.g., mentions of self-harm, bullying, strangers) and/or ML classifiers trained to detect risky content
     - If a rule or model confidence passes a threshold, mark the conversation as `flagged: true` and add `flags` entries with context
  5. Assemble analysis results:
     - `analysis.keywords`: [ ... ]
     - `analysis.mood`: { overall: "happy", scores: { happy: 0.8, sad: 0.1, ... } }
     - `analysis.flags`: [ { type: "safety", reason: "...", excerpt: "..." } ]
     - `analysis.completed_at`, `analysis.status: done`
- Output:
  - Update the original conversation document with the analysis object and any derived metadata (e.g., topic tags, summary).

Design notes:
- The worker can be run as a separate process/service and scaled independently.

---

## How the app uses the analyzed data (parent dashboard)
The frontend (TypeScript SPA) consumes the enriched conversations and displays parent-facing summaries:

- Dashboard views:
  - Timeline of conversations with mood icons and flagged indicators
  - Trend charts: mood over time (daily/weekly)
  - Keyword clouds or top keywords for recent sessions
  - Flagged conversations list with excerpts and contextual information
- Conversation drill-down:
- Alerts & notifications:
  - The app can surface urgent flags for immediate parental review (configurable)
- Privacy controls:
  - Parents can see conversation summary, set retention policies, and configure thresholds for flagging

---


## Running locally / environment variables (summary)
Minimal steps and required variables (high-level):

1. Set up MongoDB Atlas cluster and create a database user.
2. Populate `.env` (backend & worker):
   - `MONGODB_URI` (Atlas connection string)
   - `DB_NAME`
   - `WORKER_POLL_INTERVAL` (optional)
   - `STT_SERVICE_URL` / credentials (if Pi streams audio to a STT)
   - `NOTIFICATION_EMAIL_CONFIG` (for alerts)
3. Backend:
   - Create virtualenv, `pip install -r requirements.txt`
   - `python backend/api.py` (or start with `uvicorn backend.api:app --reload`)
4. Worker:
   - `python backend/worker.py` (run as service or supervisor)
5. Frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev` or `npm run build`
6. Raspberry Pi:
   - Configure `pi/config.env` with backend API URL and device id
   - Install microphone drivers and dependencies
   - Start the `pi` service (systemd or script provided in `pi/`)

This README intentionally provides a concise overview. See `docs/` for detailed platform-specific setup steps.

---

## Privacy & safety notes
- Conversations contain sensitive information about children. Ensure:
  - End-to-end TLS for any network transport
  - Proper authentication (API keys, tokens) for Pi and frontend access
  - Least-privilege rules for the database user
  - Clear data retention and deletion options for parents
  - Audit logging for flagged items and parent actions
- Human-in-the-loop: flagged conversations should be reviewed by a parent/guardian before escalation.

---

## Contributing
- If you'd like to contribute:
  - Open an issue describing the feature or bug
  - Add tests for backend and frontend changes
  - Follow the code style used in TypeScript and Python modules
- For architecture changes (e.g., swapping the mood model), please add a design note in `docs/` and discuss in an issue before implementing.

---

If you'd like, I can:
- generate a more detailed step-by-step Pi setup guide,
- add the exact env file templates (.env.example),
- or produce a JSON Schema for the conversation documents to include in `models/`.
