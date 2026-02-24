"""
services/api/app/routers/uploads.py
File upload endpoints
"""

from fastapi import APIRouter, File, UploadFile, Form, HTTPException
from fastapi.responses import JSONResponse, FileResponse
import os
import uuid
import json
from datetime import datetime

router = APIRouter()

STORAGE_PATH = os.getenv("STORAGE_PATH", "./storage")
os.makedirs(STORAGE_PATH, exist_ok=True)


def resolve_upload_path(filename: str) -> str:
    primary_path = os.path.join(STORAGE_PATH, filename)
    if os.path.exists(primary_path) and os.path.isfile(primary_path):
        return primary_path

    bundled_storage_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "..", "storage")
    )
    fallback_path = os.path.join(bundled_storage_path, filename)
    if os.path.exists(fallback_path) and os.path.isfile(fallback_path):
        return fallback_path

    return primary_path


@router.post("/uploads/image")
async def upload_image(
    file: UploadFile = File(...),
    metadata: str = Form(None),
):
    """Upload an image file"""
    try:
        # Generate unique filename
        file_ext = os.path.splitext(file.filename)[1]
        unique_id = str(uuid.uuid4())
        filename = f"{unique_id}{file_ext}"
        filepath = os.path.join(STORAGE_PATH, filename)

        # Save file
        content = await file.read()
        with open(filepath, "wb") as f:
            f.write(content)

        # Parse metadata if provided
        meta = {}
        if metadata:
            meta = json.loads(metadata)

        return {
            "id": unique_id,
            "filename": filename,
            "filepath": filepath,
            "size": len(content),
            "uploadedAt": datetime.utcnow().isoformat(),
            "metadata": meta,
        }

    except Exception as e:
        return JSONResponse(
            status_code=400,
            content={"error": str(e)},
        )


@router.get("/uploads/info/{file_id}")
async def get_upload_info(file_id: str):
    """Get information about an uploaded file"""
    # In production, query the database
    return {
        "id": file_id,
        "status": "not implemented",
    }


@router.get("/uploads/{filename}")
async def serve_upload(filename: str):
    """Serve an uploaded file"""
    # Sanitize filename to prevent directory traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    filepath = resolve_upload_path(filename)
    
    # Check if file exists
    if not os.path.exists(filepath) or not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine media type
    _, ext = os.path.splitext(filename)
    media_type = "application/octet-stream"
    if ext.lower() in [".jpg", ".jpeg"]:
        media_type = "image/jpeg"
    elif ext.lower() == ".png":
        media_type = "image/png"
    elif ext.lower() == ".gif":
        media_type = "image/gif"
    elif ext.lower() == ".webp":
        media_type = "image/webp"
    
    return FileResponse(filepath, media_type=media_type)
