from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo

import mysql.connector
from dotenv import load_dotenv
from mysql.connector import Error

BACKEND_DIR = Path(__file__).resolve().parent
ROOT_DIR = BACKEND_DIR.parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(BACKEND_DIR / ".env", override=True)

MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
MYSQL_USER = os.getenv("MYSQL_USER", "root")
MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "")
MYSQL_DB = os.getenv("MYSQL_DB", "teddy_db")
API_HOST = os.getenv("API_HOST", "0.0.0.0")
API_PORT = int(os.getenv("API_PORT", "8000"))
DEFAULT_USER_ID = os.getenv("USER_ID", "child-1")
PREFERENCES_PATH = Path(__file__).with_name("preferences.json")
DISPLAY_TIMEZONE = ZoneInfo(os.getenv("DISPLAY_TIMEZONE", "America/Toronto"))
RUN_EMBEDDED_WORKER = os.getenv("RUN_EMBEDDED_WORKER", "1") != "0"
WORKER_PROCESS: Optional[subprocess.Popen] = None

EMOTION_SCORES = {
    "happy": 5.0,
    "excited": 5.0,
    "calm": 4.0,
    "neutral": 3.0,
    "sad": 2.0,
    "anxious": 2.0,
    "frustrated": 2.0,
    "tired": 2.0,
    "angry": 1.0,
}

DEFAULT_PREFERENCES = {
    "voiceType": "friendly-female",
    "responseStyle": "balanced",
    "contentLevel": "ages-6-8",
    "sessionDurationMinutes": 30,
    "learningFocus": "general",
}


def get_connection():
    return mysql.connector.connect(
        host=MYSQL_HOST,
        port=MYSQL_PORT,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=MYSQL_DB,
        autocommit=True,
    )


def has_pending_events(user_id: Optional[str] = None) -> bool:
    conn = get_connection()
    try:
        cursor = conn.cursor()
        params: List[Any] = []
        query = """
            SELECT 1
            FROM events
            WHERE event_type = 'CHAT'
              AND analysis_status = 'PENDING'
        """
        if user_id:
            query += " AND user_id = %s"
            params.append(user_id)
        query += " LIMIT 1"
        cursor.execute(query, tuple(params))
        found = cursor.fetchone() is not None
        cursor.close()
        return found
    finally:
        conn.close()


def parse_json_field(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str):
        value = value.strip()
        if not value:
            return []
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            parsed = [part.strip() for part in value.split(",")]
        return parse_json_field(parsed)
    return []


