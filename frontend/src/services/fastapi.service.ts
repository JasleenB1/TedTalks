/**
 * FastAPI Service Layer
 * Connects frontend to FastAPI + MongoDB backend
 * 
 * Setup:
 * 1. Create backend/.env with:
 *    MONGODB_URI=your-mongo-connection-string
 *    MONGODB_DB=teddy-cluster
 *    FRONTEND_URL=http://localhost:5173
 * 
 * 2. Run backend:
 *    cd backend
 *    pip install -r requirements.txt
 *    python main.py
 */

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

// Use backend URL from environment or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api";

class FastAPIService {
  private token: string | null = null;
  private userId: string | null = null;

  constructor() {
    this.token = localStorage.getItem("authToken");
    this.userId = localStorage.getItem("userId");
  }

  /**
   * Make HTTP request to backend
   */
  private async request<T>(
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: any
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, options);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: "Unknown error" }));
        throw new Error(error.detail || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API Error: ${endpoint}`, error);
      throw error;
    }
  }

  // ========================================================================
  // Authentication
  // ========================================================================

  async login(request: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    try {
      console.log("Sending login request:", request);
      const response = await this.request<any>(
        "/auth/login",
        "POST",
        request
      );

      console.log("Login response:", response);

      if (response && response.success) {
        if (response.token) {
          this.token = response.token;
          localStorage.setItem("authToken", response.token);
        }
        if (response.userId) {
          this.userId = response.userId;
          localStorage.setItem("userId", response.userId);
        }
      }

      return {
        success: response?.success || false,
        data: response,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Login error:", error);
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : "Login failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async logout(): Promise<ApiResponse<{ success: boolean }>> {
    try {
      await this.request("/auth/logout", "POST");
      
      this.token = null;
      this.userId = null;
      localStorage.removeItem("authToken");
      localStorage.removeItem("userId");

      return {
        success: true,
        data: { success: true },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : "Logout failed",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ========================================================================
  // Conversations
  // ========================================================================

  async saveConversation(
    items: ConversationItem[],
    conversationId?: string
  ): Promise<ApiResponse<{ conversationId: string }>> {
    try {
      if (!this.userId) {
        throw new Error("User not authenticated");
      }

      const response = await this.request(
        "/conversations/save",
        "POST",
        {
          userId: this.userId,
          conversationId,
          items: items.map((item) => ({
            childText: item.childText,
            assistantText: item.assistantText,
            emotionLabel: item.emotionLabel,
            moodEmoji: item.moodEmoji,
            timestamp: item.timestamp,
            flagged: item.flagged || false,
          })),
        }
      );

      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : "Failed to save conversation",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getConversations(): Promise<ApiResponse<ConversationDay[]>> {
    try {
      if (!this.userId) {
        throw new Error("User not authenticated");
      }

      const response = await this.request<{
        success: boolean;
        conversations: any[];
      }>(`/conversations/${this.userId}`);

      // Transform MongoDB documents into ConversationDay format
      const conversationDays: ConversationDay[] = response.conversations.map(
        (conv) => ({
          date: new Date(conv.timestamp).toLocaleDateString(),
          items: conv.items || [],
        })
      );

      return {
        success: true,
        data: conversationDays,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Failed to fetch conversations",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getConversation(conversationId: string): Promise<ApiResponse<ConversationDay>> {
    try {
      if (!this.userId) {
        throw new Error("User not authenticated");
      }

      const response = await this.request<{ success: boolean; conversation: any }>(
        `/conversations/${this.userId}/${conversationId}`
      );

      const conversation: ConversationDay = {
        date: new Date(response.conversation.timestamp).toLocaleDateString(),
        items: response.conversation.items || [],
      };

      return {
        success: true,
        data: conversation,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        data: { date: "", items: [] },
        error: error instanceof Error ? error.message : "Failed to fetch conversation",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ========================================================================
  // Dashboard
  // ========================================================================

  async getDashboardSummary(): Promise<ApiResponse<DashboardSummary>> {
    try {
      if (!this.userId) {
        throw new Error("User not authenticated");
      }

      const response = await this.request<{
        success: boolean;
        dashboard: DashboardSummary;
      }>(`/dashboard/${this.userId}`);

      return {
        success: true,
        data: response.dashboard,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : "Failed to fetch dashboard",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ========================================================================
  // Alerts
  // ========================================================================

  async getAlerts(): Promise<ApiResponse<Alert[]>> {
    try {
      if (!this.userId) {
        throw new Error("User not authenticated");
      }

      const response = await this.request<{
        success: boolean;
        alerts: Alert[];
      }>(`/alerts/${this.userId}`);

      return {
        success: true,
        data: response.alerts,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : "Failed to fetch alerts",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async createAlert(alert: Omit<Alert, "id">): Promise<ApiResponse<Alert>> {
    try {
      const response = await this.request<{
        success: boolean;
        alert: Alert;
      }>("/alerts", "POST", alert);

      return {
        success: true,
        data: response.alert,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : "Failed to create alert",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ========================================================================
  // Preferences
  // ========================================================================

  async getPreferences(): Promise<ApiResponse<AIPreferences>> {
    try {
      if (!this.userId) {
        throw new Error("User not authenticated");
      }

      const response = await this.request<{
        success: boolean;
        preferences: AIPreferences;
      }>(`/preferences/${this.userId}`);

      return {
        success: true,
        data: response.preferences,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        data: {} as AIPreferences,
        error: error instanceof Error ? error.message : "Failed to fetch preferences",
        timestamp: new Date().toISOString(),
      };
    }
  }

  async updatePreferences(prefs: Partial<AIPreferences>): Promise<ApiResponse<{ success: boolean }>> {
    try {
      if (!this.userId) {
        throw new Error("User not authenticated");
      }

      const response = await this.request<{ success: boolean }>(
        `/preferences/${this.userId}`,
        "POST",
        prefs
      );

      return {
        success: true,
        data: response,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        data: null as any,
        error: error instanceof Error ? error.message : "Failed to update preferences",
        timestamp: new Date().toISOString(),
      };
    }
  }

  // ========================================================================
  // Token Management
  // ========================================================================

  setToken(token: string) {
    this.token = token;
    localStorage.setItem("authToken", token);
  }

  getToken(): string | null {
    return this.token;
  }

  clearToken() {
    this.token = null;
    this.userId = null;
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
  }

  getUserId(): string | null {
    return this.userId;
  }

  setUserId(userId: string) {
    this.userId = userId;
    localStorage.setItem("userId", userId);
  }
}

export default new FastAPIService();
