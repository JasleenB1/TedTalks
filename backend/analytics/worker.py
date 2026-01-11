from __future__ import annotationsf
import os
import re
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.errors import PyMongoError

load_dotenv()  # loads backend/.env when you run from backend/


# -----------------------------
# Config
# -----------------------------
MONGODB_URI = os.getenv("MONGODB_URI")
DB_NAME = os.getenv("MONGODB_DB")
COLL_NAME = os.getenv("MONGODB_COLLECTION", "chat_events")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
USE_GEMINI = bool(GEMINI_API_KEY)

BATCH_LIMIT = int(os.getenv("BATCH_LIMIT", "200"))  # how many pending docs to process on startup
SLEEP_ON_IDLE_SEC = float(os.getenv("SLEEP_ON_IDLE_SEC", "0.2"))

ALLOWED_EMOTIONS = ["happy", "excited", "calm", "neutral", "sad", "anxious", "angry", "frustrated", "tired"]
ALLOWED_TOPICS = ["school", "friends", "family", "sleep", "health", "games", "story", "general"]

EMOJI_MAP = {
    "happy": "😄",
    "excited": "🤩",
    "calm": "😊",
    "neutral": "😐",
    "sad": "😢",
    "anxious": "😟",
    "angry": "😠",
    "frustrated": "😣",
    "tired": "🥱",
}

FLAG_RULES = {
    # "low" = concerning but common
    "low": [
        "\bscared\b", "\bafraid\b", "\bworry\b", "\bworried\b",
        "\bnightmare\b", "\bbad dream\b",
    ],
    # "medium" = pain/injury/sickness signals
    "medium": [
        "\bpain\b", "\bhurt\b", "\binjured\b", "\bbleed\b", "\bblood\b",
        "\bsick\b", "\bthrow up\b", "\bvomit\b",
    ],
    # "high" = urgent safety signals (keep this; even for demo it’s important)
    "high": [
        "\bkill myself\b", "\bsuicide\b", "\bself[- ]?harm\b", "\bhurt myself\b",
        "\babuse\b", "\brape\b", "\bmolest\b",
    ],
}

# -----------------------------
# Helpers
# -----------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def clamp_list_str(x: Any, max_len: int = 12) -> List[str]:
    if not isinstance(x, list):
        return []
    out = []
    for item in x:
        s = str(item).strip()
        if s:
            out.append(s)
        if len(out) >= max_len:
            break
    return out

STOPWORDS = set("""
a an the and or but if then this that those these i you he she they we it
to of in on for with at by from as is are was were be been being
my your his her their our me him them us
""".split())

def simple_keywords(text: str, k: int = 10) -> List[str]:
    tokens = re.findall(r"[A-Za-z']+", (text or "").lower())
    freq: Dict[str, int] = {}
    for t in tokens:
        if t in STOPWORDS or len(t) < 4:
            continue
        freq[t] = freq.get(t, 0) + 1
    top = sorted(freq.items(), key=lambda x: (-x[1], x[0]))[:k]
    return [w for w, _ in top]

TOPIC_HINTS = {
    "school": ["teacher", "homework", "class", "school", "sticker", "test", "grade", "math", "science"],
    "friends": ["friend", "friends", "bully", "playdate", "party", "bestie", "mean", "argue"],
    "family": ["mom", "dad", "mother", "father", "sister", "brother", "grandma", "grandpa", "aunt", "uncle"],
    "sleep": ["sleep", "tired", "sleepy", "nightmare", "bed", "wake", "dream"],
    "health": ["hurt", "sick", "doctor", "pain", "stomach", "headache", "medicine"],
    "games": ["game", "roblox", "minecraft", "fortnite", "playstation", "switch", "xbox"],
    "story": ["story", "teddy", "bear", "zoo", "adventure", "dragon", "princess"],
}

def infer_topic(text: str) -> str:
    t = (text or "").lower()
    best_topic, best_score = "general", 0
    for topic, words in TOPIC_HINTS.items():
        score = sum(1 for w in words if w in t)
        if score > best_score:
            best_topic, best_score = topic, score
    return best_topic if best_topic in ALLOWED_TOPICS else "general"

