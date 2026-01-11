#!/usr/bin/env python3
"""
Voice Chatbot (PulseAudio Version)
- Name: TedTalks
- Logic: Safety First (Adult Referral), Comfort, Structured Stories.
- Visuals: Red/Green indicators.
"""

import sys
import os
import time
import subprocess
import wave
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
from pymongo import MongoClient

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
LLM_MODEL = "gemma3:270m"
TTS_VOICE = "af_heart"
TTS_SPEED = 1.0 

# Conversation
AUTO_RESTART_DELAY = 1.5 
TEMP_WAV = Path("/tmp/recording.wav")
MIC_TARGET = os.environ.get("PULSE_SOURCE")

# ===== MongoDB =====
load_dotenv()
MONGO_URI = os.getenv("MONGO_URI")
DB_NAME = os.getenv("MONGO_DB_NAME", "teddy_db")
DEVICE_ID = os.getenv("DEVICE_ID", "pi-1")
USER_ID = os.getenv("USER_ID", "child-1")

mongo_client = None
events_col = None

def now_iso():
    return datetime.now(timezone.utc).isoformat()

def init_mongo():
    global mongo_client, events_col
    if not MONGO_URI: return
    try:
        import certifi
        mongo_client = MongoClient(MONGO_URI, tls=True, tlsCAFile=certifi.where())
        db = mongo_client[DB_NAME]
        events_col = db["events"]
        print(f"{GREEN}✅ Mongo connected{RESET}")
    except Exception as e:
        print(f"{RED}❌ Mongo connection failed: {e}{RESET}")

def save_event_db(user_id, device_id, session_id, child_text, assistant_text):
    event = {
        "userId": user_id, "deviceId": device_id, "sessionId": session_id,
        "timestamp": now_iso(), "childText": child_text, "aiText": assistant_text,
        "type": "CHAT", "analysisStatus": "PENDING"
    }
    if events_col is not None:
        try:
            res = events_col.insert_one(event)
            event["id"] = str(res.inserted_id)
            return event
        except Exception: pass
    event["id"] = uuid.uuid4().hex
    return event

# ===== Init =====
def init_models():
    print(f"{CYAN}🚀 Starting Voice Chatbot...{RESET}")
    print(f"{YELLOW}📦 Loading models (please wait)...{RESET}")
    whisper = WhisperModel(WHISPER_MODEL, device="cpu", compute_type="int8", cpu_threads=4, download_root=str(Path.home() / ".cache" / "whisper"))
    tts = KPipeline(lang_code='a')
    print(f"{GREEN}✅ Models loaded!{RESET}\n")
    return whisper, tts

def init_button():
    if not GPIO_AVAILABLE: return None
    try:
        return Button(STOP_BUTTON_PIN, pull_up=True, bounce_time=0.1)
    except: return None

def check_stop(stop_button):
    return bool(stop_button and stop_button.is_pressed)

# ===== PulseAudio Recording =====
def _spawn_pulse_record(rate, channels, target):
    cmd = ["parec", "--format=s16le", f"--rate={rate}", f"--channels={channels}", "--latency-msec=50"]
    if target: cmd += [f"--device={target}"]
    return subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

def _select_record_pipeline(target):
    attempts = [(PREF_SAMPLE_RATE, PREF_CHANNELS), (44100, 1), (48000, 1)]
    for rate, ch in attempts:
        proc = _spawn_pulse_record(rate, ch, target)
        bytes_per_sample = 2
        frame_bytes = int(rate * FRAME_MS / 1000) * bytes_per_sample * ch
        time.sleep(0.1)
        chunk = proc.stdout.read(frame_bytes)
        if chunk: return proc, rate, ch, chunk, ""
        proc.terminate()
    return None, None, None, None, "No PulseAudio device found"

def record_with_vad(stop_button=None):
    # RED INDICATOR FOR RECORDING
    print(f"\n{RED}{BOLD}🔴 REC (Listening...){RESET}")
    
    proc, rate, ch, first_chunk, err = _select_record_pipeline(MIC_TARGET)
    if not proc:
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

        if first_chunk: audio_buffer.extend(first_chunk)

        while True:
            if check_stop(stop_button): raise KeyboardInterrupt
            
            chunk = proc.stdout.read(frame_bytes)
            if not chunk: break

            samples = np.frombuffer(chunk, dtype=np.int16).astype(np.float32)
            rms = float(np.sqrt(np.mean(samples * samples)))
            
            # Visual Level Meter
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
                elif total_ms >= MAX_RECORDING_MS:
                    break
            else:
                if rms > threshold:
                    is_speaking = True
                    audio_buffer.extend(chunk)

            total_ms += FRAME_MS
            if (time.time() - start_time) > 20: break

    except KeyboardInterrupt:
        return None, None, None
    finally:
        proc.terminate()
        proc.wait()

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
        segments, _ = whisper_model.transcribe(str(audio_path), language="en")
        text = " ".join(seg.text.strip() for seg in segments).strip()
        if not text or text.lower() in ["you", "thank you", "bye"]:
            return ""
        return text
    except Exception as e:
        print(f"Transcription error: {e}")
        return ""

