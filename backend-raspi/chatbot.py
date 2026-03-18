#!/usr/bin/env python3
"""
Voice Chatbot (PulseAudio Version)
- Name: TedTalks
- Logic: Sincere, context-aware, strict but gentle safety rules.
- Visuals: Red/Green indicators.
"""

import sys
import os
import time
import subprocess
import wave
import re
import signal
import numpy as np
from pathlib import Path
from datetime import datetime, timezone
import uuid
import warnings

# Suppress GPIO warnings
warnings.filterwarnings("ignore", category=UserWarning, module="gpiozero")

import ollama
from kokoro import KPipeline
from faster_whisper import WhisperModel
from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error

# Optional GPIO stop button
try:
    from gpiozero import Button
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False

# ===== COLORS =====
RED = "\033[91m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

# ===== Configuration =====
STOP_BUTTON_PIN = 22
PREF_SAMPLE_RATE = 16000
PREF_CHANNELS = 1

# --- VAD Settings ---
FRAME_MS = 30
SILENCE_THRESHOLD = 250
END_SILENCE_MS = 600
MIN_SPEECH_MS = 250
MAX_RECORDING_MS = 15000

# Models
WHISPER_MODEL = "tiny.en"
LLM_MODEL = "gemma2:2b"
TTS_VOICE = "af_heart"
TTS_SPEED = 1.0

# Conversation
AUTO_RESTART_DELAY = 1.0
TEMP_WAV = Path("/tmp/recording.wav")
MIC_TARGET = os.environ.get("PULSE_SOURCE")
MAX_HISTORY_TURNS = 4

# ===== MySQL =====
load_dotenv()
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DB = os.getenv("MYSQL_DB", "teddy_db")

DEVICE_ID = os.getenv("DEVICE_ID", "pi-1")
USER_ID = os.getenv("USER_ID", "child-1")

mysql_conn = None
conversation_history = []
SHUTDOWN_REQUESTED = False


def handle_sigint(signum, frame):
    global SHUTDOWN_REQUESTED
    SHUTDOWN_REQUESTED = True
    raise KeyboardInterrupt


signal.signal(signal.SIGINT, handle_sigint)


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def init_mysql():
    global mysql_conn
    try:
        mysql_conn = mysql.connector.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DB,
            autocommit=False
        )

        cursor = mysql_conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                user_id VARCHAR(100) NOT NULL,
                device_id VARCHAR(100) NOT NULL,
                session_id VARCHAR(64) NOT NULL,
                timestamp_utc DATETIME(6) NOT NULL,
                child_text TEXT NOT NULL,
                ai_text TEXT NOT NULL,
                event_type VARCHAR(50) NOT NULL DEFAULT 'CHAT',
                analysis_status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
                INDEX idx_user_id (user_id),
                INDEX idx_device_id (device_id),
                INDEX idx_session_id (session_id),
                INDEX idx_timestamp_utc (timestamp_utc),
                INDEX idx_analysis_status (analysis_status)
            )
        """)
        mysql_conn.commit()
        cursor.close()

        print(f"{GREEN}✅ MySQL connected{RESET}")

    except Exception as e:
        mysql_conn = None
        print(f"{RED}❌ MySQL connection failed: {e}{RESET}")


def save_event_db(user_id, device_id, session_id, child_text, assistant_text):
    event = {
        "userId": user_id,
        "deviceId": device_id,
        "sessionId": session_id,
        "timestamp": now_iso(),
        "childText": child_text,
        "aiText": assistant_text,
        "type": "CHAT",
        "analysisStatus": "PENDING"
    }

    if mysql_conn is not None:
        try:
            if not mysql_conn.is_connected():
                mysql_conn.reconnect(attempts=2, delay=1)

            cursor = mysql_conn.cursor()
            cursor.execute("""
                INSERT INTO events (
                    user_id,
                    device_id,
                    session_id,
                    timestamp_utc,
                    child_text,
                    ai_text,
                    event_type,
                    analysis_status
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id,
                device_id,
                session_id,
                datetime.now(timezone.utc).replace(tzinfo=None),
                child_text,
                assistant_text,
                "CHAT",
                "PENDING"
            ))
            mysql_conn.commit()
            event["id"] = cursor.lastrowid
            cursor.close()
            return event
        except Exception as e:
            print(f"{RED}❌ Failed to save event to MySQL: {e}{RESET}")

    event["id"] = uuid.uuid4().hex
    return event


