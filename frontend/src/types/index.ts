// DTO-like interfaces that mirror Java backend models

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
  id: number;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  message: string;
  timestamp: string;
  timeAgo: string;
}

export interface ConversationItem {
  id: number;
  timestamp: string;
  timeFormatted: string;
  type: 'QUESTION' | 'CHAT' | 'STORY' | 'GAME';
  content: string;
  mood: string;
  flagged: boolean;
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

