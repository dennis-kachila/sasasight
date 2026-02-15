# SasaSight - File Reference Guide

Quick reference for every file in the project.

## 📁 Root Directory

| File | Purpose |
|------|---------|
| `README.md` | Project overview, features, and quick start |
| `docker-compose.yml` | Multi-container setup for local development |
| `.gitignore` | Git ignore patterns |
| `.env.example` | Template for environment variables |
| `BUILD.md` | Build and run instructions |
| `DEVELOPMENT.md` | Detailed implementation guide and checklist |
| `PROJECT_SUMMARY.md` | This file - overview of all created files |

## 🎨 Frontend (apps/web/)

### Configuration
| File | Purpose |
|------|---------|
| `package.json` | Dependencies and npm scripts |
| `tsconfig.json` | TypeScript compiler configuration |
| `next.config.js` | Next.js configuration (WebAssembly support) |
| `tailwind.config.ts` | Tailwind CSS theme and plugins |
| `postcss.config.js` | PostCSS transformations |
| `Dockerfile` | Production container image |

### App Structure
| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout with HTML shell |
| `src/app/page.tsx` | Home page with mode selector (✅ Implemented) |
| `src/app/globals.css` | Global styles and utility classes |
| `src/app/mode/find/page.tsx` | Find Mode interface (✅ Drafted) |
| `src/app/mode/scan/page.tsx` | Scan Mode interface (✅ Drafted) |
| `src/app/mode/study/page.tsx` | Study Mode interface (✅ Drafted) |

### Components
| File | Purpose |
|------|---------|
| `src/components/camera/CameraView.tsx` | Reusable camera component with stream control |

### Libraries & Utilities

#### Camera
| File | Purpose |
|------|---------|
| `src/lib/camera/useCamera.ts` | React hook for camera access and torch control |

#### Vision
| File | Purpose |
|------|---------|
| `src/lib/vision/quality.ts` | Frame quality assessment (blur, motion, exposure) |

#### Mapping
| File | Purpose |
|------|---------|
| `src/lib/mapping/stitcher.ts` | Image stitching and composition logic |

#### API
| File | Purpose |
|------|---------|
| `src/lib/api/client.ts` | Axios client with all endpoint methods |

## 🔧 Backend (services/api/)

### Configuration
| File | Purpose |
|------|---------|
| `requirements.txt` | Python package dependencies |
| `Dockerfile` | Production container image |
| `.env` | Local environment variables |

### Application
| File | Purpose |
|------|---------|
| `app/main.py` | FastAPI app factory and middleware setup |
| `app/__init__.py` | Module initialization |

### Database
| File | Purpose |
|------|---------|
| `app/db/models.py` | Pydantic models for all data types |
| `app/db/__init__.py` | Module initialization |

### Routers (API Endpoints)
| File | Purpose | Endpoints |
|------|---------|-----------|
| `app/routers/health.py` | Health check | `GET /health` |
| `app/routers/boards.py` | Board CRUD | `GET/POST/PUT/DELETE /boards`, `/boards/{id}/scans` |
| `app/routers/uploads.py` | File uploads | `POST /uploads/image`, `GET /uploads/{id}` |
| `app/routers/inference.py` | ML inference | `POST /inference/detect`, `/ocr`, `/board-id`, `/match-components` |
| `app/routers/annotations.py` | Annotation CRUD | `GET/POST/PUT/DELETE /boards/{id}/annotations/{side}` |
| `app/routers/__init__.py` | Module initialization |

### Examples
| File | Purpose |
|------|---------|
| `EXAMPLE_ROUTER.py` | Template for adding new endpoints |

## 📚 Shared (shared/)

### Types
| File | Purpose |
|------|---------|
| `shared/types/vision.ts` | Vision-related types (detection, OCR, quality) |
| `shared/types/boards.ts` | Board record types |
| `shared/types/annotations.ts` | Annotation and drawing types |

### Utilities
| File | Purpose |
|------|---------|
| `shared/utils/geometry.ts` | Math utilities (distance, transforms, collision detection) |

---

## 🗂️ File Count

**Total Files: ~40+**

### By Category
- Configuration: 12
- Frontend Pages/Components: 7
- Frontend Utilities: 4
- Backend APIs: 6
- Backend Models: 1
- Shared Types: 3
- Shared Utils: 1
- Documentation: 6

### By Lines of Code
- Total: ~4,000+ lines
- Frontend: ~2,000 lines
- Backend: ~1,500 lines
- Shared: ~500 lines

---

## 🔑 Key Entry Points

### For Frontend Development
Start here → `apps/web/src/app/page.tsx`

### For Backend Development
Start here → `services/api/app/main.py`

### For Understanding Architecture
Start here → `DEVELOPMENT.md`

### For Running the Project
Start here → `BUILD.md`

---

## 🎯 Implementation Priorities

### High Priority (Next Steps)
1. Set up database (SQLAlchemy + PostgreSQL)
2. Implement real vision detection
3. Implement image stitching
4. Implement canvas drawing

### Medium Priority
1. Add authentication
2. Implement file storage
3. Add comprehensive testing
4. Performance optimization

### Low Priority (v2)
1. Advanced stitching
2. AI rail tracing
3. Mobile app
4. Advanced analytics

---

## 💡 Quick Links within Code

### For Component Location
- Find Mode: `src/app/mode/find/page.tsx`
- Scan Mode: `src/app/mode/scan/page.tsx`
- Study Mode: `src/app/mode/study/page.tsx`

### For Database Models
- All Pydantic models: `services/api/app/db/models.py`

### For API Endpoints
- All routers: `services/api/app/routers/`

### For Type Definitions
- All shared types: `shared/types/`

### For Utilities
- Geometry utils: `shared/utils/geometry.ts`
- Camera utils: `apps/web/src/lib/camera/`
- Vision utils: `apps/web/src/lib/vision/`

---

## 🚀 From Here

1. **Read BUILD.md** - Set up local environment
2. **Run the project** - Follow quick start
3. **Explore DEVELOPMENT.md** - Understand architecture
4. **Pick a feature** - Choose from implementation checklist
5. **Start coding** - Add real functionality

---

**Last Updated: February 8, 2025**
**Status: MVP Scaffold Complete - Ready for Implementation**
