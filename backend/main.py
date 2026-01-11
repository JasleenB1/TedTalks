"""
FastAPI Backend - MongoDB Integration
Main entry point for the API server
"""

import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from pymongo import MongoClient
from pymongo.errors import PyMongoError
from bson import ObjectId

load_dotenv()

# ============================================================================
# Configuration
# ============================================================================

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("MONGODB_DB", "teddy-cluster")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# MongoDB Collections
COLLECTIONS = {
    "profiles": "profiles",
    "preferences": "preferences",
    "conversations": "conversations",
    "alerts": "alerts",
    "mood_events": "mood_events",
    "usage_events": "usage_events",
}

# ============================================================================
# MongoDB Connection
# ============================================================================

mongo_client = None
db = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    global mongo_client, db
    
    # Startup
    try:
        mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        mongo_client.admin.command('ping')
        db = mongo_client[DB_NAME]
        print("✅ MongoDB connected successfully")
    except PyMongoError as e:
        print(f"❌ MongoDB connection failed: {e}")
        raise
    
    yield
    
    # Shutdown
    if mongo_client:
        mongo_client.close()
        print("✅ MongoDB connection closed")

# ============================================================================
# FastAPI App
# ============================================================================

app = FastAPI(
    title="TedTalks API",
    description="Backend API for TedTalks Frontend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# Pydantic Models
# ============================================================================

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    userId: Optional[str] = None
    message: str

class ConversationItem(BaseModel):
    childText: str
    assistantText: str
    emotionLabel: Optional[str] = None
    moodEmoji: Optional[str] = None
    timestamp: Optional[str] = None
    flagged: bool = False

class ConversationRequest(BaseModel):
    userId: str
    conversationId: Optional[str] = None
    items: list[ConversationItem]

class MoodDataPoint(BaseModel):
    timestamp: str
    emotion: str
    emoji: str
    count: int

class DashboardSummary(BaseModel):
    userId: str
    totalConversations: int
    moodDistribution: list[MoodDataPoint]
    recentAlerts: list[dict]
    lastUpdated: str

class Alert(BaseModel):
    id: Optional[str] = None
    userId: str
    message: str
    severity: str  # low, medium, high
    timestamp: str
    resolved: bool = False

# ============================================================================
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "mongodb": "connected" if db is not None else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

# ============================================================================
# Authentication Routes
# ============================================================================

@app.post("/api/auth/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """
    Authenticate user
    Note: This is a simple mock. Implement proper authentication with hashing.
    """
    try:
        print(f"Login attempt: {request.username}")
        
        # Hardcoded test users for development
        TEST_USERS = {
            "test@example.com": "test",
            "demo@example.com": "demo",
            "parent@example.com": "password",
        }
        
        # Check hardcoded users first
        if request.username in TEST_USERS and TEST_USERS[request.username] == request.password:
            user_id = f"user-{request.username.replace('@', '-').replace('.', '-')}"
            print(f"✅ Login successful for {request.username}")
            return LoginResponse(
                success=True,
                token=f"token-{user_id}",
                userId=user_id,
                message="Login successful",
            )
        
        # Try database if available
        if db is not None:
            profiles = db[COLLECTIONS["profiles"]]
            user = profiles.find_one({"username": request.username})
            
            if user and user.get("password") == request.password:
                user_id = str(user["_id"])
                print(f"✅ Login successful for {request.username} (from DB)")
                return LoginResponse(
                    success=True,
                    token=f"token-{user_id}",
                    userId=user_id,
                    message="Login successful",
                )
        
        # Invalid credentials
        print(f"❌ Invalid credentials for {request.username}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )
    
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Login error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

@app.post("/api/auth/logout")
async def logout():
    """Logout user"""
    return {"success": True, "message": "Logged out successfully"}

# ============================================================================
# Conversation Routes
# ============================================================================

@app.post("/api/conversations/save")
async def save_conversation(request: ConversationRequest):
    """Save conversation to MongoDB"""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        conversations = db[COLLECTIONS["conversations"]]
        
        conversation_doc = {
            "userId": request.userId,
            "conversationId": request.conversationId or f"conv-{ObjectId()}",
            "items": [item.model_dump() for item in request.items],
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "updatedAt": datetime.now(timezone.utc).isoformat(),
        }
        
        if request.conversationId:
            conversations.update_one(
                {"conversationId": request.conversationId},
                {"$set": conversation_doc},
                upsert=True,
            )
        else:
            conversations.insert_one(conversation_doc)
        
        return {
            "success": True,
            "conversationId": conversation_doc["conversationId"],
            "message": "Conversation saved successfully",
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save conversation: {str(e)}")

@app.get("/api/conversations/{user_id}")
async def get_conversations(user_id: str):
    """Get all conversations for a user - DEMO MODE with hardcoded data"""
    try:
        # HARDCODED DEMO CONVERSATIONS
        demo_conversations = [
            {
                "userId": user_id,
                "conversationId": "conv-001",
                "timestamp": "2026-01-11T06:32:37.016132+00:00",
                "items": [
                    {
                        "childText": "Teddy, I'm not feeling well. My head hurts really bad.",
                        "assistantText": "I'm sorry to hear you're not feeling well. Headaches can be really uncomfortable. Have you told your parents about this?",
                        "emotionLabel": "worried",
                        "moodEmoji": "😰",
                        "timestamp": "2026-01-11T06:32:37.016132+00:00",
                        "flagged": True,
                    }
                ],
            },
            {
                "userId": user_id,
                "conversationId": "conv-002",
                "timestamp": "2026-01-11T05:15:22.345678+00:00",
                "items": [
                    {
                        "childText": "I'm really scared about my test tomorrow. What if I fail?",
                        "assistantText": "It's completely normal to feel nervous before a test. Let's talk about what's worrying you the most.",
                        "emotionLabel": "anxious",
                        "moodEmoji": "😰",
                        "timestamp": "2026-01-11T05:15:22.345678+00:00",
                        "flagged": True,
                    }
                ],
            },
            {
                "userId": user_id,
                "conversationId": "conv-003",
                "timestamp": "2026-01-10T18:45:10.789012+00:00",
                "items": [
                    {
                        "childText": "I didn't eat my lunch today. I wasn't hungry.",
                        "assistantText": "I understand. Sometimes we don't feel like eating. Did something happen that made you lose your appetite?",
                        "emotionLabel": "sad",
                        "moodEmoji": "😢",
                        "timestamp": "2026-01-10T18:45:10.789012+00:00",
                        "flagged": True,
                    }
                ],
            },
            {
                "userId": user_id,
                "conversationId": "conv-004",
                "timestamp": "2026-01-10T14:22:15.123456+00:00",
                "items": [
                    {
                        "childText": "I had bad dreams again last night. I'm tired.",
                        "assistantText": "I'm sorry you're having trouble sleeping. Nightmares can be scary. Would you like to talk about them?",
                        "emotionLabel": "tired",
                        "moodEmoji": "😔",
                        "timestamp": "2026-01-10T14:22:15.123456+00:00",
                        "flagged": True,
                    }
                ],
            },
            {
                "userId": user_id,
                "conversationId": "conv-005",
                "timestamp": "2026-01-09T16:30:45.567890+00:00",
                "items": [
                    {
                        "childText": "Nobody wanted to play with me at recess today.",
                        "assistantText": "That must have felt lonely. I'm here to listen. What happened at recess?",
                        "emotionLabel": "sad",
                        "moodEmoji": "😢",
                        "timestamp": "2026-01-09T16:30:45.567890+00:00",
                        "flagged": True,
                    }
                ],
            },
            {
                "userId": user_id,
                "conversationId": "conv-006",
                "timestamp": "2026-01-09T10:15:30.789012+00:00",
                "items": [
                    {
                        "childText": "Mom is going to be upset when she sees my report card.",
                        "assistantText": "I can understand why you might be worried. Let's talk about your grades and how you're feeling about school.",
                        "emotionLabel": "worried",
                        "moodEmoji": "😰",
                        "timestamp": "2026-01-09T10:15:30.789012+00:00",
                        "flagged": False,
                    }
                ],
            },
        ]
        
        return {
            "success": True,
            "conversations": demo_conversations,
            "count": len(demo_conversations),
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch conversations: {str(e)}")

@app.get("/api/conversations/{user_id}/{conversation_id}")
async def get_conversation(user_id: str, conversation_id: str):
    """Get specific conversation"""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        conversations = db[COLLECTIONS["conversations"]]
        conversation = conversations.find_one(
            {"userId": user_id, "conversationId": conversation_id},
            {"_id": 0}
        )
        
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return {"success": True, "conversation": conversation}
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch conversation: {str(e)}")

# ============================================================================
# Dashboard Routes
# ============================================================================

@app.get("/api/dashboard/{user_id}")
async def get_dashboard(user_id: str):
    """Get dashboard summary - DEMO MODE with hardcoded data"""
    try:
        # HARDCODED DEMO DATA
        demo_conversation_count = 24
        demo_active_time = 87  # minutes
        demo_current_mood = "😢"  # Sad mood - showing concern
        demo_last_active = "2026-01-11T07:40:47.820014+00:00"
        
        # Demo mood distribution based on real conversations
        mood_distribution = [
            MoodDataPoint(
                timestamp=datetime.now(timezone.utc).isoformat(),
                emotion="sad",
                emoji="😢",
                count=9,
            ),
            MoodDataPoint(
                timestamp=datetime.now(timezone.utc).isoformat(),
                emotion="worried",
                emoji="😰",
                count=8,
            ),
            MoodDataPoint(
                timestamp=datetime.now(timezone.utc).isoformat(),
                emotion="neutral",
                emoji="😐",
                count=5,
            ),
            MoodDataPoint(
                timestamp=datetime.now(timezone.utc).isoformat(),
                emotion="happy",
                emoji="😊",
                count=2,
            ),
        ]
        
        # Demo alerts for flagged conversations - SERIOUS ISSUES (3 alerts)
        recent_alerts = [
            {
                "userId": user_id,
                "message": "Child reported feeling sick with persistent headaches - medical attention recommended",
                "severity": "high",
                "timestamp": "2026-01-11T06:32:37.016132+00:00",
                "flagged": True,
            },
            {
                "userId": user_id,
                "message": "Expressed severe anxiety about school performance and fear of failure",
                "severity": "high",
                "timestamp": "2026-01-11T05:15:22.345678+00:00",
                "flagged": True,
            },
            {
                "userId": user_id,
                "message": "Multiple mentions of not eating properly - possible eating concerns",
                "severity": "medium",
                "timestamp": "2026-01-10T18:45:10.789012+00:00",
                "flagged": True,
            },
        ]
        
        dashboard = DashboardSummary(
            userId=user_id,
            totalConversations=demo_conversation_count,
            moodDistribution=mood_distribution,
            recentAlerts=recent_alerts,
            lastUpdated=datetime.now(timezone.utc).isoformat(),
        )
        
        # Return demo data for frontend
        return {
            "success": True,
            "conversationCount": demo_conversation_count,
            "activeTimeMinutes": demo_active_time,
            "currentMood": demo_current_mood,
            "lastActiveTimestamp": demo_last_active,
            "dashboard": dashboard.model_dump()
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch dashboard: {str(e)}")

# ============================================================================
# Alert Routes
# ============================================================================

@app.get("/api/alerts/{user_id}")
async def get_alerts(user_id: str):
    """Get all alerts for a user - DEMO MODE with hardcoded data"""
    try:
        # HARDCODED DEMO ALERTS - SERIOUS ISSUES (3 alerts)
        demo_alerts = [
            {
                "userId": user_id,
                "message": "Child reported feeling sick with persistent headaches - medical attention recommended",
                "severity": "high",
                "timestamp": "2026-01-11T06:32:37.016132+00:00",
                "flagged": True,
            },
            {
                "userId": user_id,
                "message": "Expressed severe anxiety about school performance and fear of failure",
                "severity": "high",
                "timestamp": "2026-01-11T05:15:22.345678+00:00",
                "flagged": True,
            },
            {
                "userId": user_id,
                "message": "Multiple mentions of not eating properly - possible eating concerns",
                "severity": "medium",
                "timestamp": "2026-01-10T18:45:10.789012+00:00",
                "flagged": True,
            },
        ]
        
        return {"success": True, "alerts": demo_alerts, "count": len(demo_alerts)}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch alerts: {str(e)}")

@app.post("/api/alerts")
async def create_alert(alert: Alert):
    """Create a new alert"""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        alerts_col = db[COLLECTIONS["alerts"]]
        
        alert_doc = {
            "userId": alert.userId,
            "message": alert.message,
            "severity": alert.severity,
            "timestamp": alert.timestamp,
            "resolved": alert.resolved,
        }
        
        result = alerts_col.insert_one(alert_doc)
        alert_doc["_id"] = str(result.inserted_id)
        
        return {"success": True, "alert": alert_doc, "message": "Alert created successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create alert: {str(e)}")

# ============================================================================
# Preferences Routes
# ============================================================================

@app.get("/api/preferences/{user_id}")
async def get_preferences(user_id: str):
    """Get user preferences"""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        preferences = db[COLLECTIONS["preferences"]]
        
        prefs = preferences.find_one(
            {"userId": user_id},
            {"_id": 0}
        )
        
        if not prefs:
            # Return default preferences
            prefs = {
                "userId": user_id,
                "theme": "light",
                "notifications": True,
                "language": "en",
            }
        
        return {"success": True, "preferences": prefs}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch preferences: {str(e)}")

@app.post("/api/preferences/{user_id}")
async def update_preferences(user_id: str, preferences: dict):
    """Update user preferences"""
    try:
        if db is None:
            raise HTTPException(status_code=500, detail="Database connection failed")
        
        prefs_col = db[COLLECTIONS["preferences"]]
        
        prefs_col.update_one(
            {"userId": user_id},
            {"$set": {"userId": user_id, **preferences, "updatedAt": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        
        return {"success": True, "message": "Preferences updated successfully"}
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update preferences: {str(e)}")

# ============================================================================
# Root
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Welcome to TedTalks API",
        "docs": "/docs",
        "health": "/health",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info",
    )
