# TedTalks Voice Chatbot (Raspberry Pi + PulseAudio)

A local voice chatbot for Raspberry Pi that:
- Listens through a mic using **PulseAudio** (`parec`) + **VAD** (voice activity detection)
- Transcribes speech with **Faster-Whisper**
- Generates a reply with **Ollama** (LLM)
- Speaks back using **Kokoro TTS** + PulseAudio playback (`pacat`)
- Optionally logs chats to **MongoDB Atlas**
- Optionally supports a **GPIO stop button** on pin `22`

---

## ✅ Requirements

### Hardware
- Raspberry Pi
- Microphone (USB mic recommended)
- Bluetooth speaker (or any PulseAudio output)

### Software
- Raspberry Pi OS with PulseAudio tools installed (`parec`, `pacat`, `bluetoothctl`)
- Python 3
- Ollama installed + model pulled

---

## 🧠 Models Used (defaults in `chatbot.py`)
- Whisper: `tiny.en`
- LLM: `gemma3:270m`
- TTS voice: `af_heart`

You can change these at the top of `chatbot.py`.

---

## 🔌 Connect to the Raspberry Pi (SSH)

From your laptop:

```bash
ssh shehacks10@172.23.43.179
