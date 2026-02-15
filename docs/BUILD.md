# Build & Run Guide

## Quick Start (Development)

### Option 1: Manual Setup

#### Frontend
```bash
cd apps/web
npm install
npm run dev
# Open http://localhost:3000
```

#### Backend
```bash
cd services/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Option 2: Docker Compose
```bash
docker-compose up
```

---

## Production Build

### Frontend
```bash
cd apps/web
npm install
npm run build
npm start
```

### Backend
```bash
cd services/api
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Environment Setup

1. Copy `.env.example` to `.env.local` (frontend) and `.env` (backend)
2. Update values as needed:
   - `NEXT_PUBLIC_API_URL` - Backend URL
   - `DATABASE_URL` - Database connection string
   - `STORAGE_PATH` - Where to store uploaded images

---

## Verify Installation

### Frontend Health
```bash
curl http://localhost:3000
```

### Backend Health
```bash
curl http://localhost:8000/health
```

Both should return success responses.

---

## Troubleshooting

### Camera not working
- Check browser permissions (Settings → Privacy)
- Ensure HTTPS in production
- Test with a different browser

### API connection errors
- Verify backend is running on port 8000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`
- Check CORS settings in `app/main.py`

### Database errors
- Ensure write permissions to storage directories
- Check `STORAGE_PATH` exists
- For PostgreSQL: verify connection string

---

## Development Tools

### Code Quality
```bash
# Frontend
cd apps/web
npm run lint
npm run type-check

# Backend
cd services/api
black .
flake8 app/
mypy app/
```

### Testing
```bash
# Frontend
npm run test

# Backend
pytest
```

---

## Useful Commands

### Reset Everything
```bash
# Stop all services
docker-compose down -v

# Clean node_modules
rm -rf apps/web/node_modules apps/web/.next

# Clean Python cache
find services/api -type d -name __pycache__ -exec rm -r {} +
```

### View Logs
```bash
# Docker
docker-compose logs -f web
docker-compose logs -f api

# Local
# Frontend: Check browser console
# Backend: Check terminal output
```

---

## Next: Implementation Roadmap

See [DEVELOPMENT.md](DEVELOPMENT.md) for full implementation checklist.
