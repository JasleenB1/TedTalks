from __future__ import annotations
import os
import re
import json
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
import mysql.connector
from mysql.connector import Error

load_dotenv()  # loads backend/.env when you run from backend/


# -----------------------------
# Config
# -----------------------------
MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DB = os.getenv("MYSQL_DB", "teddy_db")

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
USE_GEMINI = bool(GEMINI_API_KEY)

BATCH_LIMIT = int(os.getenv("BATCH_LIMIT", "200"))  # how many pending rows to process on startup
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

FLAG_PATTERNS = [
    r"\bbully\b", r"\bbullied\b", r"\bbullying\b",
    r"\bharass\b", r"\bharassing\b", r"\bthreat\b", r"\bthreatened\b",
    r"\bmean to me\b", r"\bpicked on\b",
    r"\bkill myself\b", r"\bsuicide\b", r"\bself[- ]?harm\b", r"\bhurt myself\b",
    r"\babuse\b", r"\brape\b", r"\bmolest\b", r"\bsexual\b",
]


# -----------------------------
# Helpers
# -----------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def now_mysql_dt() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")


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
    "friends": ["friend", "friends", "bully", "bullied", "bullying", "playdate", "party", "bestie", "mean", "argue", "harass", "threat"],
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

    if any(x in t for x in [
        "bullied", "bully", "bullying", "harassed", "harassing", "threatened",
        "unsafe", "scared", "afraid", "worried", "anxious", "nervous", "what if"
    ]):
        return "anxious"
    if any(x in t for x in ["sad", "cry", "lonely", "upset", "mean to me", "picked on"]):
        return "sad"
    if any(x in t for x in ["angry", "mad", "hate", "furious"]):
        return "angry"
    if any(x in t for x in ["frustrated", "annoyed", "ugh"]):
        return "frustrated"
    if any(x in t for x in ["tired", "sleepy", "exhausted"]):
        return "tired"
    if any(x in t for x in ["calm", "relaxed", "okay"]):
        return "calm"
    if any(x in t for x in ["yay", "awesome", "great", "happy", "excited", "so cool", "sticker"]):
        return "happy"

    return "neutral"


def heuristic_flag(text: str) -> bool:
    t = (text or "").lower()
    return any(re.search(p, t) for p in FLAG_PATTERNS)


def extract_flag_reasons(text: str) -> List[str]:
    t = (text or "").lower()
    reasons: List[str] = []

    for pat in FLAG_PATTERNS:
        if re.search(pat, t):
            cleaned = pat.replace(r"\b", "").replace("\\", "")
            if cleaned not in reasons:
                reasons.append(cleaned)

    return reasons


def safe_summary(child_text: str) -> str:
    s = (child_text or "").strip()
    if len(s) > 160:
        s = s[:160].rstrip() + "…"
    return s


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
  "keywords": ["..."],
  "emotionLabel": "{'|'.join(ALLOWED_EMOTIONS)}",
  "moodEmoji": "😀",
  "topicLabel": "{'|'.join(ALLOWED_TOPICS)}",
  "summary": "...",
  "flagged": false
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
# MySQL Core
# -----------------------------
def get_connection():
    try:
        conn = mysql.connector.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DB,
            autocommit=False
        )
        return conn
    except Error as e:
        raise SystemExit(f"ERROR: Could not connect to MySQL: {e}")


def ensure_column(conn, table_name: str, column_name: str, column_sql: str) -> None:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*)
        FROM information_schema.columns
        WHERE table_schema = %s
          AND table_name = %s
          AND column_name = %s
    """, (MYSQL_DB, table_name, column_name))
    exists = cursor.fetchone()[0] > 0
    if not exists:
        cursor.execute(f"ALTER TABLE {table_name} ADD COLUMN {column_sql}")
        conn.commit()
    cursor.close()


def ensure_index(conn, table_name: str, index_name: str, create_sql: str) -> None:
    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*)
        FROM information_schema.statistics
        WHERE table_schema = %s
          AND table_name = %s
          AND index_name = %s
    """, (MYSQL_DB, table_name, index_name))
    exists = cursor.fetchone()[0] > 0
    if not exists:
        cursor.execute(create_sql)
        conn.commit()
    cursor.close()


