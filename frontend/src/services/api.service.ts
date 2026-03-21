import type {
  Alert,
  AIPreferences,
  ApiResponse,
  BackendEventRecord,
  ConversationDay,
  ConversationItem,
  DashboardSummary,
  LoginRequest,
  LoginResponse,
  MoodDataPoint,
  UpdatePreferencesRequest,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace(/\/$/, '');
const DISPLAY_TIME_ZONE = 'America/Toronto';
const AUTH_TOKEN_KEY = 'authToken';
const USER_ID_KEY = 'tedtalksUserId';
const PREFS_PREFIX = 'tedtalksPreferences:';

const DEFAULT_PREFERENCES: AIPreferences = {
  voiceType: 'friendly-female',
  responseStyle: 'balanced',
  contentLevel: 'ages-6-8',
  sessionDurationMinutes: 30,
  learningFocus: 'general',
};

const moodScoreMap: Record<string, number> = {
  happy: 5,
  excited: 5,
  calm: 4,
  neutral: 3,
  sad: 2,
  anxious: 2,
  frustrated: 2,
  tired: 2,
  angry: 1,
};

type JsonRecord = Record<string, unknown>;

interface FetchResult {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
}

class ApiService {
  private token: string | null = null;
  private timeFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
  });
  private monthDayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIME_ZONE,
    month: 'short',
    day: 'numeric',
  });
  private weekdayFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIME_ZONE,
    weekday: 'short',
  });

  setToken(token: string) {
    this.token = token;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem(AUTH_TOKEN_KEY);
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  setUserId(userId: string) {
    localStorage.setItem(USER_ID_KEY, userId);
  }

  getUserId(): string | null {
    return localStorage.getItem(USER_ID_KEY);
  }

  clearUserId() {
    localStorage.removeItem(USER_ID_KEY);
  }

  private async fetchJson(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<FetchResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    const token = this.getToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const raw = await response.text();
      const data = raw ? JSON.parse(raw) : undefined;

      return {
        ok: response.ok,
        status: response.status,
        data,
        error: response.ok ? undefined : this.extractError(data, response.statusText),
      };
    } catch (error) {
      return {
        ok: false,
        status: 0,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  private extractError(data: unknown, fallback: string): string {
    if (data && typeof data === 'object' && 'message' in data) {
      const message = (data as JsonRecord).message;
      if (typeof message === 'string' && message.trim()) {
        return message;
      }
    }
    return fallback || 'Request failed';
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const result = await this.fetchJson(endpoint, options);

    if (!result.ok) {
      return {
        success: false,
        error: result.error || 'Request failed',
        timestamp: new Date().toISOString(),
      };
    }

    return {
      success: true,
      data: result.data as T,
      timestamp: new Date().toISOString(),
    };
  }

  private async getFirstAvailable(endpoints: string[]): Promise<unknown | null> {
    for (const endpoint of endpoints) {
      const result = await this.fetchJson(endpoint, { method: 'GET' });
      if (result.ok) {
        return result.data ?? null;
      }
    }
    return null;
  }

  private asArray(payload: unknown): unknown[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const record = payload as JsonRecord;
      const keys = ['data', 'items', 'content', 'results', 'rows', 'events', 'conversations'];
      for (const key of keys) {
        const value = record[key];
        if (Array.isArray(value)) {
          return value;
        }
      }
    }

    return [];
  }

  private parseStringArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => String(item).trim())
        .filter(Boolean);
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value) as unknown;
        return this.parseStringArray(parsed);
      } catch {
        return value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
      }
    }

    return [];
  }

  private normalizeEventRecord(value: unknown): BackendEventRecord | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as JsonRecord;
    const timestamp =
      this.getString(record.timestamp_utc) ||
      this.getString(record.timestampUtc) ||
      this.getString(record.timestamp) ||
      '';

    if (!timestamp) {
      return null;
    }

    return {
      id: this.getString(record.id) || crypto.randomUUID(),
      userId: this.getString(record.user_id) || this.getString(record.userId) || '',
      deviceId: this.getString(record.device_id) || this.getString(record.deviceId) || '',
      sessionId: this.getString(record.session_id) || this.getString(record.sessionId) || '',
      timestamp,
      childText: this.getString(record.child_text) || this.getString(record.childText) || '',
      aiText: this.getString(record.ai_text) || this.getString(record.aiText) || '',
      eventType: this.getString(record.event_type) || this.getString(record.type) || 'CHAT',
      analysisStatus:
        this.getString(record.analysis_status) ||
        this.getString(record.analysisStatus) ||
        'UNKNOWN',
      keywords: this.parseStringArray(record.keywords_json ?? record.keywords),
      emotionLabel: this.getString(record.emotion_label) || this.getString(record.emotionLabel),
      moodEmoji: this.getString(record.mood_emoji) || this.getString(record.moodEmoji),
      topicLabel: this.getString(record.topic_label) || this.getString(record.topicLabel),
      summaryText: this.getString(record.summary_text) || this.getString(record.summaryText),
      flagged: Boolean(record.flagged),
      flagReasons: this.parseStringArray(record.flag_reasons_json ?? record.flagReasons),
      interactionCount: this.getNumber(record.interaction_count ?? record.interactionCount) || 1,
    };
  }

  private getString(value: unknown): string | null {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return null;
  }

  private getNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private async getEventRecords(userId: string, size = 100): Promise<BackendEventRecord[]> {
    const safeUserId = encodeURIComponent(userId);
    const payload = await this.getFirstAvailable([
      `/events?userId=${safeUserId}&size=${size}`,
      `/events?user_id=${safeUserId}&size=${size}`,
      `/events/${safeUserId}`,
      `/conversations?userId=${safeUserId}&size=${size}`,
      `/conversations?user_id=${safeUserId}&size=${size}`,
    ]);

    const records = this.asArray(payload)
      .map((item) => this.normalizeEventRecord(item))
      .filter((item): item is BackendEventRecord => item !== null)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return records;
  }

  private toConversationItem(event: BackendEventRecord): ConversationItem {
    return {
      id: event.id,
      timestamp: event.timestamp,
      timeFormatted: this.formatTimeInDisplayZone(event.timestamp),
      type: event.eventType,
      content: event.childText || event.summaryText || 'No transcript available',
      mood: event.moodEmoji || this.formatEmotion(event.emotionLabel) || '🙂',
      childEmotion: this.formatEmotion(event.emotionLabel),
      flagged: event.flagged,
      topic: event.topicLabel,
      keywords: event.keywords,
      summary: event.summaryText,
      aiReply: event.aiText,
      sessionId: event.sessionId,
      interactionCount: event.interactionCount,
      analysisStatus: event.analysisStatus,
    };
  }

  private formatEmotion(value: string | null): string | null {
    if (!value) {
      return null;
    }
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private getDisplayDateParts(dateValue: string) {
    const date = new Date(dateValue);
    return {
      year: Number(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: DISPLAY_TIME_ZONE,
          year: 'numeric',
        }).format(date)
      ),
      month: Number(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: DISPLAY_TIME_ZONE,
          month: 'numeric',
        }).format(date)
      ),
      day: Number(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: DISPLAY_TIME_ZONE,
          day: 'numeric',
        }).format(date)
      ),
    };
  }

  private formatTimeInDisplayZone(dateValue: string): string {
    return this.timeFormatter.format(new Date(dateValue));
  }

  private formatDateLabel(dateValue: string): string {
    const target = this.getDisplayDateParts(dateValue);
    const today = this.getDisplayDateParts(new Date().toISOString());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = this.getDisplayDateParts(yesterdayDate.toISOString());

    const sameDay = (
      left: { year: number; month: number; day: number },
      right: { year: number; month: number; day: number }
    ) => left.year === right.year && left.month === right.month && left.day === right.day;

    if (sameDay(target, today)) {
      return 'Today';
    }

    if (sameDay(target, yesterday)) {
      return 'Yesterday';
    }

    return this.monthDayFormatter.format(new Date(dateValue));
  }

  private relativeTime(timestamp: string): string {
    const deltaMs = Date.now() - new Date(timestamp).getTime();
    const deltaMinutes = Math.max(1, Math.round(deltaMs / 60000));

    if (deltaMinutes < 60) {
      return `${deltaMinutes} min ago`;
    }

    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) {
      return `${deltaHours} hr ago`;
    }

    const deltaDays = Math.round(deltaHours / 24);
    return `${deltaDays} day${deltaDays === 1 ? '' : 's'} ago`;
  }

  private deriveDashboardSummary(events: BackendEventRecord[]): DashboardSummary {
    const latest = events[0];
    const uniqueSessions = new Set(events.map((event) => event.sessionId).filter(Boolean));
    const activeTimeMinutes = Math.max(
      events.length,
      Array.from(uniqueSessions).length * 4
    );

    return {
      conversationCount: events.length,
      activeTimeMinutes,
      currentMood: latest?.moodEmoji || this.formatEmotion(latest?.emotionLabel ?? null) || 'No mood yet',
      lastActiveTimestamp: latest?.timestamp || '',
    };
  }

  private deriveMoodTrends(events: BackendEventRecord[], days: number): MoodDataPoint[] {
    const buckets = new Map<string, number[]>();

    for (let index = days - 1; index >= 0; index -= 1) {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - index);
      const key = date.toISOString().slice(0, 10);
      buckets.set(key, []);
    }

    for (const event of events) {
      const key = new Date(event.timestamp).toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) {
        continue;
      }

      const moodKey = (event.emotionLabel || 'neutral').toLowerCase();
      bucket.push(moodScoreMap[moodKey] || 3);
    }

    return Array.from(buckets.entries()).map(([date, scores]) => {
      const day = this.weekdayFormatter.format(new Date(`${date}T00:00:00Z`));
      const mood =
        scores.length > 0
          ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(1))
          : 0;

      return { day, mood, date };
    });
  }

  private deriveAlerts(events: BackendEventRecord[], size: number): Alert[] {
    return events
      .filter((event) => event.flagged)
      .slice(0, size)
      .map((event, index) => ({
        id: index + 1,
        type: 'WARNING',
        message:
          event.summaryText ||
          event.childText ||
          event.flagReasons.join(', ') ||
          'Flagged conversation needs review.',
        timestamp: event.timestamp,
        timeAgo: this.relativeTime(event.timestamp),
      }));
  }

  private deriveConversationDays(events: BackendEventRecord[]): ConversationDay[] {
    const groups = new Map<string, ConversationItem[]>();

    for (const event of events) {
      const label = this.formatDateLabel(event.timestamp);
      const items = groups.get(label) ?? [];
      items.push(this.toConversationItem(event));
      groups.set(label, items);
    }

    return Array.from(groups.entries()).map(([date, items]) => ({
      date,
      items,
    }));
  }

  private looksLikeConversationDays(payload: unknown): payload is ConversationDay[] {
    return Array.isArray(payload) && payload.every((item) => {
      if (!item || typeof item !== 'object') {
        return false;
      }
      const record = item as JsonRecord;
      return typeof record.date === 'string' && Array.isArray(record.items);
    });
  }

  private normalizeConversationDays(days: ConversationDay[]): ConversationDay[] {
    return days.map((day) => ({
      ...day,
      date:
        day.items.length > 0 && day.items[0]?.timestamp
          ? this.formatDateLabel(day.items[0].timestamp)
          : day.date,
      items: day.items.map((item) => ({
        ...item,
        timeFormatted: item.timestamp
          ? this.formatTimeInDisplayZone(item.timestamp)
          : item.timeFormatted,
      })),
    }));
  }

  private getStoredPreferences(userId: string): AIPreferences {
    const stored = localStorage.getItem(`${PREFS_PREFIX}${userId}`);
    if (!stored) {
      return DEFAULT_PREFERENCES;
    }

    try {
      return {
        ...DEFAULT_PREFERENCES,
        ...(JSON.parse(stored) as Partial<AIPreferences>),
      };
    } catch {
      return DEFAULT_PREFERENCES;
    }
  }

  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    const result = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });

    if (result.success && result.data) {
      this.setUserId(result.data.userId);
      return result;
    }

    const userId = credentials.email.trim() || 'child-1';
    const parentName = userId.split('@')[0] || 'Parent';
    const fallback: LoginResponse = {
      token: `local-session-${Date.now()}`,
      userId,
      parentName,
      childName: 'Child',
    };

    this.setUserId(userId);

    return {
      success: true,
      data: fallback,
      timestamp: new Date().toISOString(),
    };
  }

  async logout(): Promise<void> {
    this.clearToken();
    this.clearUserId();
  }

  async getDashboardSummary(userId: string): Promise<ApiResponse<DashboardSummary>> {
    const safeUserId = encodeURIComponent(userId);
    const dedicated = await this.getFirstAvailable([
      `/dashboard/summary?userId=${safeUserId}`,
      `/dashboard/summary?user_id=${safeUserId}`,
    ]);

    if (dedicated && !Array.isArray(dedicated)) {
      return {
        success: true,
        data: dedicated as DashboardSummary,
        timestamp: new Date().toISOString(),
      };
    }

    const events = await this.getEventRecords(userId);
    return {
      success: true,
      data: this.deriveDashboardSummary(events),
      timestamp: new Date().toISOString(),
    };
  }

  async getMoodTrends(userId: string, days = 7): Promise<ApiResponse<MoodDataPoint[]>> {
    const safeUserId = encodeURIComponent(userId);
    const dedicated = await this.getFirstAvailable([
      `/dashboard/mood-trends?userId=${safeUserId}&days=${days}`,
      `/dashboard/mood-trends?user_id=${safeUserId}&days=${days}`,
    ]);

    const dedicatedItems = this.asArray(dedicated);
    if (dedicatedItems.length > 0) {
      return {
        success: true,
        data: dedicatedItems as MoodDataPoint[],
        timestamp: new Date().toISOString(),
      };
    }

    const events = await this.getEventRecords(userId);
    return {
      success: true,
      data: this.deriveMoodTrends(events, days),
      timestamp: new Date().toISOString(),
    };
  }

  async getAlerts(userId: string, page = 0, size = 10): Promise<ApiResponse<Alert[]>> {
    const safeUserId = encodeURIComponent(userId);
    const dedicated = await this.getFirstAvailable([
      `/alerts?userId=${safeUserId}&page=${page}&size=${size}`,
      `/alerts?user_id=${safeUserId}&page=${page}&size=${size}`,
    ]);

    const dedicatedItems = this.asArray(dedicated);
    if (dedicatedItems.length > 0) {
      return {
        success: true,
        data: dedicatedItems as Alert[],
        timestamp: new Date().toISOString(),
      };
    }

    const events = await this.getEventRecords(userId);
    return {
      success: true,
      data: this.deriveAlerts(events, size),
      timestamp: new Date().toISOString(),
    };
  }

  async getConversations(
    userId: string,
    page = 0,
    size = 50
  ): Promise<ApiResponse<ConversationDay[]>> {
    const safeUserId = encodeURIComponent(userId);
    const dedicated = await this.getFirstAvailable([
      `/conversations?userId=${safeUserId}&page=${page}&size=${size}`,
      `/conversations?user_id=${safeUserId}&page=${page}&size=${size}`,
    ]);

    if (this.looksLikeConversationDays(dedicated)) {
      return {
        success: true,
        data: this.normalizeConversationDays(dedicated),
        timestamp: new Date().toISOString(),
      };
    }

    const events = dedicated
      ? this.asArray(dedicated)
          .map((item) => this.normalizeEventRecord(item))
          .filter((item): item is BackendEventRecord => item !== null)
      : await this.getEventRecords(userId, size);

    return {
      success: true,
      data: this.deriveConversationDays(events),
      timestamp: new Date().toISOString(),
    };
  }

  async searchConversations(
    userId: string,
    query: string
  ): Promise<ApiResponse<ConversationDay[]>> {
    const response = await this.getConversations(userId, 0, 100);
    if (!response.success || !response.data) {
      return response;
    }

    const searchValue = query.trim().toLowerCase();
    if (!searchValue) {
      return response;
    }

    const filtered = response.data
      .map((day) => ({
        ...day,
        items: day.items.filter((item) => {
          const haystack = [
            item.content,
            item.summary,
            item.aiReply,
            item.topic,
            item.keywords?.join(' '),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();

          return haystack.includes(searchValue);
        }),
      }))
      .filter((day) => day.items.length > 0);

    return {
      success: true,
      data: filtered,
      timestamp: new Date().toISOString(),
    };
  }

  async getPreferences(userId: string): Promise<ApiResponse<AIPreferences>> {
    const response = await this.request<AIPreferences>(`/preferences/${encodeURIComponent(userId)}`, {
      method: 'GET',
    });

    if (response.success && response.data) {
      return response;
    }

    return {
      success: true,
      data: this.getStoredPreferences(userId),
      timestamp: new Date().toISOString(),
    };
  }

  async updatePreferences(
    userId: string,
    preferences: AIPreferences
  ): Promise<ApiResponse<AIPreferences>> {
    const requestBody: UpdatePreferencesRequest = {
      userId,
      preferences,
    };

    const response = await this.request<AIPreferences>(`/preferences/${encodeURIComponent(userId)}`, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });

    if (response.success && response.data) {
      localStorage.setItem(`${PREFS_PREFIX}${userId}`, JSON.stringify(response.data));
      return response;
    }

    localStorage.setItem(`${PREFS_PREFIX}${userId}`, JSON.stringify(preferences));
    return {
      success: true,
      data: preferences,
      timestamp: new Date().toISOString(),
    };
  }
}

export const apiService = new ApiService();
