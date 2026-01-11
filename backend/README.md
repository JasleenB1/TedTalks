# TedTalks Backend Setup Guide

## Overview

This is a FastAPI backend that connects to MongoDB and provides API endpoints for the TedTalks frontend application.

## Quick Start

### 1. Prerequisites

- Python 3.8+
- MongoDB connection (local or MongoDB Atlas)
- pip package manager

### 2. Environment Setup

Create a `.env` file in the `backend/` directory:

```env
# MongoDB Configuration
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=teddy-cluster

# API Configuration
FRONTEND_URL=http://localhost:5173
API_PORT=8000

# Optional: Gemini API for analytics
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-flash
```

### 3. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 4. Run the Server

```bash
python main.py
```

The API will be available at `http://localhost:8000`

**API Documentation:** Visit `http://localhost:8000/docs` (Swagger UI)

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user

### Conversations
- `POST /api/conversations/save` - Save a conversation
- `GET /api/conversations/{user_id}` - Get all conversations for user
- `GET /api/conversations/{user_id}/{conversation_id}` - Get specific conversation

### Dashboard
- `GET /api/dashboard/{user_id}` - Get dashboard summary with mood stats

### Alerts
- `GET /api/alerts/{user_id}` - Get all alerts
- `POST /api/alerts` - Create new alert

### Preferences
- `GET /api/preferences/{user_id}` - Get user preferences
- `POST /api/preferences/{user_id}` - Update user preferences

### Health
- `GET /health` - Health check endpoint
- `GET /` - Root endpoint

## MongoDB Atlas Setup

1. Create a MongoDB Atlas account at https://www.mongodb.com/cloud/atlas
2. Create a new cluster
3. Create a database user with read/write permissions
4. Get your connection string
5. Replace `MONGODB_URI` in `.env`

### Database Collections

The API automatically manages these collections:

- **profiles** - User account information
- **preferences** - User settings and preferences
- **conversations** - Chat history and conversations
- **alerts** - System and behavioral alerts
- **mood_events** - Emotion/mood tracking data
- **usage_events** - User activity tracking

## Frontend Integration

Update your frontend `.env.local`:

```env
VITE_API_URL=http://localhost:8000/api
```

Then use the API service:

```typescript
import fastAPIService from "@/services/fastapi.service";

// Login
await fastAPIService.login({ username: "user", password: "pass" });

// Save conversation
await fastAPIService.saveConversation(conversationItems);

// Get dashboard
const dashboard = await fastAPIService.getDashboardSummary();

// Get alerts
const alerts = await fastAPIService.getAlerts();
```

## Development

### Run with Auto-Reload

```bash
python main.py
```

The server will automatically reload when you make changes.

### Run in Debug Mode

```bash
python main.py
# Then use an IDE debugger to attach to the process
```

### Format Code

```bash
pip install black
black backend/
```

### Lint Code

```bash
pip install pylint
pylint backend/main.py
```

## Production Deployment

### Using Gunicorn

```bash
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 main:app
```

### Using Docker

Create `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Build and run:

```bash
docker build -t tedtalks-api .
docker run -p 8000:8000 --env-file .env tedtalks-api
```

### Environment Variables for Production

```env
MONGODB_URI=mongodb+srv://prod-user:prod-pass@prod-cluster.mongodb.net/
MONGODB_DB=teddy-cluster-prod
FRONTEND_URL=https://yourdomain.com
API_PORT=8000
```

## Troubleshooting

### MongoDB Connection Fails

- Check your `MONGODB_URI` format
- Ensure IP whitelist is configured in MongoDB Atlas
- Verify database user permissions

### CORS Errors

- Update `FRONTEND_URL` in `.env` to match your frontend domain
- Check that frontend and backend are on the same network

### Import Errors

- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Check Python version: `python --version`

## Analytics Worker

The `analytics/worker.py` processes conversations and detects concerning patterns using the Gemini API.

See `backend/analytics/worker.py` for details.

## Support

For issues or questions, check:
1. Console output for error messages
2. MongoDB Atlas logs
3. FastAPI documentation: https://fastapi.tiangolo.com
