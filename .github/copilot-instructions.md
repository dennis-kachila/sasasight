# SasaSight Copilot Instructions

## Project Overview

**SasaSight** is a monorepo for a mobile-first motherboard repair assistant. It detects, maps, and annotates circuit board components through three modes:
- **Find Mode**: Real-time OCR + component targeting
- **Scan Mode**: Panoramic board digitization via frame stitching  
- **Study Mode**: Annotation canvas with drawing/labeling tools

### Three-Tier Architecture
- **Frontend** (`apps/web/`): Next.js 14 (App Router) + React 18 + TailwindCSS
- **Backend** (`services/api/`): FastAPI + Pydantic models
- **Shared** (`shared/`): TypeScript types + geometry utilities

---

## Critical Data Flow

1. **Frontend captures frames** via `useCamera` hook → canvas/ImageData
2. **Vision processing** splits between tiers:
   - Client-side: Tesseract.js (OCR), TensorFlow.js (optional inference)
   - Server-side: OpenCV Python (advanced detection, stitching)
3. **API communication**: GET/POST `/api/{boards,uploads,inference,annotations}`
4. **State management**: Zustand stores (inspect via React DevTools)

### Key Data Types
- `DetectionResult`: Label + BBox + confidence (shared/types/vision.ts)
- `BoardRecord`: Persisted board metadata with side (front/back)
- `AnnotationDocument`: Canvas layer structure with drawn objects

---

## Frontend Patterns

### Mode-Based Routing
Each mode is isolated under `apps/web/src/app/mode/{find,scan,study}/page.tsx`:
- Dedicated components in `src/components/{find,scan,study}/`
- Mode selectors return early if dependencies missing (e.g., camera unavailable)
- Query params used for navigation context (e.g., `?boardId=X`)

### Camera & Vision Hooks
- `useCamera`: Manages stream lifecycle, torch control, frame capture
- Call **cleanup on unmount** to prevent resource leaks
- Frame quality validated via `QualityMetrics` (blurScore, motionScore, exposureQuality)
- Tesseract OCR runs in worker thread (non-blocking)

### API Client Pattern
[src/lib/api/client.ts](src/lib/api/client.ts) is singleton-like:
```typescript
// Usage in components
const apiClient = new ApiClient()
const result = await apiClient.detectComponent(imageUrl)
```
- No auth layer yet (placeholder CORS)
- Multipart uploads use FormData for images
- All inference endpoints expect imageUrl strings

---

## Backend Patterns

### Router Organization
Each router file in `services/api/app/routers/` handles one domain:
- `boards.py`: CRUD + scan status (currently in-memory db)
- `uploads.py`: File persistence + metadata
- `inference.py`: Vision model placeholders (OpenCV stubs)
- `annotations.py`: Canvas layer persistence
- `health.py`: Liveness probe

### Validation via Pydantic
[app/db/models.py](services/api/app/db/models.py) defines all request/response shapes:
- Use `Optional[T]` for nullable fields
- Leverage `Field(default_factory=...)` for timestamps
- Avoid circular imports; import models at router level

### Error Handling Convention
```python
# Don't suppress errors
if not found:
    raise HTTPException(status_code=404, detail="Board not found")
```
- HTTPException auto-converts to JSON responses
- Status codes: 200 (OK), 201 (created), 400 (validation), 404 (not found), 500 (server error)

---

## Build & Deployment

### Development Startup (Windows/Mac/Linux)
```bash
# Terminal 1: Backend
cd services/api
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Frontend
cd apps/web
npm install
npm run dev  # Runs on http://localhost:3000

# Health check
curl http://localhost:8000/health
```

### Docker
```bash
docker-compose up  # Backend on 8000, frontend on 3000
```

### Environment Variables
- Frontend: `NEXT_PUBLIC_API_URL` (default: `http://localhost:8000`)
- Backend: `STORAGE_PATH` (default: `./storage/`), `DATABASE_URL` (placeholder)

---

## Common Workflows

### Adding a New Detection Feature
1. Add Pydantic model to [app/db/models.py](services/api/app/db/models.py)
2. Create endpoint in `services/api/app/routers/inference.py`
3. Add client method to [src/lib/api/client.ts](apps/web/src/lib/api/client.ts)
4. Call from component via `apiClient.newFeature(imageUrl)`

