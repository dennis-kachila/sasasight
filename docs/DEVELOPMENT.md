# SasaSight Implementation Guide

## Architecture Overview

SasaSight is a **monorepo** with three main components:

1. **Frontend (Next.js)**: `/apps/web` - React-based UI for three modes
2. **Backend (FastAPI)**: `/services/api` - REST API for data/inference
3. **Shared Types**: `/shared` - Common type definitions and utilities

### Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React 18
- TypeScript
- TailwindCSS
- Zustand (state management)

**Backend:**
- FastAPI (Python)
- Pydantic (validation)
- SQLAlchemy (ORM - placeholder)
- OpenCV (vision processing)

**Vision/ML:**
- OpenCV.js (browser-side)
- TensorFlow.js (optional client-side inference)
- Python OpenCV (server-side processing)

---

## Project Structure Breakdown

```
sasasight/
├── apps/web/                      # Frontend
│   ├── src/
│   │   ├── app/                   # Next.js app router
│   │   │   ├── page.tsx           # Home (mode selector)
│   │   │   ├── layout.tsx         # Root layout
│   │   │   ├── globals.css        # Global styles
│   │   │   └── mode/
│   │   │       ├── find/          # Find Mode route
│   │   │       ├── scan/          # Scan Mode route
│   │   │       └── study/         # Study Mode route
│   │   ├── components/            # Reusable components
│   │   │   ├── camera/            # Camera access & control
│   │   │   ├── find/              # Find mode specific
│   │   │   ├── scan/              # Scan mode specific
│   │   │   ├── study/             # Study mode specific
│   │   │   └── common/            # Shared components
│   │   └── lib/                   # Utilities & hooks
│   │       ├── camera/            # Camera hooks
│   │       ├── vision/            # Vision processing
│   │       ├── mapping/           # Stitching logic
│   │       └── api/               # API client
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.ts
│   └── Dockerfile
│
├── services/api/                  # Backend
│   ├── app/
│   │   ├── main.py                # FastAPI app
│   │   ├── routers/               # Route handlers
│   │   │   ├── boards.py          # Board CRUD
│   │   │   ├── uploads.py         # File uploads
│   │   │   ├── inference.py       # ML inference
│   │   │   └── annotations.py     # Annotation CRUD
│   │   └── db/
│   │       └── models.py          # Pydantic models
│   ├── requirements.txt
│   ├── Dockerfile
│   └── storage/                   # Local file storage
│
├── shared/
│   ├── types/                     # TypeScript type definitions
│   │   ├── vision.ts
│   │   ├── boards.ts
│   │   └── annotations.ts
│   └── utils/
│       └── geometry.ts            # Math utilities
│
├── docker-compose.yml
└── README.md
```

---

## Quick Start Guide

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker (optional)

### Setup Frontend

```bash
cd apps/web
npm install
npm run dev
```
Open http://localhost:3000

### Setup Backend

```bash
cd services/api
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```
Available at http://localhost:8000

### Docker Compose (All Services)

```bash
docker-compose up
```

---

## Implementation Checklist (MVP v1)

### Phase 1: Core Infrastructure ✅ ~50% Complete

- [x] Project structure & config
- [x] Next.js setup with routes
- [x] FastAPI skeleton with routers
- [x] Type definitions (vision, boards, annotations)
- [x] Basic components (CameraView, Find/Scan/Study pages)
- [ ] Real database (PostgreSQL + SQLAlchemy)
- [ ] Authentication (basic or JWT)
- [ ] Error handling & validation

### Phase 2: Find Mode Implementation

**Frontend:**
- [ ] Real OCR integration (Tesseract.js)
- [ ] Component detection (TensorFlow.js or server inference)
- [ ] Highlight/overlay rendering
- [ ] Stabilized target tracking
- [ ] Torch toggle (mobile flashlight)
- [ ] Confidence display & update

**Backend:**
- [ ] Component detection endpoint (integrate YOLOv8 or similar)
- [ ] OCR endpoint (integrate Tesseract or EasyOCR)
- [ ] Reference designator labeling
- [ ] Real-time inference optimization

**Testing:**
- [ ] Test with various components
- [ ] Verify label accuracy
- [ ] Optimize inference speed

### Phase 3: Scan Mode Implementation

**Frontend:**
- [ ] Frame capture with quality scoring
- [ ] Real-time stitching preview
- [ ] Coverage heatmap (show scanned regions)
- [ ] Board ID detection & confirmation
- [ ] Progress tracking (frames, quality, coverage)
- [ ] Scan history/session management

**Backend:**
- [ ] Image stitch endpoint (OpenCV stitching)
- [ ] Board ID OCR (specialized patterns)
- [ ] Quality metrics aggregation
- [ ] Storage of stitched images
- [ ] Thumbnail generation

**Vision Pipeline:**
- [ ] Keypoint detection (ORB/SIFT)
- [ ] Feature matching between frames
- [ ] Homography estimation
- [ ] Blending & exposure correction
- [ ] Board edge detection

### Phase 4: Study Mode Implementation

**Frontend:**
- [ ] Canvas drawing with multiple tools (pen, arrow, text, etc.)
- [ ] Layer management (OCR, components, annotations)
- [ ] Zoom & pan controls
- [ ] Minimap
- [ ] Tool palette & color picker
- [ ] Save/load annotations
- [ ] Front/back toggle
- [ ] Export to image/PDF

**Backend:**
- [ ] Annotation CRUD endpoints (fully functional)
- [ ] Annotation persistence
- [ ] Layer merge for export
- [ ] PDF generation

