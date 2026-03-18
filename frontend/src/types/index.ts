export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  userId: string;
  parentName: string;
  childName: string;
}

export interface DashboardSummary {
  conversationCount: number;
  activeTimeMinutes: number;
  currentMood: string;
  lastActiveTimestamp: string;
}

export interface MoodDataPoint {
  day: string;
  mood: number;
  date: string;
}

export interface Alert {
  id: string | number;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
  timestamp: string;
  timeAgo: string;
}

export interface BackendEventRecord {
  id: string;
  userId: string;
  deviceId: string;
  sessionId: string;
  timestamp: string;
  childText: string;
  aiText: string;
  eventType: string;
  analysisStatus: string;
  keywords: string[];
  emotionLabel: string | null;
  moodEmoji: string | null;
  topicLabel: string | null;
  summaryText: string | null;
  flagged: boolean;
  flagReasons: string[];
  interactionCount: number;
}

export interface ConversationItem {
  id: string;
  timestamp: string;
  timeFormatted: string;
  type: string;
  content: string;
  mood: string;
  flagged: boolean;
  topic?: string | null;
  keywords?: string[];
  summary?: string | null;
  aiReply?: string;
  sessionId?: string;
  interactionCount?: number;
  analysisStatus?: string;
}

export interface ConversationDay {
  date: string;
  items: ConversationItem[];
}

export interface AIPreferences {
  voiceType: string;
  responseStyle: string;
  contentLevel: string;
  sessionDurationMinutes: number;
  learningFocus: string;
}

export interface UpdatePreferencesRequest {
  userId: string;
  preferences: AIPreferences;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}
