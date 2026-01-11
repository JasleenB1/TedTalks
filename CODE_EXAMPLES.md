# MongoDB + FastAPI - Code Examples

## Frontend Usage Examples

### Using the FastAPI Service in React Components

```typescript
import { useEffect, useState } from 'react';
import fastAPIService from '@/services/fastapi.service';

// Example 1: Login Component
function LoginScreen() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = async () => {
    const response = await fastAPIService.login({
      username,
      password,
    });

    if (response.success) {
      // User logged in successfully
      console.log('User ID:', response.data?.userId);
      // Navigate to dashboard
    } else {
      setError(response.error || 'Login failed');
    }
  };

  return (
    <div>
      <input 
        value={username} 
        onChange={(e) => setUsername(e.target.value)} 
        placeholder="Username"
      />
      <input 
        type="password"
        value={password} 
        onChange={(e) => setPassword(e.target.value)} 
        placeholder="Password"
      />
      {error && <div className="error">{error}</div>}
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}
```

### Example 2: Saving Conversations

```typescript
import { useEffect, useState } from 'react';
import fastAPIService from '@/services/fastapi.service';

function ConversationScreen() {
  const [items, setItems] = useState<ConversationItem[]>([]);

  const handleSaveConversation = async () => {
    const response = await fastAPIService.saveConversation(items);

    if (response.success) {
      console.log('Saved with ID:', response.data?.conversationId);
      // Show success message
    } else {
      console.error('Save failed:', response.error);
    }
  };

  const addMessage = (childText: string, assistantText: string) => {
    setItems([
      ...items,
      {
        childText,
        assistantText,
        emotionLabel: 'happy',
        moodEmoji: '😊',
        timestamp: new Date().toISOString(),
        flagged: false,
      },
    ]);
  };

  return (
    <div>
      <button onClick={() => addMessage('Hello', 'Hi there!')}>Add Message</button>
      <button onClick={handleSaveConversation}>Save Conversation</button>
    </div>
  );
}
```

### Example 3: Dashboard with Analytics

```typescript
import { useEffect, useState } from 'react';
import fastAPIService from '@/services/fastapi.service';
import type { DashboardSummary } from '@/types';

function DashboardScreen() {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      const response = await fastAPIService.getDashboardSummary();
      if (response.success) {
        setDashboard(response.data);
      }
      setLoading(false);
    };

    loadDashboard();
    
    // Refresh every 5 minutes
    const interval = setInterval(loadDashboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading...</div>;
  if (!dashboard) return <div>No data</div>;

  return (
    <div>
      <h1>Dashboard</h1>
      <div>Total Conversations: {dashboard.totalConversations}</div>
      <div>
        <h2>Mood Distribution</h2>
        {dashboard.moodDistribution.map((mood) => (
          <div key={mood.emotion}>
            {mood.emoji} {mood.emotion}: {mood.count}
          </div>
        ))}
      </div>
      <div>
        <h2>Recent Alerts</h2>
        {dashboard.recentAlerts.map((alert) => (
          <div key={alert.id} className={`alert-${alert.severity}`}>
            {alert.message}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Example 4: Managing Alerts

```typescript
import fastAPIService from '@/services/fastapi.service';

// Get all alerts
async function loadAlerts() {
  const response = await fastAPIService.getAlerts();
  if (response.success) {
    console.log('Alerts:', response.data);
  }
}

// Create a new alert
async function createAlert() {
  const response = await fastAPIService.createAlert({
    userId: 'user-123',
    message: 'User expressed concerning thoughts',
    severity: 'high',
    timestamp: new Date().toISOString(),
    resolved: false,
  });

  if (response.success) {
    console.log('Alert created:', response.data);
  }
}
```

### Example 5: User Preferences

```typescript
import { useEffect, useState } from 'react';
import fastAPIService from '@/services/fastapi.service';

