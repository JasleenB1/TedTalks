"""
Database Models - Pydantic schemas for MongoDB documents
"""

from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field

# ============================================================================
# User Models
# ============================================================================

class UserProfile(BaseModel):
    """User profile document"""
    username: str
    email: str
    displayName: str
    password: str  # Note: use bcrypt or similar for hashing in production
    avatar: Optional[str] = None
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    class Config:
        collection = "profiles"


class UserPreferences(BaseModel):
    """User preferences document"""
    userId: str
    theme: str = "light"  # light, dark
    notifications: bool = True
    language: str = "en"
    aiModel: str = "gemini-1.5-flash"
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    class Config:
        collection = "preferences"


# ============================================================================
# Conversation Models
# ============================================================================

class ConversationItem(BaseModel):
    """Individual conversation item"""
    childText: str
    assistantText: str
    emotionLabel: Optional[str] = None
    moodEmoji: Optional[str] = None
    timestamp: Optional[str] = None
    flagged: bool = False
    severity: Optional[str] = None  # low, medium, high


class Conversation(BaseModel):
    """Conversation document"""
    userId: str
    conversationId: str
    items: List[ConversationItem]
    topic: Optional[str] = None
    summary: Optional[str] = None
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updatedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    class Config:
        collection = "conversations"


# ============================================================================
# Alert Models
# ============================================================================

class Alert(BaseModel):
    """Alert document"""
    userId: str
    message: str
    severity: str  # low, medium, high, critical
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    resolved: bool = False
    resolutionNotes: Optional[str] = None
    conversationId: Optional[str] = None
    
    class Config:
        collection = "alerts"


# ============================================================================
# Mood Events Models
# ============================================================================

class MoodEvent(BaseModel):
    """Mood event document"""
    userId: str
    emotion: str
    emoji: str
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    confidence: float = 1.0
    source: str = "conversation"  # conversation, manual, prediction
    
    class Config:
        collection = "mood_events"


# ============================================================================
# Usage Events Models
# ============================================================================

class UsageEvent(BaseModel):
    """Usage tracking document"""
    userId: str
    eventType: str  # login, conversation_start, conversation_end, settings_update, etc.
    metadata: dict = {}
    timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    
    class Config:
        collection = "usage_events"
