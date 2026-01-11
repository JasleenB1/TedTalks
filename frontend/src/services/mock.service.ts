/**
 * Mock Service - provides mock data for development
 * Remove this and use real apiService when Java backend is ready
 */

import type {
  LoginResponse,
  DashboardSummary,
  MoodDataPoint,
  Alert,
  ConversationDay,
  AIPreferences,
  ApiResponse,
} from '../types';

export class MockService {
  // Simulate network delay
  private async delay(ms: number = 500): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async login(): Promise<ApiResponse<LoginResponse>> {
    await this.delay();
    return {
      success: true,
      data: {
        token: 'mock-jwt-token-' + Date.now(),
        userId: 'user-123',
        parentName: 'Sarah Johnson',
        childName: 'Emma',
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getDashboardSummary(): Promise<ApiResponse<DashboardSummary>> {
    await this.delay(300);
    return {
      success: true,
      data: {
        conversationCount: 12,
        activeTimeMinutes: 45,
        currentMood: '😊',
        lastActiveTimestamp: new Date(Date.now() - 10 * 60000).toISOString(),
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getMoodTrends(): Promise<ApiResponse<MoodDataPoint[]>> {
    await this.delay(300);
    return {
      success: true,
      data: [
        { day: 'Mon', mood: 4, date: '2026-01-04' },
        { day: 'Tue', mood: 5, date: '2026-01-05' },
        { day: 'Wed', mood: 3, date: '2026-01-06' },
        { day: 'Thu', mood: 4, date: '2026-01-07' },
        { day: 'Fri', mood: 5, date: '2026-01-08' },
        { day: 'Sat', mood: 4, date: '2026-01-09' },
        { day: 'Sun', mood: 5, date: '2026-01-10' },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  async getAlerts(): Promise<ApiResponse<Alert[]>> {
    await this.delay(300);
    return {
      success: true,
      data: [
        {
          id: 1,
          type: 'INFO',
          message: 'Your kid is being bullied at school.',
          timestamp: new Date(Date.now() - 2 * 3600000).toISOString(),
          timeAgo: '3 mins ago',
        },
        {
          id: 2,
          type: 'SUCCESS',
          message: 'Daily check-in completed',
          timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
          timeAgo: '5 hous ago',
        },
        {
          id: 3,
          type: 'WARNING',
          message: 'Unusual conversation topic detected',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          timeAgo: '1 day ago',
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  async getConversations(): Promise<ApiResponse<ConversationDay[]>> {
    await this.delay(400);
    return {
      success: true,
      data: [
        {
          date: 'Today',
          items: [
            {
              id: 101,
              timestamp: new Date().toISOString(),
              timeFormatted: '2:45 AM',
              type: 'QUESTION', 
              content: "Can you tell me a story about a little boy who likes airplane?",
              mood: '😊',
              flagged: false,
            },
            {
              id: 102,
              timestamp: new Date(Date.now() - 3 * 3600000).toISOString(),
              timeFormatted: '1:30 AM',
              type: 'CHAT',
              content: "I'm getting bored at school. I need you to help me.",
              mood: '🏫',
              flagged: false,
            },
            {
              id: 103,
              timestamp: new Date(Date.now() - 5 * 3600000).toISOString(),
              timeFormatted: '9:15 PM',
              type: 'STORY',
              content: "I'm getting bullied at school. I need you to help me stand up for myself",
              mood: '😫',
              flagged: true,
            },
          ],
        },
        {
          date: 'Yesterday',
          items: [
            {
              id: 201,
              timestamp: new Date(Date.now() - 86400000 - 2 * 3600000).toISOString(),
              timeFormatted: '4:20 PM',
              type: 'QUESTION',
              content: 'How do I practice my spelling words?',
              mood: '📚',
              flagged: false,
            },
            {
              id: 202,
              timestamp: new Date(Date.now() - 86400000 - 3 * 3600000).toISOString(),
              timeFormatted: '3:10 PM',
              type: 'CHAT',
              content: "I'm feeling a bit sad today",
              mood: '😔',
              flagged: true,
            },
            {
              id: 203,
              timestamp: new Date(Date.now() - 86400000 - 6 * 3600000).toISOString(),
              timeFormatted: '10:00 AM',
              type: 'GAME',
              content: "Let's play a word game",
              mood: '🎮',
              flagged: false,
            },
          ],
        },
        {
          date: 'Jan 8',
          items: [
            {
              id: 301,
              timestamp: new Date(Date.now() - 2 * 86400000 - 1 * 3600000).toISOString(),
              timeFormatted: '5:30 PM',
              type: 'QUESTION',
              content: 'What are the planets in our solar system?',
              mood: '🪐',
              flagged: false,
            },
            {
              id: 302,
              timestamp: new Date(Date.now() - 2 * 86400000 - 4 * 3600000).toISOString(),
              timeFormatted: '2:15 PM',
              type: 'CHAT',
              content: 'I had a great day at school!',
              mood: '😄',
              flagged: false,
            },
          ],
        },
      ],
      timestamp: new Date().toISOString(),
    };
  }

  async getPreferences(): Promise<ApiResponse<AIPreferences>> {
    await this.delay(300);
    return {
      success: true,
      data: {
        voiceType: 'friendly-female',
        responseStyle: 'balanced',
        contentLevel: 'ages-6-8',
        sessionDurationMinutes: 30,
        learningFocus: 'general',
      },
      timestamp: new Date().toISOString(),
    };
  }

  async updatePreferences(preferences: AIPreferences): Promise<ApiResponse<AIPreferences>> {
    await this.delay(500);
    return {
      success: true,
      data: preferences,
      timestamp: new Date().toISOString(),
    };
  }
}

export const mockService = new MockService();

