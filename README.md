# TedTalks - MongoDB + FastAPI Integration

A complete full-stack application for monitoring and supporting children's emotional well-being through AI-powered conversations.

## 🎯 Quick Start

### 1. Backend Setup (5 minutes)

```bash
cd backend
# Windows
setup.bat

# macOS/Linux
chmod +x setup.sh
./setup.sh
```

Then configure your MongoDB connection in `backend/.env`:

```env
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/
MONGODB_DB=teddy-cluster
FRONTEND_URL=http://localhost:5173
```

Start the backend:
```bash
python main.py
```

### 2. Frontend Setup

```bash
cd frontend
echo "VITE_API_URL=http://localhost:8000/api" > .env.local
npm install
npm run dev
```

### 3. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 📁 Project Structure

```
TedTalks/
├── backend/                          # FastAPI + MongoDB backend
│   ├── main.py                      # FastAPI application (NEW)
│   ├── models.py                    # Pydantic models (NEW)
│   ├── requirements.txt             # Python dependencies (UPDATED)
│   ├── analytics/
│   │   └── worker.py               # Analytics worker
│   ├── .env.example                # Configuration template (NEW)
│   ├── Dockerfile                  # Docker configuration (NEW)
│   ├── setup.bat                   # Windows setup (NEW)
│   ├── setup.sh                    # Unix setup (NEW)
│   └── README.md                   # Backend guide (NEW)
│
├── frontend/                         # React + TypeScript frontend
│   ├── src/
│   │   ├── services/
│   │   │   ├── api.service.ts      # Original API (optional)
│   │   │   └── fastapi.service.ts  # FastAPI client (NEW)
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── App.tsx
│   ├── .env.example                # Frontend config (NEW)
│   └── vite.config.ts
│
├── docker-compose.yml               # Local development stack (NEW)
├── Dockerfile.prod                  # Production image (NEW)
├── INTEGRATION_SUMMARY.md          # Quick reference (NEW)
├── SETUP_CHECKLIST.md              # Step-by-step guide (NEW)
├── ARCHITECTURE.md                 # System design & examples (NEW)
└── README.md                        # This file
```

## 🚀 Features

### Backend (FastAPI + MongoDB)

✅ **FastAPI Framework**
- Async/await support
- Automatic OpenAPI documentation
- Pydantic validation
- CORS middleware

✅ **MongoDB Integration**
- Connection pooling
- Pydantic schema validation
- CRUD operations
- Aggregation pipelines

✅ **API Endpoints**
- Authentication (login/logout)
- Conversation management
- Dashboard analytics
- Alert system
- User preferences

✅ **Production Ready**
- Error handling
- Health checks
- Logging
- Docker support
- Environment configuration

### Frontend (React + TypeScript)

✅ **FastAPI Service Client**
- Type-safe API calls
- Token management
- Error handling
- Request/response formatting

✅ **UI Components**
- Login screen
- Dashboard with charts
- Conversation timeline
- Settings panel
- Alert display

## 🔗 Architecture

```
Frontend (React)
     ↓
HTTP/REST API (FastAPI)
     ↓
MongoDB
```

### Data Collections

| Collection | Purpose |
|-----------|---------|
| `profiles` | User accounts |
| `preferences` | User settings |
| `conversations` | Chat history |
| `alerts` | System alerts |
| `mood_events` | Emotion tracking |
| `usage_events` | Activity logs |

## 📚 Documentation

- **[SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)** - Step-by-step setup guide
- **[INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md)** - Quick reference
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System design & examples
- **[backend/README.md](backend/README.md)** - Backend documentation
- **[backend/main.py](backend/main.py)** - Fully commented source code

## 🔐 Configuration

### Backend Environment (backend/.env)

```env
# MongoDB Connection
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/
MONGODB_DB=teddy-cluster

# API Configuration
FRONTEND_URL=http://localhost:5173
API_PORT=8000

# Optional: Analytics
GEMINI_API_KEY=your-api-key
GEMINI_MODEL=gemini-1.5-flash
```

### Frontend Environment (frontend/.env.local)

```env
VITE_API_URL=http://localhost:8000/api
VITE_MONGO_DB_NAME=teddy-cluster
```

## 🐳 Docker Deployment

### Local Development with Docker Compose

```bash
# Starts MongoDB, Backend, and Frontend
docker-compose up

# Access
# Frontend: http://localhost:5173
# Backend: http://localhost:8000
# MongoDB: localhost:27017
```