# ===== Init =====
def init_models():
    print(f"{CYAN}🚀 Starting Voice Chatbot...{RESET}")
    print(f"{YELLOW}📦 Loading models (please wait)...{RESET}")
    whisper = WhisperModel(
        WHISPER_MODEL,
        device="cpu",
        compute_type="int8",
        cpu_threads=4,
        download_root=str(Path.home() / ".cache" / "whisper")
    )
    tts = KPipeline(lang_code='a')
    print(f"{GREEN}✅ Models loaded!{RESET}\n")
    return whisper, tts


def init_button():
    if not GPIO_AVAILABLE:
        return None
    try:
        return Button(STOP_BUTTON_PIN, pull_up=True, bounce_time=0.1)
    except Exception:
        return None


def check_stop(stop_button):
    return SHUTDOWN_REQUESTED or bool(stop_button and stop_button.is_pressed)


# ===== PulseAudio Recording =====
def _spawn_pulse_record(rate, channels, target):
    cmd = [
        "parec",
        "--format=s16le",
        f"--rate={rate}",
        f"--channels={channels}",
        "--latency-msec=50"
    ]
    if target:
        cmd += [f"--device={target}"]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)


def _select_record_pipeline(target):
    attempts = [(PREF_SAMPLE_RATE, PREF_CHANNELS), (44100, 1), (48000, 1)]
    for rate, ch in attempts:
        if SHUTDOWN_REQUESTED:
            return None, None, None, None, "Stopped"
        proc = _spawn_pulse_record(rate, ch, target)
        bytes_per_sample = 2
        frame_bytes = int(rate * FRAME_MS / 1000) * bytes_per_sample * ch
        time.sleep(0.08)
        chunk = proc.stdout.read(frame_bytes)
        if chunk:
            return proc, rate, ch, chunk, ""
        proc.terminate()
        proc.wait()
    return None, None, None, None, "No PulseAudio device found"


def record_with_vad(stop_button=None):
    print(f"\n{RED}{BOLD}🔴 REC (Listening...){RESET}")

    proc, rate, ch, first_chunk, err = _select_record_pipeline(MIC_TARGET)
    if not proc:
        if err != "Stopped":
            print(f"{RED}❌ {err}{RESET}")
        return None, None, None

    bytes_per_sample = 2
    frame_bytes = int(rate * FRAME_MS / 1000) * bytes_per_sample * ch
    audio_buffer = bytearray()

    try:
        threshold = SILENCE_THRESHOLD
        is_speaking = False
        silence_ms = 0
        speech_ms = 0
        total_ms = 0
        start_time = time.time()

        if first_chunk:
            audio_buffer.extend(first_chunk)

        while True:
            if check_stop(stop_button):
                raise KeyboardInterrupt

            chunk = proc.stdout.read(frame_bytes)
            if not chunk:
                break

            samples = np.frombuffer(chunk, dtype=np.int16).astype(np.float32)
            rms = float(np.sqrt(np.mean(samples * samples))) if len(samples) else 0.0

            level = int(rms / 100)
            bar = '█' * min(level, 20)
            print(f"\r  {RED}Vol:{RESET} {bar:<20} ", end="", flush=True)

            if is_speaking:
                audio_buffer.extend(chunk)
                if rms < threshold:
                    silence_ms += FRAME_MS
                else:
                    silence_ms = 0
                    speech_ms += FRAME_MS

                if silence_ms >= END_SILENCE_MS and speech_ms >= MIN_SPEECH_MS:
                    break
                if total_ms >= MAX_RECORDING_MS:
                    break
            else:
                if rms > threshold:
                    is_speaking = True
                    audio_buffer.extend(chunk)
                    speech_ms += FRAME_MS

            total_ms += FRAME_MS
            if (time.time() - start_time) > 20:
                break

    except KeyboardInterrupt:
        print()
        return None, None, None
    finally:
        try:
            proc.terminate()
            proc.wait(timeout=1)
        except Exception:
            pass

    print()

    if audio_buffer and len(audio_buffer) > 1000:
        return bytes(audio_buffer), rate, ch
    return None, None, None