### Phase 5: Testing & Polish

- [ ] End-to-end tests
- [ ] Performance profiling
- [ ] UI/UX refinement
- [ ] Mobile responsiveness
- [ ] Error recovery
- [ ] Load testing

---

## Key Files to Implement

### High Priority

1. **Vision Processing Pipeline**
   - Location: `apps/web/src/lib/vision/detector.ts`
   - Implement component detection (TensorFlow.js or send to server)
   - Implement OCR label extraction
   - Implement reference designator matching

2. **Frame Stitcher**
   - Location: `apps/web/src/lib/mapping/stitcher.ts` ← STARTED
   - Implement keypoint matching (ORB/SIFT)
   - Implement homography calculation
   - Implement blending and composition

3. **Board Canvas**
   - Location: `apps/web/src/components/study/BoardCanvas.tsx`
   - Implement drawing tools
   - Implement layer system
   - Implement canvas serialization

4. **Database Models**
   - Location: `services/api/app/db/models.py` ← STARTED
   - Replace in-memory storage with SQLAlchemy ORM
   - Add migrations

5. **Real Data Storage**
   - Location: `services/api/app/storage/`
   - Implement S3 or local filesystem storage
   - Implement image uploads

### Component Hierarchy to Create

```
CameraView ← Used by all modes
├── Find Mode
│   ├── FindHUD (search, confidence, status)
│   ├── TargetOverlay (bounding box)
│   └── NearbyLabels (component list)
├── Scan Mode
│   ├── ScanControls (start/stop, progress)
│   ├── StitchPreview (live panorama)
│   ├── CoverageMap (scanned regions)
│   └── BoardIdPanel (detection + confirmation)
└── Study Mode
    ├── BoardCanvas (drawing area)
    ├── ToolPalette (tools & colors)
    ├── LayerPanel (visibility toggle)
    └── MiniMap (navigation)
```

---

## API Endpoint Checklist

### Boards (/api/boards)
- [x] GET `/boards` - List all boards
- [x] GET `/boards/{id}` - Get specific board
- [x] POST `/boards` - Create board
- [x] PUT `/boards/{id}` - Update board
- [x] DELETE `/boards/{id}` - Delete board
- [x] POST `/boards/{id}/scans` - Save scan
- [x] GET `/boards/{id}/scans` - Get scans

### Uploads (/api/uploads)
- [x] POST `/uploads/image` - Upload image
- [ ] POST `/uploads/batch` - Batch upload frames
- [ ] GET `/uploads/{id}` - Get upload info

### Inference (/api/inference)
- [x] POST `/inference/detect` - Component detection (placeholder)
- [x] POST `/inference/ocr` - Text extraction (placeholder)
- [x] POST `/inference/board-id` - Board ID recognition (placeholder)
- [x] POST `/inference/match-components` - Label matching (placeholder)
- [ ] Implement actual inference logic

### Annotations (/api/boards/{id}/annotations)
- [x] GET `/{side}` - Get annotations
- [x] POST `/{side}` - Create annotations
- [x] PUT `/{side}` - Update annotations
- [x] DELETE `/{side}` - Delete annotations

---

## State Management Strategy

### Frontend State (Zustand)

Create `apps/web/src/lib/store/index.ts`:

```typescript
import create from 'zustand'

interface AppState {
  // Current mode
  mode: 'find' | 'scan' | 'study'
  setMode: (mode: AppState['mode']) => void

  // Scan session
  currentScan: { boardId: string; side: 'front' | 'back' } | null
  setScan: (scan: AppState['currentScan']) => void

  // Canvas state
  selectedTool: string
  annotations: any[]
  addAnnotation: (anno: any) => void
}

const useAppStore = create<AppState>((set) => ({
  // ... implement
}))
```

---

## Testing Strategy

### Unit Tests
- Vision utilities (geometry, quality scoring)
- API client methods
- Store actions

### Integration Tests
- Camera to annotation flow
- Scan capture and upload
- Board retrieval and display

### E2E Tests
- Full Find Mode workflow (search → locate → highlight)
- Full Scan Mode workflow (capture → stitch → save)
- Full Study Mode workflow (open → annotate → export)

---

## Performance Optimization Notes

1. **Camera Feed**: Use 8-12 FPS for scanning, lower for battery
2. **Inference**: Debounce OCR to every 500ms to reduce server load
3. **Stitching**: Use pyramid approach for large images
4. **Canvas**: Use requestAnimationFrame for smooth drawing
5. **Storage**: Generate thumbnails server-side for list views

---

## Known Limitations (MVP)

- No authentication/multi-user
- In-memory database (no persistence between restarts)
- Placeholder inference endpoints (connect to real models)
- No advanced stitching blending
- No rail tracing AI assistance (v2)
- No offline mode

---

## Next Steps

1. **Set up database** → Replace in-memory storage with PostgreSQL + SQLAlchemy
2. **Integrate real vision models** → Actually implement detect/OCR
3. **Implement stitching** → Full feature matching and composition
4. **Implement canvas drawing** → Full annotation system
5. **Add authentication** → User accounts and sessions
6. **Deploy** → Docker containers + cloud hosting

---

## Resources

- **Next.js Docs**: https://nextjs.org/docs
- **FastAPI**: https://fastapi.tiangolo.com
- **TensorFlow.js**: https://www.tensorflow.org/js
- **OpenCV.js**: https://github.com/opencv/opencv.js
- **Tesseract.js**: https://github.com/naptha/tesseract.js

---

Generated: 2024-02-08
Version: 0.1.0 (MVP Planning)