### Production Build

```bash
# Single container with both frontend and backend
docker build -f Dockerfile.prod -t tedtalks:latest .
docker run -p 8000:8000 \
  -e MONGODB_URI=mongodb+srv://... \
  -e MONGODB_DB=teddy-cluster \
  tedtalks:latest
```

## 🧪 Testing

### Health Check

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

Visit http://localhost:8000/docs to test endpoints interactively

### Example: Login

```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

## 🛠️ Development

### Install Dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd frontend
npm install
```

### Run Locally

**Terminal 1 - Backend:**
```bash
cd backend
python main.py
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

### Code Quality

```bash
# Format backend code
pip install black
black backend/

# Lint frontend
npm run lint

# Type check frontend
npm run type-check
```

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Conversations
- `POST /api/conversations/save` - Save conversation
- `GET /api/conversations/{userId}` - Get all conversations
- `GET /api/conversations/{userId}/{convId}` - Get specific conversation

### Dashboard
- `GET /api/dashboard/{userId}` - Get analytics summary

### Alerts
- `GET /api/alerts/{userId}` - Get alerts
- `POST /api/alerts` - Create alert

### Preferences
- `GET /api/preferences/{userId}` - Get preferences
- `POST /api/preferences/{userId}` - Update preferences

### Health
- `GET /health` - Health check
- `GET /` - Root endpoint

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed examples.

## 🆘 Troubleshooting

### Backend won't start

```bash
# Check MongoDB connection
python -c "from pymongo import MongoClient; MongoClient('your-uri').admin.command('ping')"

# Check port availability
netstat -ano | findstr :8000  # Windows
lsof -i :8000                  # macOS/Linux
```

### CORS errors in frontend

- Verify `FRONTEND_URL` in backend `.env`
- Check browser console for specific error
- Ensure both services are running

### Database connection fails

- Verify `MONGODB_URI` format
- Check MongoDB Atlas IP whitelist
- Confirm database user permissions

See [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) for more troubleshooting.

## 📦 Dependencies

### Backend
- FastAPI 0.128.0
- PyMongo 4.16.0
- Pydantic 2.12.5
- Uvicorn 0.31.0
- python-dotenv 1.2.1

### Frontend
- React 18+
- TypeScript 5+
- Vite 5+
- Tailwind CSS

## 🚀 Deployment

### Production Checklist

- [ ] Set production MongoDB URI
- [ ] Configure HTTPS/SSL
- [ ] Set restrictive CORS origins
- [ ] Enable rate limiting
- [ ] Hash passwords (bcrypt)
- [ ] Configure logging
- [ ] Set up monitoring
- [ ] Create database backups
- [ ] Test all endpoints
- [ ] Document API changes

### Deployment Options

1. **Heroku** - `pip install gunicorn`
2. **AWS** - Use Elastic Beanstalk or ECS
3. **Docker** - Push to Docker Hub or ECR
4. **DigitalOcean** - Deploy as App Platform
5. **Self-hosted** - Use Nginx + Gunicorn

## 📞 Support

### Resources
- [FastAPI Docs](https://fastapi.tiangolo.com)
- [MongoDB Docs](https://docs.mongodb.com)
- [React Docs](https://react.dev)
- [TypeScript Docs](https://www.typescriptlang.org)

### Documentation Files
- [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) - Setup steps
- [ARCHITECTURE.md](ARCHITECTURE.md) - System design
- [INTEGRATION_SUMMARY.md](INTEGRATION_SUMMARY.md) - Quick reference
- [backend/README.md](backend/README.md) - Backend guide

## 📝 License

[Add your license here]

## 👥 Contributors

[Add contributors here]

---

## 🎓 Learning Resources

### For Backend Development
- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)
- [MongoDB Python Tutorial](https://pymongo.readthedocs.io/en/stable/tutorial.html)
- [REST API Best Practices](https://restfulapi.net)

### For Frontend Development
- [React Hooks](https://react.dev/reference/react/hooks)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev)

### For DevOps
- [Docker Getting Started](https://docs.docker.com/get-started/)
- [Docker Compose](https://docs.docker.com/compose/)
- [MongoDB Atlas Guide](https://docs.atlas.mongodb.com)

---

**Last Updated:** January 2026
**Version:** 1.0.0
**Status:** Production Ready ✅
