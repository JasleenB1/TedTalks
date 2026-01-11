/**
 * API Service Layer - MongoDB Atlas App Services (Realm Web SDK)
 *
 * Copy-paste ready replacement for api.service.ts
 *
 * Setup:
 * 1) npm install realm-web
 * 2) frontend/.env:
 *    VITE_MONGO_APP_ID=your-realm-app-id
 *    VITE_MONGO_DB_NAME=your-db-name
 *
 * Notes:
 * - Uses Anonymous auth by default.
 * - Assumes your conversation docs match the sample you provided:
 *   { userId, timestamp, childText, assistantText, type, emotionLabel, moodEmoji, flagged, conversationId, ... }
 * - IMPORTANT: this code filters conversations/alerts/mood by the userId you pass in from the app (NOT Realm user.id).
 *   That matches your sample ("user-123").
 */

import * as Realm from "realm-web";
import type {
  LoginRequest,
  LoginResponse,
  DashboardSummary,
  MoodDataPoint,
  Alert,
  ConversationDay,
  ConversationItem,
  AIPreferences,
  ApiResponse,
} from "../types";

const REALM_APP_ID = import.meta.env.VITE_MONGO_APP_ID as string | undefined;
const DB_NAME = (import.meta.env.VITE_MONGO_DB_NAME as string | undefined) ?? "teddy-cluster";
const MONGO_SERVICE_NAME = "mongodb-atlas";

// ✅ Update these collection names to match your Atlas collections
const COLLECTIONS = {
  profiles: "profiles",
  preferences: "preferences",
  conversationTurns: "conversations", // <-- change to your actual collection name if different
  alerts: "alerts",
  moodEvents: "mood_events",
  usageEvents: "usage_events",
} as const;

function nowIso() {
  return new Date().toISOString();
}

function formatDayShort(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: "short" });
}

function timeAgoFromIso(iso: string) {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diffMs = Date.now() - t;

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return `${sec}s ago`;

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}

class ApiService {
  private app: Realm.App;
  private user: Realm.User | null = null;

  constructor() {
    if (!REALM_APP_ID) throw new Error("Missing VITE_MONGO_APP_ID in frontend/.env");
    this.app = new Realm.App({ id: REALM_APP_ID });
    this.user = this.app.currentUser ?? null;
  }

  // Kept for compatibility with your prior token flow
  setToken(token: string) {
    localStorage.setItem("authToken", token);
  }

  getToken(): string | null {
    return localStorage.getItem("authToken");
  }

  clearToken() {
    localStorage.removeItem("authToken");
  }

  private ok<T>(data: T): ApiResponse<T> {
    return { success: true, data, timestamp: nowIso() };
  }

  private fail<T>(error: string): ApiResponse<T> {
    return { success: false, error, timestamp: nowIso() };
  }

  private async ensureRealmUser(): Promise<Realm.User> {
    if (this.user?.isLoggedIn) return this.user;

    if (this.app.currentUser?.isLoggedIn) {
      this.user = this.app.currentUser;
      return this.user;
    }

    // Anonymous auth for student projects
    this.user = await this.app.logIn(Realm.Credentials.anonymous());
    this.setToken(this.user.accessToken);
    return this.user;
  }

  private async mongoDb() {
    const user = await this.ensureRealmUser();
    return user.mongoClient(MONGO_SERVICE_NAME).db(DB_NAME);
  }