def infer_emotion(text: str) -> str:
    t = (text or "").lower()
    if any(x in t for x in ["yay", "awesome", "great", "happy", "excited", "so cool", "sticker"]):
        return "happy"
    if any(x in t for x in ["worried", "scared", "anxious", "nervous", "afraid", "what if"]):
        return "anxious"
    if any(x in t for x in ["sad", "cry", "lonely", "upset"]):
        return "sad"
    if any(x in t for x in ["angry", "mad", "hate", "furious"]):
        return "angry"
    if any(x in t for x in ["frustrated", "annoyed", "ugh"]):
        return "frustrated"
    if any(x in t for x in ["tired", "sleepy", "exhausted"]):
        return "tired"
    if any(x in t for x in ["calm", "relaxed", "okay"]):
        return "calm"
    return "neutral"

FLAG_PATTERNS = [
    "\bkill myself\b", "\bsuicide\b", "\bself harm\b", "\bhurt myself\b",
    "\brape\b", "\bsexual\b", "\babuse\b"
]

def heuristic_flag(text: str) -> bool:
    t = (text or "").lower()
    return any(re.search(p, t) for p in FLAG_PATTERNS)

def safe_summary(child_text: str) -> str:
    s = (child_text or "").strip()
    if len(s) > 160:
        s = s[:160].rstrip() + "…"
    return s

def detect_flags(child_text: str) -> dict:
    text = (child_text or "").lower()
    reasons = []
    level = None

    # check high -> medium -> low
    for lvl in ["high", "medium", "low"]:
        hits = []
        for pat in FLAG_RULES[lvl]:
            if re.search(pat, text):
                # store a readable reason (pattern stripped)
                hits.append(pat.strip(r"\b").replace(r"\b", "").replace("\\", ""))
        if hits:
            reasons.extend(hits)
            level = lvl
            break

    return {
        "flagged": bool(level),
        "flagLevel": level,                 # None if not flagged
        "flagReasons": sorted(set(reasons)) # unique reasons
    }

# -----------------------------
# Analyzer (Gemini optional)
# -----------------------------
def gemini_analyze(child_text: str, assistant_text: str) -> Dict[str, Any]:
    """
    Returns dict with:
      keywords: list[str]
      emotionLabel: str
      moodEmoji: str
      topicLabel: str
      summary: str
      flagged: bool
    """
    from google import genai

    client = genai.Client(api_key=GEMINI_API_KEY)

    prompt = f"""
Return STRICT JSON only (no markdown). Schema:
{{
  "keywords": ["..."],  // 5-12 short keywords/phrases
  "emotionLabel": "{'|'.join(ALLOWED_EMOTIONS)}",
  "moodEmoji": "😀",
  "topicLabel": "{'|'.join(ALLOWED_TOPICS)}",
  "summary": "...",     // 1 sentence
  "flagged": false      // true ONLY for self-harm, violence, abuse, or sexual content
}}

Conversation:
Child: {child_text}
Assistant: {assistant_text}
"""
    resp = client.models.generate_content(model=GEMINI_MODEL, contents=prompt)
    raw = (resp.text or "").strip()
    data = json.loads(raw)

    emo = str(data.get("emotionLabel", "neutral")).lower().strip()
    if emo not in EMOJI_MAP:
        emo = "neutral"

    topic = str(data.get("topicLabel", "general")).lower().strip()
    if topic not in ALLOWED_TOPICS:
        topic = "general"

    keywords = clamp_list_str(data.get("keywords"), 12)
    summary = str(data.get("summary") or "").strip()
    flagged = bool(data.get("flagged", False))

    return {
        "keywords": keywords,
        "emotionLabel": emo,
        "moodEmoji": str(data.get("moodEmoji") or EMOJI_MAP[emo]).strip(),
        "topicLabel": topic,
        "summary": summary,
        "flagged": flagged,
        "analysisMode": "gemini",
    }

def fallback_analyze(child_text: str, assistant_text: str) -> Dict[str, Any]:
    emo = infer_emotion(child_text)
    topic = infer_topic(child_text)
    keywords = simple_keywords((child_text or "") + " " + (assistant_text or ""), k=10)
    return {
        "keywords": keywords,
        "emotionLabel": emo,
        "moodEmoji": EMOJI_MAP.get(emo, "😐"),
        "topicLabel": topic,
        "summary": safe_summary(child_text),
        "flagged": heuristic_flag(child_text),
        "analysisMode": "fallback",
    }


# -----------------------------
# Core worker
# -----------------------------
def get_collection() -> Collection:
    if not MONGODB_URI or not DB_NAME:
        raise SystemExit("ERROR: Set MONGODB_URI and MONGODB_DB in backend/.env")
    client = MongoClient(MONGODB_URI)
    return client[DB_NAME][COLL_NAME]

