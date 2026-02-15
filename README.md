# SasaSight

**Find + Scan + Study** — A mobile-first web app for motherboard repair teams.

## Three Operating Modes

### 🎯 Find Mode (Live Targeting)
- Input a reference designator, part number, or marking (e.g., `R120`, `U7`)
- Real-time camera detection + OCR highlights the component
- Stabilized targeting with no flicker
- Shows nearby labels for confirmation

### 📸 Scan Mode (Board Mapping)
- Build a high-resolution "digital twin" of a motherboard (front and/or back)
- Automatically stitch frames into a clear, panoramic board image
- Detect components and silkscreen labels while scanning
- Extract board number/ID from the board's printed identifier
- Coverage heatmap shows unscanned areas

### 🖊️ Study Mode (Canvas + Annotations)
- Open any saved board scan in a zoomable canvas
- Draw, label, and mark:
  - **Rails**: 5V, 3.3V, VBAT traces
  - **Fault zones**: short circuits, burn marks, missing components
  - **Measurement points**: PPBUS, TP12, etc.
- Toggle overlays: detected components, OCR labels, annotations
- Compare front vs. back side
- Export annotated diagrams for repair reports

## Project Structure

```
sasasight/
├── apps/
│   └── web/                (Next.js frontend)
│       ├── src/
│       │   ├── app/
│       │   ├── components/
│       │   └── lib/
│       └── package.json
├── services/
│   └── api/                (Python backend)
│       ├── app/
│       ├── storage/
│       └── requirements.txt
├── shared/
│   ├── types/
│   └── utils/
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.10+
- Docker (optional)

### Frontend
```bash
cd apps/web
npm install
npm run dev
```
Runs on `http://localhost:3000`

### Backend
```bash
cd services/api
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```
Runs on `http://localhost:8000`

### Docker
```bash
docker-compose up
```

## Key Features (MVP v1)

- ✅ Find Mode with live OCR
- ✅ Scan Mode with frame stitching
- ✅ Study Mode with basic drawing tools
- ✅ Board ID detection and storage
- ✅ Front/back board scanning
- ✅ Annotation save/load

## Future (v1.5 & v2)

- 🚀 AI-assisted rail tracing
- 🚀 Component detection overlay on scans
- 🚀 Board template alignment
- 🚀 Technician accounts & job tracking
- 🚀 Advanced stitching with exposure correction

## Tech Stack

**Frontend**
- Next.js 14+
- React 18
- TypeScript
- TailwindCSS

**Backend**
- FastAPI (Python)
- PostgreSQL or SQLite
- S3/Local storage

**Vision**
- OpenCV.js (browser-side)
- TensorFlow.js (optional inference)
- WebAssembly (performance-critical algorithms)

## Contributing

See [DEVELOPMENT.md](docs/DEVELOPMENT.md) for architecture and implementation details.

## License

[Add license info]
