# TedTalks Architecture & Integration Guide

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend Layer                          │
│                   (React + TypeScript + Vite)                   │
├─────────────────────────────────────────────────────────────────┤
│  Components:                                                     │
│  • LoginScreen → Authentication                                 │
│  • DashboardScreen → Analytics & Mood Visualization            │
│  • ConversationTimelineScreen → Chat History                   │
│  • ParentAdvisorScreen → Insights & Alerts                    │
│  • SettingsScreen → User Preferences                           │
│                                                                 │
│  Services:                                                       │
│  • fastapi.service.ts → API Client (NEW)                       │
└──────────────────────────────────────────┬──────────────────────┘
                                           │
                        HTTP/REST API Calls│ (http://localhost:8000/api)
                        (with CORS support)│
                                           │
┌──────────────────────────────────────────▼──────────────────────┐
│                       Backend Layer                              │
│                    (FastAPI + Python 3.11)                     │
├─────────────────────────────────────────────────────────────────┤
│  main.py:                                                        │
│  • FastAPI Application                                           │
│  • CORS Middleware                                               │
│  • Error Handling                                                │
│  • Health Checks                                                 │
│                                                                 │
│  Routes:                                                         │
│  ├─ /api/auth/* - Authentication                               │
│  ├─ /api/conversations/* - Chat Management                     │
│  ├─ /api/dashboard/* - Analytics                               │
│  ├─ /api/alerts/* - Alerts & Flags                             │
│  ├─ /api/preferences/* - User Settings                         │
│  └─ /health - Health Checks                                    │
│                                                                 │
│  models.py:                                                      │
│  • Pydantic Models for Validation                               │
│  • Database Document Schemas                                    │
└──────────────────────────────────────────┬──────────────────────┘
                                           │
                        MongoDB Queries    │
                        (pymongo)          │
                                           │
┌──────────────────────────────────────────▼──────────────────────┐
│                      Data Layer                                  │
│                    (MongoDB Collections)                        │
├─────────────────────────────────────────────────────────────────┤
│  profiles              • User accounts & info                   │
│  preferences           • User settings                          │
│  conversations         • Chat history & transcripts            │
│  alerts                • Behavioral flags & alerts              │
│  mood_events           • Emotion tracking                       │
│  usage_events          • User activity log                      │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

### Authentication Flow

```
Frontend (Login)
    │
    ├─ POST /api/auth/login
    │  {username, password}
    │
    └─→ FastAPI Backend
        ├─ Validate credentials
        ├─ Query profiles collection
        ├─ Generate token
        └─→ Return {token, userId, success}
            │
            └─→ Frontend stores token & userId
                in localStorage
                (Sent with subsequent requests)
```

### Conversation Save Flow

```
Frontend (Chat Screen)
    │
    ├─ Save conversation items
    │  {childText, assistantText, emotion, ...}
    │
    ├─ POST /api/conversations/save
    │  {userId, conversationId, items}
    │
    └─→ FastAPI Backend
        ├─ Validate request
        ├─ Create conversation document
        └─→ MongoDB conversations collection
            {
              userId: "user-123",
              conversationId: "conv-456",
              items: [...],
              timestamp: ISO,
              updatedAt: ISO
            }
            │
            └─→ Return {success, conversationId}
                │
                └─→ Frontend confirms save
```

### Dashboard Data Aggregation

```
Frontend (Dashboard Screen)
    │
    ├─ GET /api/dashboard/{userId}
    │
    └─→ FastAPI Backend
        ├─ Count conversations
        │  db.conversations.count_documents({userId})
        │
        ├─ Aggregate mood distribution
        │  db.conversations.aggregate([
        │    {$match: {userId}},
        │    {$unwind: "$items"},
        │    {$group: {_id: "$emotion", count: ...}}
        │  ])
        │
        ├─ Get recent alerts
        │  db.alerts.find({userId, resolved: false})
        │
        └─→ Return DashboardSummary
            {
              totalConversations: 42,
              moodDistribution: [...],
              recentAlerts: [...],
              lastUpdated: ISO
            }
            │
            └─→ Frontend renders charts & stats
```

## API Endpoint Reference

### Authentication Endpoints

```
POST /api/auth/login
├─ Request:  { username: string, password: string }
├─ Response: { success: boolean, token: string, userId: string }
└─ Storage: localStorage[authToken, userId]

POST /api/auth/logout
├─ Request:  (empty body)
├─ Response: { success: boolean }
└─ Effect:   Clears frontend tokens
```

### Conversation Endpoints

```
POST /api/conversations/save
├─ Request:  {
│   userId: string,
│   conversationId?: string,
│   items: [{childText, assistantText, emotion?, emoji?, ...}]
│ }
├─ Response: { success: boolean, conversationId: string }
└─ Effect:   Creates or updates conversation in MongoDB

GET /api/conversations/{userId}
├─ Request:  (no body)
├─ Response: { 
│   success: boolean, 
│   conversations: [...], 
│   count: number 
│ }
└─ Effect:   Returns all conversations for user

GET /api/conversations/{userId}/{conversationId}
├─ Request:  (no body)
├─ Response: { success: boolean, conversation: {...} }
└─ Effect:   Returns specific conversation details
```

### Dashboard Endpoints

```
GET /api/dashboard/{userId}
├─ Request:  (no body)
├─ Response: {
│   success: boolean,
│   dashboard: {
│     userId: string,
│     totalConversations: number,
│     moodDistribution: [{emotion, emoji, count, timestamp}],
│     recentAlerts: [...],
│     lastUpdated: ISO string
│   }
│ }
└─ Effect:   Aggregates all analytics data
```

### Alert Endpoints

```
GET /api/alerts/{userId}
├─ Request:  (no body)
├─ Response: { success: boolean, alerts: [...], count: number }
└─ Effect:   Returns all alerts for user

POST /api/alerts
├─ Request:  {
│   userId: string,
│   message: string,
│   severity: "low" | "medium" | "high" | "critical",
│   timestamp: ISO string,
│   resolved?: boolean
│ }
├─ Response: { success: boolean, alert: {...} }
└─ Effect:   Creates new alert in MongoDB
```

### Preferences Endpoints

```
GET /api/preferences/{userId}
├─ Request:  (no body)
├─ Response: { success: boolean, preferences: {...} }
└─ Effect:   Returns user preferences or defaults

POST /api/preferences/{userId}
├─ Request:  { theme, notifications, language, ... }
├─ Response: { success: boolean, message: string }
└─ Effect:   Updates user preferences in MongoDB
```

## Database Schema Examples

### profiles collection

```javascript
db.profiles.insertOne({
  _id: ObjectId("..."),
  username: "john_doe",
  email: "john@example.com",
  displayName: "John Doe",
  password: "hashed_password_here",  // Use bcrypt in production
  avatar: "https://...",
  createdAt: "2024-01-11T10:00:00Z",
  updatedAt: "2024-01-11T10:00:00Z"
})
```

### conversations collection

```javascript
db.conversations.insertOne({
  _id: ObjectId("..."),
  userId: "user-123",
  conversationId: "conv-abc123",
  items: [
    {
      childText: "I had a bad day at school",
      assistantText: "I'm sorry to hear that. What happened?",
      emotionLabel: "sad",
      moodEmoji: "😢",
      timestamp: "2024-01-11T09:30:00Z",
      flagged: false,
      severity: null
    },
    {
      childText: "Everyone was mean to me",
      assistantText: "That sounds tough. Your feelings are valid.",
      emotionLabel: "frustrated",
      moodEmoji: "😣",
      timestamp: "2024-01-11T09:31:00Z",
      flagged: true,
      severity: "medium"
    }
  ],
  topic: "social",
  summary: "User experienced social conflict at school",
  timestamp: "2024-01-11T09:30:00Z",
  updatedAt: "2024-01-11T09:31:00Z"
})
```

### alerts collection

```javascript
db.alerts.insertOne({
  _id: ObjectId("..."),
  userId: "user-123",
  message: "Multiple concerning keywords detected in recent conversations",
  severity: "medium",
  timestamp: "2024-01-11T10:00:00Z",
  resolved: false,
  resolutionNotes: null,
  conversationId: "conv-abc123"
})
```

### mood_events collection

```javascript
db.mood_events.insertOne({
  _id: ObjectId("..."),
  userId: "user-123",
  emotion: "sad",
  emoji: "😢",
  timestamp: "2024-01-11T09:30:00Z",
  confidence: 0.95,
  source: "conversation"
})
```

## Request/Response Examples

### Example: Login

**Request:**
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

**Response:**
```json
{
  "success": true,
  "token": "token-507f1f77bcf86cd799439011",
  "userId": "507f1f77bcf86cd799439011",
  "message": "Login successful"
}
```

### Example: Save Conversation

**Request:**
```bash
curl -X POST http://localhost:8000/api/conversations/save \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer token-507f1f77bcf86cd799439011" \
  -d '{
    "userId": "user-123",
    "items": [
      {
        "childText": "I am worried",
        "assistantText": "What are you worried about?",
        "emotionLabel": "anxious",
        "moodEmoji": "😟",
        "timestamp": "2024-01-11T10:00:00Z",
        "flagged": false
      }
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "conversationId": "conv-507f1f77bcf86cd799439011",
  "message": "Conversation saved successfully"
}
```

### Example: Get Dashboard

**Request:**
```bash
curl -X GET http://localhost:8000/api/dashboard/user-123 \
  -H "Authorization: Bearer token-507f1f77bcf86cd799439011"
```

**Response:**
```json
{
  "success": true,
  "dashboard": {
    "userId": "user-123",
    "totalConversations": 42,
    "moodDistribution": [
      {
        "emotion": "happy",
        "emoji": "😊",
        "count": 18,
        "timestamp": "2024-01-11T10:00:00Z"
      },
      {
        "emotion": "anxious",
        "emoji": "😟",
        "count": 12,
        "timestamp": "2024-01-11T10:00:00Z"
      }
    ],
    "recentAlerts": [
      {
        "userId": "user-123",
        "message": "Multiple concerning keywords detected",
        "severity": "medium",
        "timestamp": "2024-01-11T10:00:00Z",
        "resolved": false
      }
    ],
    "lastUpdated": "2024-01-11T10:15:00Z"
  }
}
```

## Error Handling

### Error Response Format

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Login successful |
| 201 | Created | Conversation saved |
| 400 | Bad Request | Invalid input format |
| 401 | Unauthorized | Invalid credentials |
| 403 | Forbidden | Access denied |
| 404 | Not Found | Conversation doesn't exist |
| 500 | Server Error | Database connection failed |

## Environment Variables

### Backend (.env)

```env
# MongoDB
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=teddy-cluster

# API
FRONTEND_URL=http://localhost:5173
API_PORT=8000

# Analytics (Optional)
GEMINI_API_KEY=sk-...
GEMINI_MODEL=gemini-1.5-flash

# Workers
BATCH_LIMIT=200
SLEEP_ON_IDLE_SEC=0.2
```

### Frontend (.env.local)

```env
VITE_API_URL=http://localhost:8000/api
VITE_MONGO_DB_NAME=teddy-cluster
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_MOOD_TRACKING=true
```

## Deployment Considerations

### Development
- Local MongoDB or Docker
- Unencrypted connections
- Relaxed CORS (all origins)
- Detailed logging

### Production
- MongoDB Atlas (managed)
- SSL/TLS encryption
- Specific CORS origins
- Environment-based config
- Rate limiting
- Password hashing (bcrypt)
- Input validation
- Error logging
- Monitoring & alerts

## Performance Optimization

### Indexing

```javascript
// Create indexes for common queries
db.conversations.createIndex({ userId: 1, timestamp: -1 })
db.alerts.createIndex({ userId: 1, resolved: 1 })
db.mood_events.createIndex({ userId: 1, timestamp: -1 })
db.profiles.createIndex({ username: 1 }, { unique: true })
```

### Caching Strategy

```typescript
// Frontend: Cache dashboard for 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;
let cachedDashboard = null;
let lastFetch = 0;

async function getDashboard() {
  if (Date.now() - lastFetch < CACHE_DURATION_MS) {
    return cachedDashboard;
  }
  
  cachedDashboard = await fastAPIService.getDashboardSummary();
  lastFetch = Date.now();
  return cachedDashboard;
}
```

## Security Best Practices

1. **Password Hashing** - Use bcrypt (not plain text)
2. **CORS** - Restrict to specific origins
3. **Authentication** - Use JWT tokens
4. **Validation** - Validate all inputs
5. **Rate Limiting** - Prevent abuse
6. **HTTPS** - Use SSL/TLS in production
7. **Secrets Management** - Use environment variables
8. **Audit Logging** - Log sensitive operations

## Monitoring & Logging

### Health Checks

```bash
# Check backend health
curl http://localhost:8000/health

# Expected response:
{
  "status": "healthy",
  "mongodb": "connected",
  "timestamp": "2024-01-11T10:00:00Z"
}
```

### Log Monitoring

```bash
# View backend logs in real-time
docker logs -f tedtalks-backend

# View MongoDB logs
docker logs -f tedtalks-mongodb
```

## Scaling Strategy

For high-traffic applications:

1. **Horizontal Scaling** - Multiple FastAPI instances
2. **Load Balancing** - Use nginx or AWS ELB
3. **Database Replication** - MongoDB replica sets
4. **Caching Layer** - Redis for frequently accessed data
5. **Async Tasks** - Celery for heavy processing
6. **CDN** - Cloudflare for static content

## References

- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [MongoDB Python Docs](https://pymongo.readthedocs.io)
- [REST API Best Practices](https://www.rfc-editor.org/rfc/rfc7231)
- [API Security](https://owasp.org/www-project-api-security)
