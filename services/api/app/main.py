"""
services/api/app/main.py
FastAPI application entry point
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from app.routers import boards, uploads, inference, annotations, health, auth, scans
from app.db import Base, engine
from app.middleware import LoggingMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("SasaSight API starting up...")
    # Create database tables
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables initialized")
    yield
    # Shutdown
    logger.info("SasaSight API shutting down...")


# Create FastAPI app
app = FastAPI(
    title="SasaSight API",
    description="Backend API for SasaSight board repair assistant",
    version="0.1.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add logging middleware
app.add_middleware(LoggingMiddleware)

# Include routers
app.include_router(health.router, tags=["health"])
app.include_router(auth.router, tags=["auth"])
app.include_router(boards.router, prefix="/api", tags=["boards"])
app.include_router(uploads.router, prefix="/api", tags=["uploads"])
app.include_router(inference.router, prefix="/api", tags=["inference"])
app.include_router(annotations.router, prefix="/api", tags=["annotations"])
app.include_router(scans.router, tags=["scans"])
from app.routers import traces
app.include_router(traces.router)


@app.get("/")
async def root():
    return {
        "name": "SasaSight API",
        "version": "0.1.0",
        "status": "running"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
    )