def save_wav(audio_data, filepath, sample_rate, channels):
    with wave.open(str(filepath), 'wb') as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(audio_data)


def transcribe_audio(whisper_model, audio_path):
    print(f"\n{YELLOW}🧠 Transcribing...{RESET}")
    try:
        segments, _ = whisper_model.transcribe(
            str(audio_path),
            language="en",
            beam_size=1,
            best_of=1
        )
        text = " ".join(seg.text.strip() for seg in segments).strip()
        text = re.sub(r"\s+", " ", text).strip()

        if not text:
            return ""

        low = text.lower()
        if low in ["you", "thank you", "bye"]:
            return ""

        return text
    except KeyboardInterrupt:
        raise
    except Exception as e:
        print(f"Transcription error: {e}")
        return ""


# ===== Response Logic Helpers =====
def trim_history():
    global conversation_history
    max_messages = MAX_HISTORY_TURNS * 2
    if len(conversation_history) > max_messages:
        conversation_history = conversation_history[-max_messages:]


def is_story_request(user_text):
    low = user_text.lower()
    story_patterns = [
        "tell me a story",
        "story",
        "bedtime story",
        "make up a story",
        "say a story"
    ]
    return any(p in low for p in story_patterns)


def is_question(user_text):
    return "?" in user_text.strip() or user_text.lower().startswith(
        ("what", "why", "how", "when", "where", "who", "can", "could", "would", "is", "are", "do", "does")
    )


def is_safety_sensitive(user_text):
    low = user_text.lower()
    keywords = [
        "bullied", "bully", "bullying", "hurt", "hurt me", "scared", "afraid",
        "unsafe", "secret", "stranger", "followed", "threat", "threatened",
        "sad", "abuse", "touched me", "mean to me", "picking on me",
        "school problem", "being mean", "harassing me", "harassment",
        "someone is hurting me", "someone hurt me", "i feel unsafe"
    ]
    return any(k in low for k in keywords)


def looks_weak(reply, user_text):
    low = reply.lower().strip()

    if len(reply.split()) < 6:
        return True

    weak_exact = {
        "ok",
        "okay",
        "sure",
        "alright",
        "i can do that",
        "let me tell you a story",
        "here's a story",
    }
    if low in weak_exact:
        return True

    if is_story_request(user_text):
        if len(reply.split()) < 22:
            return True
        if "i'll tell you a story" in low or "let me tell you a story" in low:
            return True

    return False


def clean_reply(reply):
    reply = reply.strip()
    reply = re.sub(r"\s+", " ", reply).strip()
    return reply


def ensure_followup_question(reply, safety_mode=False, story_mode=False):
    if "?" in reply:
        return reply

    if safety_mode:
        return reply.rstrip(". ") + " Who is a trusted grown-up you could tell first?"
    if story_mode:
        return reply.rstrip(". ") + " Did you like that story?"
    return reply.rstrip(". ") + " What would you like to talk about next?"