### Fixing Camera Issues
- Verify browser camera permissions (Settings → Privacy)
- HTTPS required in production (localhost is exempt)
- Test alternate browsers if stuck
- Inspect `useCamera` hook for stream cleanup

### Debugging Vision Output
- Frontend: Use Tesseract event listeners (`progress`, `error`)
- Backend: Enable `logging.DEBUG` in `app/main.py`
- Check frame quality metrics before sending to backend (high blurScore = sharp)

### Stitching (MVP Placeholder)
[src/lib/mapping/stitcher.ts](apps/web/src/lib/mapping/stitcher.ts) has stub keypoint detection.
Real implementation needs:
- Feature extraction (SIFT/AKAZE via OpenCV.js or WASM)
- Homography + RANSAC (or use `cv.findHomography` if available)
- Blend seams using alpha blending or Poisson blending

---

## Type Safety Tips

### Shared Types
Import vision types from `shared/types/vision.ts`:
```typescript
import type { DetectionResult, OcrResult } from '../../../shared/types/vision'
```

### TypeScript Config
- Frontend: [tsconfig.json](apps/web/tsconfig.json) has `paths` aliases (check imports)
- Run `npm run type-check` to catch before build

### Backend Models
Pydantic auto-validates request bodies:
```python
# Frontend sends JSON, FastAPI deserializes to BoardCreate automatically
@router.post("/boards")
async def create_board(board: BoardCreate):
    # `board` is already a validated instance, not dict
```

---

## Storage & Persistence

### File Organization
- Backend stores uploads in `services/api/storage/` (not versioned)
- Image URLs in database point to `/api/uploads/{id}`
- Thumbnail generation via Pillow (size down to 320px width)

### Database Placeholder
Current: In-memory dicts (`boards_db`, `scans_db`, `annotations_db`)
Migration path: Replace with SQLAlchemy ORM + PostgreSQL (connection string via `.env`)

---

## Testing & Quality Checks

### Frontend Quality
```bash
npm run lint      # ESLint
npm run type-check  # TypeScript
npm run build     # Catch dead code
```

### Backend Quality
```bash
pip install pytest pytest-asyncio  # Add to requirements.txt if needed
pytest app/      # Run tests (create tests/ folder)
```

### Frame Quality Validation
Don't process frames below thresholds:
- `blurScore >= 0.5` (Laplacian variance)
- `motionScore >= 0.7` (optical flow)
- `exposureQuality >= 0.4` (brightness histogram)

---

## Gotchas & Anti-Patterns

❌ **Don't**:
- Hardcode API URLs (use `NEXT_PUBLIC_API_URL` env var)
- Store sensitive data in Zustand (it's dev-friendly but not secure)
- Block on frame processing in camera loop (use workers/async)
- Mix inference endpoints without validating image URLs exist
- Import components from one mode into another (they're isolated)

✅ **Do**:
- Validate all API inputs via Pydantic before touching them
- Use `QualityMetrics` before sending frames to backend
- Clean up streams/listeners in React `useEffect` cleanup
- Check HTTP status codes and throw on non-2xx (axios doesn't auto-fail)
- Keep annotation layers under 1000 objects (canvas performance)

---

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| [apps/web/src/lib/api/client.ts](apps/web/src/lib/api/client.ts) | API client singleton |
| [apps/web/src/lib/camera/useCamera.ts](apps/web/src/lib/camera/useCamera.ts) | Camera management hook |
| [services/api/app/main.py](services/api/app/main.py) | FastAPI factory + router setup |
| [services/api/app/db/models.py](services/api/app/db/models.py) | Pydantic validation schemas |
| [shared/types/vision.ts](shared/types/vision.ts) | Shared type definitions |
| [apps/web/src/lib/mapping/stitcher.ts](apps/web/src/lib/mapping/stitcher.ts) | Frame composition (stub) |

---

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [FastAPI Docs](https://fastapi.tiangolo.com/)
- [OpenCV.js](https://docs.opencv.org/4.8.0/d0/d84/tutorial_js_root.html) (browser)
- [Tesseract.js](https://github.com/naptha/tesseract.js) (OCR)
- [Pydantic Docs](https://docs.pydantic.dev/)