def generate_response(user_text):
    print(f"{YELLOW}💭 Thinking...{RESET}")
    
    # 🔧 FIX: UPDATED PROMPT FOR SPECIFIC KEYWORDS
    system_prompt = (
        "You are a wise, comforting, and magical teddy bear named TedTalks. "
        "1. IDENTITY: Your name is TedTalks. Never say you are the child. "
        "2. IMPORTANT SAFETY RULE: If the child says words like 'help', 'scared', 'bullied', 'sick', or 'hurt', you MUST gently but clearly tell them: 'Please go tell a grown-up or your parents about this right now.' Then offer comfort. "
        "3. STORYTELLING: If asked for a story, tell a LOGICAL story with a clear beginning, middle, and happy ending. "
        "   - If the child is scared of something, make the story about a friendly version of that thing. "
        "   - Keep stories medium length (4-6 sentences). "
        "4. TONE: Be calm, kind, and use simple words."
    )

    try:
        resp = ollama.chat(
            model=LLM_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text}
            ]
        )
        return resp["message"]["content"].strip()
    except Exception as e:
        return "I'm having a little trouble thinking right now."

def _to_numpy_audio(audio):
    try:
        import torch
        if isinstance(audio, torch.Tensor):
            audio = audio.detach().cpu().float().numpy()
    except: pass
    return np.squeeze(np.asarray(audio, dtype=np.float32))

def speak_text(tts_pipeline, text):
    print(f"{GREEN}🔊 SPEAKING...{RESET}")
    proc = None
    try:
        sr = int(getattr(tts_pipeline, "sample_rate", 24000))
        audio_segments = []
        
        gen = tts_pipeline(text, voice=TTS_VOICE, speed=TTS_SPEED)
        for _, _, audio in gen:
            audio_segments.append(_to_numpy_audio(audio))

        if not audio_segments: return

        full_audio = np.concatenate(audio_segments)
        pcm16 = (np.clip(full_audio, -1.0, 1.0) * 32767.0).astype(np.int16).tobytes()

        play_cmd = ["pacat", "--playback", "--format=s16le", f"--rate={sr}", "--channels=1"]
        proc = subprocess.Popen(play_cmd, stdin=subprocess.PIPE)
        proc.communicate(pcm16) 
    
    # Instant kill on Ctrl+C during speech
    except KeyboardInterrupt:
        if proc: proc.kill()
        print(f"\n{RED}⛔ Speech Interrupted.{RESET}")
        raise KeyboardInterrupt
        
    except Exception as e:
        print(f"❌ TTS Error: {e}")

# ===== Main Loop =====
def main():
    try:
        whisper_model, tts_pipeline = init_models()
        init_mongo()
        stop_button = init_button()
        session_id = uuid.uuid4().hex

        print(f"\n{CYAN}{BOLD}🤖 VOICE CHATBOT READY (I am TedTalks){RESET}")
        print(f"👤 USER={USER_ID}  🔗 SESSION={session_id}")

        while True:
            try:
                if check_stop(stop_button): break

                # 1. Record
                audio_data, rate, ch = record_with_vad(stop_button=stop_button)

                if audio_data:
                    save_wav(audio_data, TEMP_WAV, rate, ch)
                    
                    # 2. Transcribe
                    user_text = transcribe_audio(whisper_model, TEMP_WAV)

                    if user_text:
                        print(f"{CYAN}📝 You: {user_text}{RESET}")
                        
                        # 3. Generate Response
                        reply = generate_response(user_text)
                        print(f"{GREEN}🤖 TedTalks: {reply}{RESET}\n")

                        save_event_db(USER_ID, DEVICE_ID, session_id, user_text, reply)

                        # 4. Speak
                        speak_text(tts_pipeline, reply)
                        
                        print(f"{YELLOW}⏸️  Resuming in 1.5s...{RESET}")
                        time.sleep(AUTO_RESTART_DELAY)
                else:
                    pass

            except KeyboardInterrupt:
                print(f"\n{RED}⛔ Exiting immediately...{RESET}")
                break
            except Exception as e:
                print(f"{RED}❌ Error: {e}{RESET}")
                time.sleep(2)

    except KeyboardInterrupt:
        pass 

    print("\n👋 Goodbye!")
    sys.exit(0)

if __name__ == "__main__":
    main()