function SettingsScreen() {
  const [prefs, setPrefs] = useState<any>(null);

  useEffect(() => {
    const loadPrefs = async () => {
      const response = await fastAPIService.getPreferences();
      if (response.success) {
        setPrefs(response.data);
      }
    };

    loadPrefs();
  }, []);

  const handleThemeChange = async (theme: string) => {
    const response = await fastAPIService.updatePreferences({ theme });
    if (response.success) {
      setPrefs({ ...prefs, theme });
    }
  };

  return (
    <div>
      <h1>Settings</h1>
      <label>
        Theme:
        <select 
          value={prefs?.theme || 'light'}
          onChange={(e) => handleThemeChange(e.target.value)}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
    </div>
  );
}
```

## Backend Usage Examples

### FastAPI Route Implementation

```python
from fastapi import FastAPI, HTTPException
from datetime import datetime, timezone
from pymongo import MongoClient

app = FastAPI()
db = MongoClient("mongodb://localhost:27017")["teddy-cluster"]

# Example 1: Basic GET endpoint
@app.get("/api/conversations/{user_id}")
async def get_conversations(user_id: str):
    try:
        conversations_col = db["conversations"]
        conversations = list(conversations_col.find(
            {"userId": user_id},
            {"_id": 0}
        ).sort("timestamp", -1))
        
        return {
            "success": True,
            "conversations": conversations,
            "count": len(conversations)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Example 2: POST endpoint with validation
@app.post("/api/conversations/save")
async def save_conversation(request: ConversationRequest):
    try:
        conversations_col = db["conversations"]
        
        doc = {
            "userId": request.userId,
            "conversationId": request.conversationId or f"conv-{ObjectId()}",
            "items": [item.dict() for item in request.items],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        
        conversations_col.update_one(
            {"conversationId": doc["conversationId"]},
            {"$set": doc},
            upsert=True
        )
        
        return {
            "success": True,
            "conversationId": doc["conversationId"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

### Pydantic Model Definition

```python
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from typing import Optional, List

class ConversationItem(BaseModel):
    childText: str
    assistantText: str
    emotionLabel: Optional[str] = None
    moodEmoji: Optional[str] = None
    timestamp: Optional[str] = None
    flagged: bool = False

    class Config:
        schema_extra = {
            "example": {
                "childText": "I'm feeling sad",
                "assistantText": "What's making you sad?",
                "emotionLabel": "sad",
                "moodEmoji": "😢",
                "timestamp": "2024-01-11T10:00:00Z",
                "flagged": False
            }
        }

class ConversationRequest(BaseModel):
    userId: str
    conversationId: Optional[str] = None
    items: List[ConversationItem]
```

### MongoDB Aggregation Pipeline Example

```python
# Get mood distribution for dashboard
mood_pipeline = [
    {"$match": {"userId": user_id}},
    {"$unwind": "$items"},
    {"$group": {
        "_id": "$items.emotionLabel",
        "count": {"$sum": 1},
        "emoji": {"$first": "$items.moodEmoji"},
    }},
    {"$sort": {"count": -1}},
]

mood_data = list(db["conversations"].aggregate(mood_pipeline))

mood_distribution = [
    {
        "emotion": m["_id"],
        "emoji": m.get("emoji", ""),
        "count": m["count"],
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    for m in mood_data if m["_id"]
]
```

### Error Handling Pattern

```python
from fastapi import HTTPException, status

try:
    # Validate input
    if not request.userId:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="userId is required"
        )
    
    # Check authentication
    if not user_is_authenticated():
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Perform operation
    result = db["collection"].find_one({"_id": id})
    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resource not found"
        )
    
    return {"success": True, "data": result}

except HTTPException:
    raise  # Re-raise HTTP exceptions
except Exception as e:
    # Log error
    print(f"Error: {e}")
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="Internal server error"
    )
```

## CURL Examples

### Authentication

```bash
# Login
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'

# Response
{
  "success": true,
  "token": "token-507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439011",
  "message": "Login successful"
}
```

### Save Conversation

```bash
curl -X POST http://localhost:8000/api/conversations/save \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "conversationId": "conv-456",
    "items": [
      {
        "childText": "I am worried about my grades",
        "assistantText": "Tell me more about your concerns",
        "emotionLabel": "anxious",
        "moodEmoji": "😟",
        "timestamp": "2024-01-11T10:00:00Z",
        "flagged": false
      }
    ]
  }'

# Response
{
  "success": true,
  "conversationId": "conv-456",
  "message": "Conversation saved successfully"
}
```

### Get Conversations

```bash
curl -X GET http://localhost:8000/api/conversations/user-123 \
  -H "Authorization: Bearer token-507f1f77bcf86cd799439011"

# Response
{
  "success": true,
  "conversations": [
    {
      "userId": "user-123",
      "conversationId": "conv-456",
      "items": [...],
      "timestamp": "2024-01-11T10:00:00Z"
    }
  ],
  "count": 1
}
```

### Get Dashboard

```bash
curl -X GET http://localhost:8000/api/dashboard/user-123

# Response
{
  "success": true,
  "dashboard": {
    "userId": "user-123",
    "totalConversations": 42,
    "moodDistribution": [
      {
        "emotion": "happy",
        "emoji": "😊",
        "count": 18
      }
    ],
    "recentAlerts": [
      {
        "userId": "user-123",
        "message": "Concerning keywords detected",
        "severity": "medium",
        "timestamp": "2024-01-11T10:00:00Z",
        "resolved": false
      }
    ],
    "lastUpdated": "2024-01-11T10:15:00Z"
  }
}
```

### Create Alert

```bash
curl -X POST http://localhost:8000/api/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "message": "User expressed self-harm ideation",
    "severity": "critical",
    "timestamp": "2024-01-11T10:00:00Z",
    "resolved": false
  }'

# Response
{
  "success": true,
  "alert": {
    "_id": "507f1f77bcf86cd799439011",
    "userId": "user-123",
    "message": "User expressed self-harm ideation",
    "severity": "critical",
    "timestamp": "2024-01-11T10:00:00Z",
    "resolved": false
  },
  "message": "Alert created successfully"
}
```

## TypeScript Type Definitions

```typescript
// API Response Wrapper
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Conversation
interface ConversationItem {
  childText: string;
  assistantText: string;
  emotionLabel?: string;
  moodEmoji?: string;
  timestamp?: string;
  flagged: boolean;
}

interface ConversationDay {
  date: string;
  items: ConversationItem[];
}

// Dashboard
interface MoodDataPoint {
  emotion: string;
  emoji: string;
  count: number;
  timestamp: string;
}

interface Alert {
  id?: string;
  userId: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
  resolved: boolean;
}

interface DashboardSummary {
  userId: string;
  totalConversations: number;
  moodDistribution: MoodDataPoint[];
  recentAlerts: Alert[];
  lastUpdated: string;
}

// Preferences
interface AIPreferences {
  userId: string;
  theme: 'light' | 'dark';
  notifications: boolean;
  language: string;
  aiModel: string;
}

// Authentication
interface LoginRequest {
  username: string;
  password: string;
}

interface LoginResponse {
  success: boolean;
  token?: string;
  userId?: string;
  message: string;
}
```

## Testing the API with Postman

### Setup

1. Open Postman
2. Create new collection "TedTalks API"
3. Set base URL: `http://localhost:8000/api`
4. Add environment variable: `token` = ""

### Test Sequence

```
1. Login
   POST /auth/login
   Body: {"username": "test", "password": "test"}
   
   → Save token from response to environment

2. Save Conversation
   POST /conversations/save
   Headers: Authorization: Bearer {{token}}
   Body: {
     "userId": "user-123",
     "items": [...]
   }
   
   → Save conversationId

3. Get Conversations
   GET /conversations/user-123
   Headers: Authorization: Bearer {{token}}

4. Get Dashboard
   GET /dashboard/user-123
   Headers: Authorization: Bearer {{token}}

5. Get Alerts
   GET /alerts/user-123
   Headers: Authorization: Bearer {{token}}
```

---

For more examples, see the source code comments in:
- [backend/main.py](backend/main.py)
- [frontend/src/services/fastapi.service.ts](frontend/src/services/fastapi.service.ts)