def generate_response(user_text):
    global conversation_history
    print(f"{YELLOW}💭 Thinking...{RESET}")

    story_mode = is_story_request(user_text)
    question_mode = is_question(user_text)
    safety_mode = is_safety_sensitive(user_text)

    system_prompt = (
        "You are TedTalks, a kind, calm, supportive teddy bear talking to a child. "
        "You should sound gentle, clear, practical, and child-friendly.\n\n"

        "CORE RULES:\n"
        "1. Your name is TedTalks.\n"
        "2. Speak in a warm, calm, reassuring way.\n"
        "3. Do not pretend to have human feelings or a body.\n"
        "4. Do not say things like 'my heart aches', 'I feel devastated', or similar human emotional claims.\n"
        "5. Keep serious responses calm and solution-focused.\n"
        "6. Never joke about serious problems.\n"
        "7. Never make the child sound responsible for fixing dangerous or serious situations alone.\n"
        "8. Start by briefly acknowledging the problem in a simple kind way.\n"
        "9. Then give clear next steps.\n"
        "10. End most replies with one gentle follow-up question.\n"
        "11. Use simple English a child can understand.\n\n"

        "VERY IMPORTANT SAFETY RULE:\n"
        "If the child mentions bullying, fear, being hurt, feeling unsafe, threats, abuse, strangers, dangerous secrets, "
        "or anything emotionally serious, you MUST:\n"
        "1. Briefly acknowledge it kindly without sounding dramatic.\n"
        "2. Clearly say the child should tell a trusted grown-up right away.\n"
        "3. Make it clear it is not their fault.\n"
        "4. Make it clear they do not have to handle it alone.\n"
        "5. Give only simple, safe, age-appropriate advice after telling them to speak to a trusted adult first.\n"
        "6. End with one gentle practical follow-up question.\n\n"

        "BULLYING RULE:\n"
        "If the child says they are being bullied, the response must focus on practical support. "
        "The first main step must be telling a trusted adult such as a parent, teacher, principal, or school counselor. "
        "After that, you may suggest staying near supportive friends, walking away if safe, saving messages if bullying happens online, "
        "and using a calm strong voice. Do not make the feelings bigger than necessary. Be supportive and solution-focused.\n\n"

        "STORY RULE:\n"
        "If asked for a story, tell the full story right away in 4 to 6 complete sentences with a clear ending, then ask one short follow-up question.\n\n"

        "QUESTION RULE:\n"
        "If the child asks a question, answer directly and clearly, then ask one gentle follow-up question when helpful.\n\n"

        "LENGTH RULE:\n"
        "Normal replies should usually be 2 to 4 short sentences.\n"
        "Safety replies should usually be 4 to 5 clear sentences.\n"
        "Story replies should usually be 4 to 6 sentences plus one short follow-up question.\n\n"

        "NEVER DO THESE THINGS:\n"
        "- Do not say 'As an AI'\n"
        "- Do not use bullet points unless asked\n"
        "- Do not sound overly dramatic\n"
        "- Do not sound overly personal\n"
        "- Do not leave the answer unfinished\n"
    )

    effective_user_text = user_text
    if story_mode:
        effective_user_text += (
            "\nTell the full story now in 4 to 6 sentences with a clear ending, then ask one short follow-up question."
        )
    elif safety_mode:
        effective_user_text += (
            "\nRespond calmly and practically. "
            "First briefly acknowledge the problem. "
            "Then clearly tell the child to talk to a trusted grown-up right away. "
            "Then give 1 or 2 simple safe next steps. "
            "End with one gentle practical follow-up question."
        )
    elif question_mode:
        effective_user_text += "\nAnswer clearly and kindly, then end with one gentle follow-up question."
    else:
        effective_user_text += "\nReply warmly and clearly, then end with one gentle follow-up question."

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(conversation_history)
    messages.append({"role": "user", "content": effective_user_text})

    try:
        resp = ollama.chat(
            model=LLM_MODEL,
            messages=messages,
            options={
                "temperature": 0.35,
                "top_p": 0.9,
                "repeat_penalty": 1.1,
                "num_predict": 130
            }
        )

        reply = clean_reply(resp["message"]["content"])

        if story_mode and looks_weak(reply, user_text):
            retry_messages = messages + [
                {"role": "assistant", "content": reply},
                {
                    "role": "user",
                    "content": (
                        "Please answer again with the full story now. "
                        "Make it 4 to 6 sentences with a beginning, middle, and ending, then ask one short follow-up question."
                    )
                }
            ]

            retry_resp = ollama.chat(
                model=LLM_MODEL,
                messages=retry_messages,
                options={
                    "temperature": 0.45,
                    "top_p": 0.92,
                    "repeat_penalty": 1.1,
                    "num_predict": 140
                }
            )
            reply = clean_reply(retry_resp["message"]["content"])

        reply = ensure_followup_question(reply, safety_mode=safety_mode, story_mode=story_mode)

        conversation_history.append({"role": "user", "content": user_text})
        conversation_history.append({"role": "assistant", "content": reply})
        trim_history()

        return reply

    except KeyboardInterrupt:
        raise
    except Exception as e:
        print(f"{RED}Ollama error: {e}{RESET}")
        fallback = "I’m having a little trouble thinking right now, but I’m still here with you. What would you like to say next?"
        return fallback