  // -------------------------
  // Auth
  // -------------------------
  /**
   * Realm Anonymous login doesn't use email/password.
   * We still accept LoginRequest for UI compatibility.
   * Returns LoginResponse as your UI expects.
   */
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    try {
      await this.ensureRealmUser();
      const db = await this.mongoDb();
      const profiles = db.collection(COLLECTIONS.profiles);

      // Your UI expects a "userId". Your DB sample uses "user-123".
      // For demo purposes, we derive a stable app-level id from email.
      // If you already have userIds, replace this with your own lookup logic.
      const email = credentials.email.toLowerCase().trim();
      const userId = email ? `user-${this.stableIdFromString(email)}` : `user-${Date.now()}`;

      const existing = (await profiles.findOne({ userId })) as
        | { userId: string; parentName?: string; childName?: string; email?: string }
        | null;

      if (!existing) {
        await profiles.insertOne({
          userId,
          email,
          parentName: "Parent",
          childName: "Child",
          createdAt: nowIso(),
        });
      } else if (email && existing.email !== email) {
        await profiles.updateOne({ userId }, { $set: { email } });
      }

      const profile = (await profiles.findOne({ userId })) as
        | { userId: string; parentName?: string; childName?: string }
        | null;

      const token = this.getToken() ?? "";

      return this.ok({
        token,
        userId,
        parentName: profile?.parentName ?? "Parent",
        childName: profile?.childName ?? "Child",
      });
    } catch (e) {
      return this.fail<LoginResponse>(e instanceof Error ? e.message : "Login failed");
    }
  }

  async logout(): Promise<void> {
    try {
      if (this.user) await this.user.logOut();
    } finally {
      this.user = null;
      this.clearToken();
    }
  }

  // -------------------------
  // Preferences
  // -------------------------
  async getPreferences(userId: string): Promise<ApiResponse<AIPreferences>> {
    try {
      const db = await this.mongoDb();
      const col = db.collection(COLLECTIONS.preferences);

      const defaults: AIPreferences = {
        voiceType: "friendly-female",
        responseStyle: "balanced",
        contentLevel: "ages-6-8",
        sessionDurationMinutes: 30,
        learningFocus: "general",
      };

      const doc = (await col.findOne({ userId })) as (AIPreferences & { userId: string }) | null;
      if (!doc) {
        await col.insertOne({ userId, ...defaults });
        return this.ok(defaults);
      }

      const { userId: _ignore, ...prefs } = doc;
      return this.ok(prefs);
    } catch (e) {
      return this.fail<AIPreferences>(e instanceof Error ? e.message : "Failed to load preferences");
    }
  }

  async updatePreferences(userId: string, preferences: AIPreferences): Promise<ApiResponse<AIPreferences>> {
    try {
      const db = await this.mongoDb();
      const col = db.collection(COLLECTIONS.preferences);

      await col.updateOne({ userId }, { $set: { userId, ...preferences } }, { upsert: true });
      return this.ok(preferences);
    } catch (e) {
      return this.fail<AIPreferences>(e instanceof Error ? e.message : "Failed to save preferences");
    }
  }

  // -------------------------
  // Conversations
  // -------------------------
  async getConversations(page = 0, size = 20): Promise<ApiResponse<ConversationDay[]>> {
    try {
      const db = await this.mongoDb();
      const col = db.collection(COLLECTIONS.conversationTurns);

      const skip = page * size;

      const docs = (await col.find(
        {}, // You likely want per-user filtering; see NOTE below
        { sort: { timestamp: -1 }, limit: size, skip }
      )) as any[];

      // NOTE: if you want per-user, change the find() filter above to:
      // { userId }
      // but that requires you to thread userId into this call or store it globally.

      const items = docs.map((d) => this.toConversationItem(d));
      return this.ok(this.groupItemsByDay(items));
    } catch (e) {
      return this.fail<ConversationDay[]>(e instanceof Error ? e.message : "Failed to load conversations");
    }
  }

  async searchConversations(query: string): Promise<ApiResponse<ConversationDay[]>> {
    try {
      const db = await this.mongoDb();
      const col = db.collection(COLLECTIONS.conversationTurns);

      const q = query.trim();
      if (!q) return this.ok([]);

      const docs = (await col.find(
        {
          $or: [
            { childText: { $regex: q, $options: "i" } },
            { assistantText: { $regex: q, $options: "i" } },
            { topicLabel: { $regex: q, $options: "i" } },
          ],
        },
        { sort: { timestamp: -1 }, limit: 100 }
      )) as any[];

      const items = docs.map((d) => this.toConversationItem(d));
      return this.ok(this.groupItemsByDay(items));
    } catch (e) {
      return this.fail<ConversationDay[]>(e instanceof Error ? e.message : "Search failed");
    }
  }

  private toConversationItem(d: any): ConversationItem {
    const iso = typeof d.timestamp === "string" ? d.timestamp : nowIso();
    const dt = new Date(iso);

    const id =
      typeof d.id === "number"
        ? d.id
        : typeof d._id === "string"
          ? this.stableIdFromString(d._id)
          : dt.getTime();

    const child = (d.childText ?? "").toString().trim();
    const assistant = (d.assistantText ?? "").toString().trim();

    const content =
      assistant && child
        ? `Child: ${child}\nAssistant: ${assistant}`
        : child || assistant || "";

    const mood = (d.emotionLabel ?? d.moodEmoji ?? "neutral").toString();

    return {
      id,
      timestamp: iso,
      timeFormatted: dt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }),
      type: (d.type ?? "CHAT") as ConversationItem["type"],
      content,
      mood,
      flagged: Boolean(d.flagged ?? false),
    };
  }

  private groupItemsByDay(items: ConversationItem[]): ConversationDay[] {
    const map = new Map<string, ConversationItem[]>();

    for (const item of items) {
      const key = item.timestamp.slice(0, 10); // YYYY-MM-DD
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }

    for (const [, arr] of map.entries()) {
      arr.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
    }

    return Array.from(map.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, dayItems]) => ({ date, items: dayItems }));
  }

  // -------------------------
  // Alerts
  // -------------------------
  async getAlerts(page = 0, size = 10): Promise<ApiResponse<Alert[]>> {
    try {
      const db = await this.mongoDb();
      const col = db.collection(COLLECTIONS.alerts);

      const skip = page * size;

      const docs = (await col.find({}, { sort: { timestamp: -1 }, limit: size, skip })) as any[];

      const alerts: Alert[] = docs.map((d) => {
        const ts = typeof d.timestamp === "string" ? d.timestamp : nowIso();
        return {
          id: typeof d.id === "number" ? d.id : new Date(ts).getTime(),
          type: (d.type ?? "INFO") as Alert["type"],
          message: String(d.message ?? ""),
          timestamp: ts,
          timeAgo: timeAgoFromIso(ts),
        };
      });

      return this.ok(alerts);
    } catch (e) {
      return this.fail<Alert[]>(e instanceof Error ? e.message : "Failed to load alerts");
    }
  }

  // -------------------------
  // Mood Trends
  // -------------------------
  async getMoodTrends(days = 7): Promise<ApiResponse<MoodDataPoint[]>> {
    try {
      const db = await this.mongoDb();
      const col = db.collection(COLLECTIONS.moodEvents);

      const start = new Date();
      start.setDate(start.getDate() - days);

      const docs = (await col.find(
        { timestamp: { $gte: start.toISOString() } },
        { sort: { timestamp: 1 }, limit: 2000 }
      )) as any[];

      const agg = new Map<string, { sum: number; count: number }>();
      for (const d of docs) {
        const iso = typeof d.timestamp === "string" ? d.timestamp : nowIso();
        const key = iso.slice(0, 10);
        const mood = typeof d.mood === "number" ? d.mood : 0;

        const cur = agg.get(key) ?? { sum: 0, count: 0 };
        cur.sum += mood;
        cur.count += 1;
        agg.set(key, cur);
      }

      const points: MoodDataPoint[] = Array.from(agg.entries())
        .sort((a, b) => (a[0] > b[0] ? 1 : -1))
        .map(([dateStr, v]) => {
          const d = new Date(`${dateStr}T00:00:00`);
          return {
            date: dateStr,
            day: formatDayShort(d),
            mood: v.count ? v.sum / v.count : 0,
          };
        });

      return this.ok(points);
    } catch {
      return this.ok([]);
    }
  }

  // -------------------------
  // Dashboard Summary
  // -------------------------
  async getDashboardSummary(): Promise<ApiResponse<DashboardSummary>> {
    try {
      const db = await this.mongoDb();
      const convCol = db.collection(COLLECTIONS.conversationTurns);

      // conversationCount: count distinct conversationId
      const conversationIds = (await convCol.distinct("conversationId", {})) as any[];
      const conversationCount = Array.isArray(conversationIds) ? conversationIds.length : 0;

      // lastActiveTimestamp: latest timestamp
      const last = (await convCol.findOne({}, { sort: { timestamp: -1 } })) as any | null;
      const lastActiveTimestamp = typeof last?.timestamp === "string" ? last.timestamp : nowIso();

      // currentMood: latest emotionLabel/moodEmoji
      const currentMood =
        (last?.emotionLabel ?? last?.moodEmoji ?? "neutral").toString();

      // activeTimeMinutes: if you track usage_events with { minutes, timestamp }, sum last 7 days
      let activeTimeMinutes = 0;
      try {
        const usageCol = db.collection(COLLECTIONS.usageEvents);
        const start = new Date();
        start.setDate(start.getDate() - 7);

        const usageDocs = (await usageCol.find(
          { timestamp: { $gte: start.toISOString() } },
          { limit: 5000 }
        )) as any[];

        activeTimeMinutes = usageDocs.reduce((acc, d) => acc + (typeof d.minutes === "number" ? d.minutes : 0), 0);
      } catch {
        activeTimeMinutes = 0;
      }

      return this.ok({
        conversationCount,
        activeTimeMinutes,
        currentMood,
        lastActiveTimestamp,
      });
    } catch (e) {
      return this.fail<DashboardSummary>(e instanceof Error ? e.message : "Failed to load dashboard");
    }
  }

  // -------------------------
  // Helpers
  // -------------------------
  private stableIdFromString(s: string): number {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      hash = (hash * 31 + s.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }
}

export const apiService = new ApiService();