def isoformat_utc(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        dt = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat()
    return str(value)


def parse_timestamp(timestamp: str) -> datetime:
    return datetime.fromisoformat(timestamp.replace("Z", "+00:00"))


def to_display_time(timestamp: str) -> datetime:
    return parse_timestamp(timestamp).astimezone(DISPLAY_TIMEZONE)


def row_to_event(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": str(row.get("id")),
        "userId": row.get("user_id") or "",
        "deviceId": row.get("device_id") or "",
        "sessionId": row.get("session_id") or "",
        "timestamp": isoformat_utc(row.get("timestamp_utc")),
        "childText": row.get("child_text") or "",
        "aiText": row.get("ai_text") or "",
        "eventType": row.get("event_type") or "CHAT",
        "analysisStatus": row.get("analysis_status") or "PENDING",
        "keywords": parse_json_field(row.get("keywords_json")),
        "emotionLabel": row.get("emotion_label"),
        "moodEmoji": row.get("mood_emoji"),
        "topicLabel": row.get("topic_label"),
        "summaryText": row.get("summary_text"),
        "flagged": bool(row.get("flagged")),
        "flagReasons": parse_json_field(row.get("flag_reasons_json")),
        "interactionCount": int(row.get("interaction_count") or 1),
    }


def load_preferences() -> Dict[str, Dict[str, Any]]:
    if not PREFERENCES_PATH.exists():
        return {}
    try:
        return json.loads(PREFERENCES_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {}


def save_preferences(data: Dict[str, Dict[str, Any]]) -> None:
    PREFERENCES_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def get_user_preferences(user_id: str) -> Dict[str, Any]:
    data = load_preferences()
    return {**DEFAULT_PREFERENCES, **data.get(user_id, {})}


def set_user_preferences(user_id: str, preferences: Dict[str, Any]) -> Dict[str, Any]:
    data = load_preferences()
    data[user_id] = {**DEFAULT_PREFERENCES, **preferences}
    save_preferences(data)
    return data[user_id]


def fetch_events(user_id: str, size: int = 100, status: Optional[str] = "DONE") -> List[Dict[str, Any]]:
    conn = get_connection()
    try:
        cursor = conn.cursor(dictionary=True)
        params: List[Any] = [user_id]
        query = """
            SELECT *
            FROM events
            WHERE user_id = %s
              AND event_type = 'CHAT'
        """
        if status:
            query += " AND analysis_status = %s"
            params.append(status)
        query += """
            ORDER BY timestamp_utc DESC
            LIMIT %s
        """
        params.append(size)
        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        return [row_to_event(row) for row in rows]
    finally:
        conn.close()


def relative_time(timestamp: str) -> str:
    try:
        dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
    except ValueError:
        return "recently"
    delta = datetime.now(timezone.utc) - dt
    minutes = max(1, int(delta.total_seconds() // 60))
    if minutes < 60:
        return f"{minutes} min ago"
    hours = round(minutes / 60)
    if hours < 24:
        return f"{hours} hr ago"
    days = round(hours / 24)
    return f"{days} day{'s' if days != 1 else ''} ago"


def build_summary(events: List[Dict[str, Any]]) -> Dict[str, Any]:
    latest = events[0] if events else None
    sessions = {event["sessionId"] for event in events if event["sessionId"]}
    return {
        "conversationCount": len(events),
        "activeTimeMinutes": max(len(events), len(sessions) * 4),
        "currentMood": (latest or {}).get("moodEmoji") or (latest or {}).get("emotionLabel") or "No mood yet",
        "lastActiveTimestamp": (latest or {}).get("timestamp", ""),
    }


def build_mood_trends(events: List[Dict[str, Any]], days: int) -> List[Dict[str, Any]]:
    today = datetime.now(timezone.utc).date()
    buckets: Dict[str, List[float]] = {}
    for offset in range(days - 1, -1, -1):
        current = today - timedelta(days=offset)
        buckets[current.isoformat()] = []

    for event in events:
        timestamp = event.get("timestamp") or ""
        day_key = timestamp[:10]
        if day_key in buckets:
            emotion = (event.get("emotionLabel") or "neutral").lower()
            buckets[day_key].append(EMOTION_SCORES.get(emotion, 3.0))

    result = []
    for day_key, scores in buckets.items():
        date_obj = datetime.fromisoformat(day_key)
        result.append(
            {
                "day": date_obj.strftime("%a"),
                "mood": round(sum(scores) / len(scores), 1) if scores else 0,
                "date": day_key,
            }
        )
    return result


def build_alerts(events: List[Dict[str, Any]], size: int) -> List[Dict[str, Any]]:
    alerts = []
    flagged_events = [event for event in events if event.get("flagged")]
    for index, event in enumerate(flagged_events[:size], start=1):
        alerts.append(
            {
                "id": index,
                "type": "WARNING",
                "message": event.get("summaryText")
                or event.get("childText")
                or ", ".join(event.get("flagReasons", []))
                or "Flagged conversation requires review.",
                "timestamp": event.get("timestamp"),
                "timeAgo": relative_time(event.get("timestamp") or ""),
            }
        )
    return alerts


def format_date_label(timestamp: str) -> str:
    dt = to_display_time(timestamp)
    local_date = dt.date()
    today = datetime.now(DISPLAY_TIMEZONE).date()
    yesterday = today - timedelta(days=1)
    if local_date == today:
        return "Today"
    if local_date == yesterday:
        return "Yesterday"
    return dt.strftime("%b %d")


def build_conversations(events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    grouped: Dict[str, List[Dict[str, Any]]] = {}
    for event in events:
        label = format_date_label(event["timestamp"])
        grouped.setdefault(label, []).append(
            {
                "id": event["id"],
                "timestamp": event["timestamp"],
                "timeFormatted": to_display_time(event["timestamp"]).strftime("%I:%M %p").lstrip("0"),
                "type": event["eventType"],
                "content": event["childText"] or event.get("summaryText") or "",
                "mood": event.get("moodEmoji") or event.get("emotionLabel") or "🙂",
                "childEmotion": event.get("emotionLabel"),
                "flagged": bool(event.get("flagged")),
                "topic": event.get("topicLabel"),
                "keywords": event.get("keywords", []),
                "summary": event.get("summaryText"),
                "aiReply": event.get("aiText"),
                "sessionId": event.get("sessionId"),
                "interactionCount": event.get("interactionCount"),
                "analysisStatus": event.get("analysisStatus"),
            }
        )
    return [{"date": date, "items": items} for date, items in grouped.items()]


def start_embedded_worker() -> None:
    global WORKER_PROCESS
    if not RUN_EMBEDDED_WORKER:
        print("[api] embedded worker disabled")
        return

    worker_path = Path(__file__).resolve().parent / "analytics" / "worker.py"
    try:
        WORKER_PROCESS = subprocess.Popen(
            [sys.executable, str(worker_path)],
            cwd=str(worker_path.parent),
        )
        print(f"[api] worker.py launched automatically (pid={WORKER_PROCESS.pid})")
    except Exception as exc:
        print(f"[api] failed to launch worker.py automatically: {exc}")


def ensure_worker_running_for_pending(user_id: Optional[str] = None) -> None:
    global WORKER_PROCESS
    if not RUN_EMBEDDED_WORKER:
        return

    if not has_pending_events(user_id):
        return

    if WORKER_PROCESS is not None and WORKER_PROCESS.poll() is None:
        return

    print("[api] pending rows detected; relaunching worker.py")
    start_embedded_worker()


class ApiHandler(BaseHTTPRequestHandler):
    server_version = "TedTalksAPI/1.0"

    def _set_headers(self, status_code: int = 200, content_type: str = "application/json") -> None:
        self.send_response(status_code)
        self.send_header("Content-Type", content_type)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    def _send_json(self, payload: Any, status_code: int = 200) -> None:
        self._set_headers(status_code)
        self.wfile.write(json.dumps(payload).encode("utf-8"))

    def _read_json_body(self) -> Dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length else b"{}"
        if not raw:
            return {}
        return json.loads(raw.decode("utf-8"))

    def do_OPTIONS(self) -> None:
        self._set_headers(204)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")
        query = parse_qs(parsed.query)

        try:
            requested_user_id = query.get("userId", query.get("user_id", [DEFAULT_USER_ID]))[0]
            if path.startswith("/api/"):
                ensure_worker_running_for_pending(requested_user_id)

            if path == "/api/health":
                self._send_json({"ok": True, "timestamp": datetime.now(timezone.utc).isoformat()})
                return

            if path == "/api/events":
                user_id = requested_user_id
                size = int(query.get("size", ["100"])[0])
                self._send_json(fetch_events(user_id, size))
                return

            if path == "/api/dashboard/summary":
                user_id = requested_user_id
                events = fetch_events(user_id, 100)
                self._send_json(build_summary(events))
                return

            if path == "/api/dashboard/mood-trends":
                user_id = requested_user_id
                days = int(query.get("days", ["7"])[0])
                events = fetch_events(user_id, 500)
                self._send_json(build_mood_trends(events, days))
                return

            if path == "/api/alerts":
                user_id = requested_user_id
                size = int(query.get("size", ["10"])[0])
                events = fetch_events(user_id, 200)
                self._send_json(build_alerts(events, size))
                return

            if path == "/api/conversations":
                user_id = requested_user_id
                size = int(query.get("size", ["100"])[0])
                events = fetch_events(user_id, size)
                self._send_json(build_conversations(events))
                return

            if path.startswith("/api/preferences/"):
                user_id = path.split("/")[-1] or DEFAULT_USER_ID
                self._send_json(get_user_preferences(user_id))
                return

            self._send_json({"message": "Not found"}, 404)
        except Error as exc:
            self._send_json({"message": f"MySQL error: {exc}"}, 500)
        except Exception as exc:
            self._send_json({"message": f"Server error: {exc}"}, 500)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        try:
            if path == "/api/auth/login":
                body = self._read_json_body()
                user_id = (body.get("email") or body.get("userId") or DEFAULT_USER_ID).strip()
                payload = {
                    "token": f"dev-token-{user_id}",
                    "userId": user_id,
                    "parentName": "Parent",
                    "childName": "Child",
                }
                self._send_json(payload)
                return

            if path == "/api/ai/parent-advice":
                body = self._read_json_body()
                mood = body.get("latestMood") or "their recent mood"
                flagged = bool(body.get("flagged"))
                content_level = body.get("contentLevel") or "ages-6-8"
                advice = (
                    "A recent conversation was flagged. Start with a calm, supportive check-in and review the context together."
                    if flagged
                    else f"Your child seems to be showing {mood}. Use a short, supportive check-in tailored for {content_level}."
                )
                self._send_json({"success": True, "advice": advice, "model": "local-fallback"})
                return

            self._send_json({"message": "Not found"}, 404)
        except Exception as exc:
            self._send_json({"message": f"Server error: {exc}"}, 500)

    def do_PUT(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        try:
            if path.startswith("/api/preferences/"):
                user_id = path.split("/")[-1] or DEFAULT_USER_ID
                body = self._read_json_body()
                preferences = body.get("preferences") if isinstance(body, dict) else {}
                if not isinstance(preferences, dict):
                    preferences = {}
                self._send_json(set_user_preferences(user_id, preferences))
                return

            self._send_json({"message": "Not found"}, 404)
        except Exception as exc:
            self._send_json({"message": f"Server error: {exc}"}, 500)


def main() -> None:
    start_embedded_worker()
    server = ThreadingHTTPServer((API_HOST, API_PORT), ApiHandler)
    print(f"[api] serving on http://{API_HOST}:{API_PORT}")
    print(f"[api] mysql={MYSQL_HOST}:{MYSQL_PORT} db={MYSQL_DB}")
    server.serve_forever()


if __name__ == "__main__":
    main()
