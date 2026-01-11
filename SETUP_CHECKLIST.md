# MongoDB + FastAPI Setup Checklist

## ✅ Files Created

### Backend
- [x] `backend/main.py` - FastAPI application
- [x] `backend/models.py` - Pydantic data models
- [x] `backend/README.md` - Setup documentation
- [x] `backend/.env.example` - Environment template
- [x] `backend/setup.bat` - Windows setup script
- [x] `backend/Dockerfile` - Docker configuration
- [x] `backend/requirements.txt` - Updated dependencies

### Frontend
- [x] `frontend/src/services/fastapi.service.ts` - FastAPI client service
- [x] `frontend/.env.example` - Frontend environment template

### Docker & Deployment
- [x] `docker-compose.yml` - Local development with MongoDB
- [x] `Dockerfile.prod` - Production multi-stage build

### Documentation
- [x] `INTEGRATION_SUMMARY.md` - Quick reference guide
- [x] This checklist

## 📋 Setup Steps

### Step 1: Backend Setup (Windows)

```bash
cd backend
setup.bat
```

This will:
- ✅ Create virtual environment
- ✅ Install all dependencies
- ✅ Create .env file from template

### Step 2: Configure Environment

Edit `backend/.env`:

```env
# Option A: MongoDB Atlas (Cloud)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=teddy-cluster

# Option B: Local MongoDB
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=teddy-cluster

FRONTEND_URL=http://localhost:5173
```

### Step 3: Get MongoDB Connection

**Option A: MongoDB Atlas (Recommended)**
1. Go to https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create a cluster
4. Create a database user
5. Get connection string
6. Paste into `.env`

**Option B: Local MongoDB**
```bash
# Using Docker
docker run -d -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password mongo:7.0

# Then use:
# MONGODB_URI=mongodb://admin:password@localhost:27017
```

### Step 4: Start Backend

```bash
cd backend
python main.py
```

Expected output:
```
✅ MongoDB connected successfully
INFO:     Started server process [1234]
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### Step 5: Configure Frontend

Create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:8000/api
```

### Step 6: Start Frontend

```bash
cd frontend
npm run dev
```

### Step 7: Test Connection

1. Open http://localhost:5173
2. Go to login page
3. Check backend terminal for requests
4. View API docs at http://localhost:8000/docs

## 🔍 Verification

### Backend Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "mongodb": "connected",
  "timestamp": "2024-01-11T..."
}
```

### API Documentation

Visit http://localhost:8000/docs to see:
- All available endpoints
- Request/response schemas
- Try-it-out testing interface

### Frontend Network Tab

In browser DevTools → Network:
- Watch for API calls to `http://localhost:8000/api/...`
- Check for successful (200) responses
- Look for any CORS errors

## 🐳 Docker Setup (Alternative)

### Option 1: Using docker-compose (Includes MongoDB)

```bash
# From project root
docker-compose up

# Backend: http://localhost:8000
# Frontend: http://localhost:5173
# MongoDB: localhost:27017
```

### Option 2: Build Production Image

```bash
docker build -f Dockerfile.prod -t tedtalks:latest .
docker run -p 8000:8000 \
  -e MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/ \
  -e MONGODB_DB=teddy-cluster \
  tedtalks:latest
```

## 🚀 Common Tasks

### View Backend Logs

```bash
# If running locally
python main.py

# If running in Docker
docker logs tedtalks-backend

# If running in docker-compose
docker-compose logs backend
```

### View Database in MongoDB

**Option A: MongoDB Compass (GUI)**
1. Download from https://www.mongodb.com/products/tools/compass
2. Connect with your MONGODB_URI
3. Browse collections

**Option B: MongoDB Shell**
```bash
mongosh "your-mongodb-uri"
```

### Reset Database

```bash
# Drop all collections
mongosh "your-mongodb-uri"
use teddy-cluster
db.dropDatabase()
```

### Stop Services

```bash
# Stop local backend
# Press Ctrl+C in terminal

# Stop docker services
docker-compose down

# Remove data volumes (careful!)
docker-compose down -v
```

## 🆘 Troubleshooting

### ❌ "MongoDB connection failed"

**Check:**
1. MongoDB URI format is correct
2. Username/password are correct
3. IP is whitelisted (MongoDB Atlas)
4. Network connection is working
5. `.env` file exists and is readable

**Fix:**
```bash
# Test connection
python
>>> from pymongo import MongoClient
>>> client = MongoClient("mongodb+srv://...")
>>> client.admin.command('ping')
```

### ❌ "CORS error" in browser

**Check:**
1. FRONTEND_URL in backend `.env`
2. Frontend .env.local has correct VITE_API_URL
3. Both services are running

**Fix:**
```env
# backend/.env - make sure this matches your frontend URL
FRONTEND_URL=http://localhost:5173
```

### ❌ "Cannot GET /api/..."

**Check:**
1. Backend is running
2. Endpoint path is correct
3. Frontend API_URL is correct

**Fix:**
```bash
# Verify backend is running
curl http://localhost:8000/health

# Check API docs
curl http://localhost:8000/docs
```

### ❌ "Port already in use"

**Fix:**
```bash
# Backend port 8000
netstat -ano | findstr :8000
# Then kill the process or use different port

# Frontend port 5173
lsof -i :5173
# Or use: npm run dev -- --port 3000
```

## 📚 API Usage Examples

### Login

```typescript
import fastAPIService from "@/services/fastapi.service";

const response = await fastAPIService.login({
  username: "testuser",
  password: "password123"
});

if (response.success) {
  console.log("User ID:", response.data.userId);
  console.log("Token:", response.data.token);
}
```

### Save Conversation

```typescript
await fastAPIService.saveConversation([
  {
    childText: "I'm feeling sad",
    assistantText: "That's okay, want to talk about it?",
    emotionLabel: "sad",
    moodEmoji: "😢",
    timestamp: new Date().toISOString(),
    flagged: false
  }
]);
```

### Get Dashboard

```typescript
const dashboard = await fastAPIService.getDashboardSummary();
console.log(dashboard.data.totalConversations);
console.log(dashboard.data.moodDistribution);
```

## ✨ Next Steps

1. [ ] Set up MongoDB (Atlas or local)
2. [ ] Configure backend `.env`
3. [ ] Start backend server
4. [ ] Configure frontend `.env.local`
5. [ ] Start frontend dev server
6. [ ] Test login flow
7. [ ] Save test conversation
8. [ ] Verify data in MongoDB
9. [ ] Deploy to production (see backend/README.md)

## 📞 Support Resources

- FastAPI: https://fastapi.tiangolo.com
- MongoDB Python: https://pymongo.readthedocs.io
- MongoDB Atlas: https://docs.atlas.mongodb.com
- CORS: https://fastapi.tiangolo.com/tutorial/cors/
- Docker: https://docs.docker.com
- Uvicorn: https://www.uvicorn.org

## ✅ Final Checklist Before Deployment

- [ ] Database backups configured
- [ ] Environment variables set for production
- [ ] SSL/HTTPS configured
- [ ] CORS origins restricted to your domain
- [ ] Password hashing implemented
- [ ] Rate limiting added
- [ ] Logging configured
- [ ] Error handling tested
- [ ] All API endpoints tested
- [ ] Frontend and backend both running smoothly
