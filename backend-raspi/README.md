# TedTalks Raspberry Pi Runtime

This folder contains the Raspberry Pi side of TedTalks: the local voice chatbot that listens to a child, responds as TedTalks the teddy bear, and stores each conversation turn in MySQL for later analysis and parent review.

The main file is [chatbot.py](/c:/Users/owake/Desktop/TedTalks/backend-raspi/chatbot.py).

## What This Program Does

For each interaction, the Pi runtime does the following:

1. Waits for the child to speak
2. Records audio from the microphone using PulseAudio
3. Uses voice activity detection to detect when the child is done talking
4. Transcribes the speech with Faster-Whisper
5. Generates a response with Ollama
6. Speaks the response back through the speaker using Kokoro TTS
7. Saves the raw child message and Teddy reply into MySQL

Each saved row is later picked up by the backend analysis worker, which adds mood, summary, topic, keywords, and alert metadata.

## High-Level Architecture

The Pi code is only one part of the full flow:

Raspberry Pi chatbot -> MySQL `events` table -> analysis worker -> API server -> frontend dashboard

This folder is responsible only for the first step: capturing the conversation and inserting raw rows into MySQL.

## Main Components In `chatbot.py`

### Audio recording

The program records from PulseAudio using:

- `parec` for microphone capture
- voice activity detection based on RMS loudness

Relevant settings near the top of the file:

- `FRAME_MS`
- `SILENCE_THRESHOLD`
- `END_SILENCE_MS`
- `MIN_SPEECH_MS`
- `MAX_RECORDING_MS`

These control how long recording continues and when speech is considered finished.

### Transcription

Speech is transcribed with Faster-Whisper:

- default model: `tiny.en`

This happens in `transcribe_audio(...)`.

### Response generation

Replies are generated with Ollama:

- default model: `gemma2:2b`

The response logic:

- tries to sound warm and child-friendly
- handles questions
- handles story requests
- adds special safety behavior for sensitive topics like bullying or feeling unsafe

This behavior lives mainly in:

- `generate_response(...)`
- `is_story_request(...)`
- `is_question(...)`
- `is_safety_sensitive(...)`

### Text-to-speech

Speech output uses Kokoro TTS:

- default voice: `af_heart`

Audio playback uses:

- `pacat`

### MySQL storage

Each conversation turn is inserted into the MySQL `events` table.

The Pi does not run analysis itself. It stores the raw event first, then the separate backend worker analyzes it later.

## MySQL Integration

### Environment variables used by the Pi runtime

`chatbot.py` reads these values from `.env`:

```env
MYSQL_HOST=...
MYSQL_PORT=3306
MYSQL_USER=...
MYSQL_PASSWORD=...
MYSQL_DB=teddy_db
DEVICE_ID=pi-1
USER_ID=child-1
```

### How MySQL is initialized

When the program starts, `init_mysql()`:

- connects to the configured MySQL database
- creates the `events` table if it does not already exist
- creates helpful indexes such as:
  - `idx_user_id`
  - `idx_device_id`
  - `idx_session_id`
  - `idx_timestamp_utc`
  - `idx_analysis_status`

### What gets inserted

When a child message and AI reply are available, `save_event_db(...)` inserts a row with:

- `user_id`
- `device_id`
- `session_id`
- `timestamp_utc`
- `child_text`
- `ai_text`
- `event_type = 'CHAT'`
- `analysis_status = 'PENDING'`

That `PENDING` state is important: it is the signal that tells the backend analysis worker there is a new conversation row waiting to be processed.

## Conversation Sessions

At program start, a `session_id` is created with `uuid.uuid4().hex`.

All turns in that run share the same `session_id`, which lets the backend:

- group related turns together
- count interactions within the same session
- show more meaningful parent summaries

## Safety Behavior

The Pi-side chatbot has explicit logic for sensitive topics.

If a child mentions things like:

- bullying
- being hurt
- feeling unsafe
- strangers
- threats
- serious sadness

the response logic shifts into a more practical safety-first mode. It:

- acknowledges the concern
- encourages the child to tell a trusted adult
- avoids making the child handle serious issues alone
- keeps the response calm and age-appropriate

This is response behavior only. The actual alerting metadata shown to parents is added later by the backend analysis worker.

## Stop Button / Shutdown

Optional GPIO support exists for a stop button on pin `22`.

If available:

- the script can stop through the GPIO button
- `Ctrl+C` is also handled cleanly
- the MySQL connection is closed on shutdown

## Models And Defaults

Current defaults in `chatbot.py`:

- Whisper: `tiny.en`
- Ollama model: `gemma2:2b`
- TTS voice: `af_heart`
- TTS speed: `1.0`

You can change these near the top of the file.

## Runtime Requirements

### Hardware

- Raspberry Pi
- microphone
- speaker or Bluetooth audio output

### Software

- Python 3
- PulseAudio tools installed
  - `parec`
  - `pacat`
- Ollama installed and running
- required Python packages for:
  - `numpy`
  - `faster_whisper`
  - `kokoro`
  - `ollama`
  - `python-dotenv`
  - `mysql-connector-python`
- optionally `gpiozero` for the stop button

## How To Run On The Pi

From the Raspberry Pi environment:

```bash
python3 backend-raspi/chatbot.py
```

When it starts successfully, it will:

- load Whisper and Kokoro
- connect to MySQL
- show the active `USER_ID`
- generate a fresh `session_id`
- begin listening for speech

## What Happens After A Row Is Saved

The Pi runtime does not itself:

- compute mood
- summarize the conversation
- decide whether a parent alert should be shown

Instead, after the row is inserted:

1. `backend/analytics/worker.py` polls the `events` table
2. it finds rows with `analysis_status = 'PENDING'`
3. it analyzes `child_text` and `ai_text`
4. it updates the same row with:
   - `summary_text`
   - `emotion_label`
   - `mood_emoji`
   - `topic_label`
   - `keywords_json`
   - `flagged`
   - `flag_reasons_json`
   - `analysis_status = 'DONE'`
5. the API server and frontend then display that analyzed result to parents

## Demo Workflow

For a full end-to-end demo:

1. Start the backend API on your demo machine:

```powershell
cd C:\Users\owake\Desktop\TedTalks
python backend\api_server.py
```

2. Start the analysis worker:

```powershell
cd C:\Users\owake\Desktop\TedTalks
python backend\analytics\worker.py
```

3. Start the frontend:

```powershell
cd C:\Users\owake\Desktop\TedTalks\frontend
npm run dev
```

4. Start the Pi runtime on the Raspberry Pi:

```bash
python3 backend-raspi/chatbot.py
```

5. Speak into the Pi microphone
6. Watch the new event appear in MySQL, get analyzed, and then show up in the parent dashboard

## Notes

- This Pi runtime writes raw conversation turns into MySQL
- Parent privacy is handled later in the frontend/API layer by summarizing non-flagged conversations
- Flagged conversations can still be shown in raw form for safety review

## Summary

`backend-raspi/chatbot.py` is the ingestion point of TedTalks.

It turns live child speech into:

- a Teddy reply
- a saved MySQL event row

That row then drives the rest of the system.
