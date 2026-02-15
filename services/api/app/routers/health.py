"""
services/api/app/routers/health.py
Health check endpoint
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "sasasight-api",
    }
