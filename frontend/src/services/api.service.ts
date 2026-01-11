/**
 * API Service Layer - handles all HTTP communication with Java backend
 * This follows the Service pattern common in Spring Boot applications
 * 
 * Backend endpoints expected:
 * - POST   /api/auth/login
 * - GET    /api/dashboard/summary
 * - GET    /api/dashboard/mood-trends?days=7
 * - GET    /api/alerts?page=0&size=10
 * - GET    /api/conversations?page=0&size=20
 * - GET    /api/preferences/{userId}
 * - PUT    /api/preferences/{userId}
 */

import type {
  LoginRequest,
  LoginResponse,
  DashboardSummary,
  MoodDataPoint,
  Alert,
  ConversationDay,
  AIPreferences,
  UpdatePreferencesRequest,
  ApiResponse,
} from '../types';

// Configure your Java backend URL here
const API_BASE_URL = 'http://localhost:8080/api';

class ApiService {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('authToken', token);
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('authToken');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('authToken');
  }

    private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> | undefined),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.message || 'An error occurred',
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
        timestamp: new Date().toISOString(),
      };
    }
  }


  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<ApiResponse<LoginResponse>> {
    return this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async logout(): Promise<void> {
    this.clearToken();
  }

  // Dashboard endpoints
  async getDashboardSummary(): Promise<ApiResponse<DashboardSummary>> {
    return this.request<DashboardSummary>('/dashboard/summary', {
      method: 'GET',
    });
  }

  async getMoodTrends(days: number = 7): Promise<ApiResponse<MoodDataPoint[]>> {
    return this.request<MoodDataPoint[]>(`/dashboard/mood-trends?days=${days}`, {
      method: 'GET',
    });
  }

  async getAlerts(page: number = 0, size: number = 10): Promise<ApiResponse<Alert[]>> {
    return this.request<Alert[]>(`/alerts?page=${page}&size=${size}`, {
      method: 'GET',
    });
  }

  // Conversation endpoints
  async getConversations(
    page: number = 0,
    size: number = 20
  ): Promise<ApiResponse<ConversationDay[]>> {
    return this.request<ConversationDay[]>(`/conversations?page=${page}&size=${size}`, {
      method: 'GET',
    });
  }

  async searchConversations(query: string): Promise<ApiResponse<ConversationDay[]>> {
    return this.request<ConversationDay[]>(`/conversations/search?q=${encodeURIComponent(query)}`, {
      method: 'GET',
    });
  }

  // Preferences endpoints
  async getPreferences(userId: string): Promise<ApiResponse<AIPreferences>> {
    return this.request<AIPreferences>(`/preferences/${userId}`, {
      method: 'GET',
    });
  }

  async updatePreferences(
    userId: string,
    preferences: AIPreferences
  ): Promise<ApiResponse<AIPreferences>> {
    const requestBody: UpdatePreferencesRequest = {
      userId,
      preferences,
    };
    return this.request<AIPreferences>(`/preferences/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(requestBody),
    });
  }
}

// Singleton instance (similar to @Service in Spring Boot)
export const apiService = new ApiService();