def claim_doc_for_processing(coll: Collection, _id: Any) -> Optional[Dict[str, Any]]:
    """
    Atomically claim a PENDING doc -> PROCESSING so only one worker processes it.
    Returns the doc if claim succeeded, else None.
    """
    return coll.find_one_and_update(
        {"_id": _id, "analysisStatus": "PENDING"},
        {"$set": {"analysisStatus": "PROCESSING", "processingAt": now_iso()}},
        return_document=True,
    )

def analyze_and_update(coll: Collection, doc: Dict[str, Any]) -> None:
    child_text = doc.get("childText", "") or ""
    flag_info = detect_flags(child_text)
    assistant_text = doc.get("assistantText", "") or ""

    if not child_text.strip():
        # Nothing to analyze: mark done
        coll.update_one(
            {"_id": doc["_id"]},
            {"$set": {"analysisStatus": "DONE", "analyzedAt": now_iso(), "analysisMode": "empty"}}
        )
        return

    try:
        analysis = gemini_analyze(child_text, assistant_text) if USE_GEMINI else fallback_analyze(child_text, assistant_text)
    except Exception as e:
        # If Gemini fails, fallback (so you still get results)
        analysis = fallback_analyze(child_text, assistant_text)
        analysis["analysisError"] = f"gemini_failed: {str(e)[:200]}"

    # interactionCount: count docs in same conversationId (each doc = 1 interaction)
    conversation_id = doc.get("conversationId")
    interaction_count = 1
    if conversation_id:
        interaction_count = coll.count_documents({"conversationId": conversation_id, "type": "CHAT"})

    update_fields = {
        **analysis,
        "analysisStatus": "DONE",
        "analyzedAt": now_iso(),
        "interactionCount": int(interaction_count),

        # flags for parent alerting
        "flagged": flag_info["flagged"],          
        "flagLevel": flag_info["flagLevel"],
        "flagReasons": flag_info["flagReasons"],
        "flaggedAt": now_iso() if flag_info["flagged"] else None,
    }

    coll.update_one({"_id": doc["_id"]}, {"$set": update_fields})

    print(f"[worker] DONE _id={doc['_id']} emo={update_fields['emotionLabel']} topic={update_fields['topicLabel']} interactions={update_fields['interactionCount']}")

def process_pending_batch(coll: Collection, limit: int) -> int:
    """
    On startup, process already-existing PENDING docs.
    """
    pending = list(coll.find(
        {"type": "CHAT", "analysisStatus": "PENDING"},
        {"_id": 1}
    ).limit(limit))

    processed = 0
    for item in pending:
        claimed = claim_doc_for_processing(coll, item["_id"])
        if not claimed:
            continue
        try:
            analyze_and_update(coll, claimed)
            processed += 1
        except Exception as e:
            coll.update_one(
                {"_id": item["_id"]},
                {"$set": {"analysisStatus": "FAILED", "failedAt": now_iso(), "failReason": str(e)[:300]}}
            )
    return processed

def watch_inserts(coll: Collection) -> None:
    """
    Realtime: watch new inserts; if analysisStatus == PENDING, process it.
    """
    pipeline = [{"$match": {"operationType": "insert"}}]
    print(f"[worker] Realtime watch ON | {DB_NAME}.{COLL_NAME} | Gemini={USE_GEMINI}")

    with coll.watch(pipeline, full_document="updateLookup") as stream:
        for change in stream:
            doc = change.get("fullDocument") or {}
            if doc.get("type") != "CHAT":
                continue
            if doc.get("analysisStatus") != "PENDING":
                continue

            claimed = claim_doc_for_processing(coll, doc["_id"])
            if not claimed:
                continue

            try:
                analyze_and_update(coll, claimed)
            except Exception as e:
                coll.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"analysisStatus": "FAILED", "failedAt": now_iso(), "failReason": str(e)[:300]}}
                )

def main():
    coll = get_collection()

    # 1) Startup backfill for any docs already in DB
    try:
        n = process_pending_batch(coll, BATCH_LIMIT)
        if n:
            print(f"[worker] processed pending on startup: {n}")
    except Exception as e:
        print("[worker] startup pending processing error:", str(e))

    # 2) Realtime watcher
    while True:
        try:
            watch_inserts(coll)
        except PyMongoError as e:
            # Auto-reconnect loop if stream drops
            print("[worker] change stream error, retrying:", str(e))
            time.sleep(1.5)
        except Exception as e:
            print("[worker] unexpected error, retrying:", str(e))
            time.sleep(1.5)

if __name__ == "__main__":
    main()