def _to_numpy_audio(audio):
    try:
        import torch
        if isinstance(audio, torch.Tensor):
            audio = audio.detach().cpu().float().numpy()
    except Exception:
        pass
    return np.squeeze(np.asarray(audio, dtype=np.float32))


def speak_text(tts_pipeline, text):
    print(f"{GREEN}🔊 SPEAKING...{RESET}")
    proc = None
    try:
        sr = int(getattr(tts_pipeline, "sample_rate", 24000))
        audio_segments = []

        gen = tts_pipeline(text, voice=TTS_VOICE, speed=TTS_SPEED)
        for _, _, audio in gen:
            if SHUTDOWN_REQUESTED:
                raise KeyboardInterrupt
            audio_segments.append(_to_numpy_audio(audio))

        if not audio_segments:
            return

        full_audio = np.concatenate(audio_segments)
        pcm16 = (np.clip(full_audio, -1.0, 1.0) * 32767.0).astype(np.int16).tobytes()

        play_cmd = ["pacat", "--playback", "--format=s16le", f"--rate={sr}", "--channels=1"]
        proc = subprocess.Popen(play_cmd, stdin=subprocess.PIPE)

        if SHUTDOWN_REQUESTED:
            raise KeyboardInterrupt

        proc.communicate(pcm16)

    except KeyboardInterrupt:
        if proc:
            try:
                proc.kill()
            except Exception:
                pass
        print(f"\n{RED}⛔ Speech Interrupted.{RESET}")
        raise

    except Exception as e:
        print(f"❌ TTS Error: {e}")


# ===== Main Loop =====
def main():
    global mysql_conn

    try:
        whisper_model, tts_pipeline = init_models()
        init_mysql()
        stop_button = init_button()
        session_id = uuid.uuid4().hex

        print(f"\n{CYAN}{BOLD}🤖 VOICE CHATBOT READY (I am TedTalks){RESET}")
        print(f"👤 USER={USER_ID}  🔗 SESSION={session_id}")

        while True:
            try:
                if check_stop(stop_button):
                    break

                audio_data, rate, ch = record_with_vad(stop_button=stop_button)

                if check_stop(stop_button):
                    break

                if audio_data:
                    save_wav(audio_data, TEMP_WAV, rate, ch)

                    user_text = transcribe_audio(whisper_model, TEMP_WAV)

                    if check_stop(stop_button):
                        break

                    if user_text:
                        print(f"{CYAN}📝 You: {user_text}{RESET}")

                        reply = generate_response(user_text)

                        if check_stop(stop_button):
                            break

                        print(f"{GREEN}🤖 TedTalks: {reply}{RESET}\n")

                        save_event_db(USER_ID, DEVICE_ID, session_id, user_text, reply)

                        speak_text(tts_pipeline, reply)

                        if check_stop(stop_button):
                            break

                        print(f"{YELLOW}⏸️  Resuming in 1.0s...{RESET}")
                        time.sleep(AUTO_RESTART_DELAY)

            except KeyboardInterrupt:
                break
            except Exception as e:
                if check_stop(stop_button):
                    break
                print(f"{RED}❌ Error: {e}{RESET}")
                time.sleep(1)

    except KeyboardInterrupt:
        pass
    finally:
        try:
            if mysql_conn is not None and mysql_conn.is_connected():
                mysql_conn.close()
        except Exception:
            pass

        try:
            print(f"\n{RED}⛔ Stopping TedTalks...{RESET}")
        except Exception:
            pass

    print("\n👋 Goodbye!")
    sys.exit(0)


if __name__ == "__main__":
    main()