def init_schema(conn) -> None:
    cursor = conn.cursor()

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
            analysis_status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        )
    """)
    conn.commit()
    cursor.close()

    # Add analysis columns if missing
    ensure_column(conn, "events", "processing_at", "processing_at DATETIME(6) NULL")
    ensure_column(conn, "events", "analyzed_at", "analyzed_at DATETIME(6) NULL")
    ensure_column(conn, "events", "failed_at", "failed_at DATETIME(6) NULL")
    ensure_column(conn, "events", "fail_reason", "fail_reason VARCHAR(300) NULL")

    ensure_column(conn, "events", "keywords_json", "keywords_json JSON NULL")
    ensure_column(conn, "events", "emotion_label", "emotion_label VARCHAR(50) NULL")
    ensure_column(conn, "events", "mood_emoji", "mood_emoji VARCHAR(16) NULL")
    ensure_column(conn, "events", "topic_label", "topic_label VARCHAR(50) NULL")
    ensure_column(conn, "events", "summary_text", "summary_text TEXT NULL")
    ensure_column(conn, "events", "analysis_mode", "analysis_mode VARCHAR(50) NULL")
    ensure_column(conn, "events", "analysis_error", "analysis_error VARCHAR(200) NULL")

    ensure_column(conn, "events", "interaction_count", "interaction_count INT NOT NULL DEFAULT 1")

    ensure_column(conn, "events", "flagged", "flagged BOOLEAN NOT NULL DEFAULT FALSE")
    ensure_column(conn, "events", "flag_reasons_json", "flag_reasons_json JSON NULL")
    ensure_column(conn, "events", "flagged_at", "flagged_at DATETIME(6) NULL")

    # Helpful indexes
    ensure_index(
        conn,
        "events",
        "idx_analysis_status",
        "CREATE INDEX idx_analysis_status ON events (analysis_status)"
    )
    ensure_index(
        conn,
        "events",
        "idx_event_type",
        "CREATE INDEX idx_event_type ON events (event_type)"
    )
    ensure_index(
        conn,
        "events",
        "idx_session_id",
        "CREATE INDEX idx_session_id ON events (session_id)"
    )


def claim_row_for_processing(conn, row_id: int) -> Optional[Dict[str, Any]]:
    """
    Atomically claim a PENDING row -> PROCESSING so only one worker processes it.
    Returns the row if claim succeeded, else None.
    """
    cursor = conn.cursor(dictionary=True)

    cursor.execute("""
        UPDATE events
        SET analysis_status = 'PROCESSING',
            processing_at = %s
        WHERE id = %s
          AND analysis_status = 'PENDING'
    """, (now_mysql_dt(), row_id))

    conn.commit()

    if cursor.rowcount == 0:
        cursor.close()
        return None

    cursor.execute("SELECT * FROM events WHERE id = %s", (row_id,))
    row = cursor.fetchone()
    cursor.close()
    return row


def count_interactions_in_session(conn, session_id: Optional[str]) -> int:
    if not session_id:
        return 1

    cursor = conn.cursor()
    cursor.execute("""
        SELECT COUNT(*)
        FROM events
        WHERE session_id = %s
          AND event_type = 'CHAT'
    """, (session_id,))
    count = cursor.fetchone()[0]
    cursor.close()
    return int(count or 1)


def analyze_and_update(conn, row: Dict[str, Any]) -> None:
    child_text = row.get("child_text", "") or ""
    assistant_text = row.get("ai_text", "") or ""

    if not child_text.strip():
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE events
            SET analysis_status = 'DONE',
                analyzed_at = %s,
                analysis_mode = 'empty'
            WHERE id = %s
        """, (now_mysql_dt(), row["id"]))
        conn.commit()
        cursor.close()
        return

    try:
        analysis = gemini_analyze(child_text, assistant_text) if USE_GEMINI else fallback_analyze(child_text, assistant_text)
    except Exception as e:
        analysis = fallback_analyze(child_text, assistant_text)
        analysis["analysisError"] = f"gemini_failed: {str(e)[:200]}"

    interaction_count = count_interactions_in_session(conn, row.get("session_id"))

    rule_flagged = heuristic_flag(child_text)
    rule_reasons = extract_flag_reasons(child_text)

    final_flagged = bool(rule_flagged or analysis.get("flagged", False))
    final_flag_reasons = list(rule_reasons)

    if analysis.get("flagged", False) and not final_flag_reasons:
        final_flag_reasons = ["model_flagged"]

    update_fields = {
        **analysis,
        "analysisStatus": "DONE",
        "analyzedAt": now_mysql_dt(),
        "interactionCount": int(interaction_count),
        "flagged": final_flagged,
        "flagReasons": final_flag_reasons,
        "flaggedAt": now_mysql_dt() if final_flagged else None,
    }

    cursor = conn.cursor()
    cursor.execute("""
        UPDATE events
        SET keywords_json = %s,
            emotion_label = %s,
            mood_emoji = %s,
            topic_label = %s,
            summary_text = %s,
            flagged = %s,
            analysis_mode = %s,
            analysis_error = %s,
            analysis_status = %s,
            analyzed_at = %s,
            interaction_count = %s,
            flag_reasons_json = %s,
            flagged_at = %s
        WHERE id = %s
    """, (
        json.dumps(update_fields["keywords"], ensure_ascii=False),
        update_fields["emotionLabel"],
        update_fields["moodEmoji"],
        update_fields["topicLabel"],
        update_fields["summary"],
        bool(update_fields["flagged"]),
        update_fields["analysisMode"],
        update_fields.get("analysisError"),
        update_fields["analysisStatus"],
        update_fields["analyzedAt"],
        update_fields["interactionCount"],
        json.dumps(update_fields["flagReasons"], ensure_ascii=False),
        update_fields["flaggedAt"],
        row["id"],
    ))
    conn.commit()
    cursor.close()

    print(
        f"[worker] DONE id={row['id']} "
        f"emo={update_fields['emotionLabel']} "
        f"topic={update_fields['topicLabel']} "
        f"flagged={int(bool(update_fields['flagged']))} "
        f"interactions={update_fields['interactionCount']}"
    )


def mark_failed(conn, row_id: int, reason: str) -> None:
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE events
        SET analysis_status = 'FAILED',
            failed_at = %s,
            fail_reason = %s
        WHERE id = %s
    """, (now_mysql_dt(), reason[:300], row_id))
    conn.commit()
    cursor.close()


def process_pending_batch(conn, limit: int) -> int:
    """
    On startup, process already-existing PENDING rows.
    """
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT id
        FROM events
        WHERE event_type = 'CHAT'
          AND analysis_status = 'PENDING'
        ORDER BY id ASC
        LIMIT %s
    """, (limit,))
    pending = cursor.fetchall()
    cursor.close()

    processed = 0
    for item in pending:
        claimed = claim_row_for_processing(conn, item["id"])
        if not claimed:
            continue
        try:
            analyze_and_update(conn, claimed)
            processed += 1
        except Exception as e:
            mark_failed(conn, item["id"], str(e))
    return processed


def process_new_pending_once(conn) -> int:
    """
    Poll for new pending rows and process them.
    """
    cursor = conn.cursor(dictionary=True)
    cursor.execute("""
        SELECT id
        FROM events
        WHERE event_type = 'CHAT'
          AND analysis_status = 'PENDING'
        ORDER BY id ASC
        LIMIT %s
    """, (BATCH_LIMIT,))
    rows = cursor.fetchall()
    cursor.close()

    processed = 0
    for item in rows:
        claimed = claim_row_for_processing(conn, item["id"])
        if not claimed:
            continue
        try:
            analyze_and_update(conn, claimed)
            processed += 1
        except Exception as e:
            mark_failed(conn, item["id"], str(e))

    return processed


def main():
    conn = get_connection()
    init_schema(conn)

    print(f"[worker] MySQL connected | {MYSQL_HOST}:{MYSQL_PORT} | DB={MYSQL_DB} | Gemini={USE_GEMINI}")

    # 1) Startup backfill for any rows already in DB
    try:
        n = process_pending_batch(conn, BATCH_LIMIT)
        if n:
            print(f"[worker] processed pending on startup: {n}")
    except Exception as e:
        print("[worker] startup pending processing error:", str(e))

    # 2) Poll loop for new rows
    while True:
        try:
            processed = process_new_pending_once(conn)
            if processed == 0:
                time.sleep(SLEEP_ON_IDLE_SEC)
        except mysql.connector.Error as e:
            print("[worker] MySQL error, retrying:", str(e))
            time.sleep(1.5)
            try:
                conn.close()
            except Exception:
                pass
            conn = get_connection()
            init_schema(conn)
        except Exception as e:
            print("[worker] unexpected error, retrying:", str(e))
            time.sleep(1.5)


if __name__ == "__main__":
    main()