"""
services/api/app/routers/annotations.py
Annotation endpoints
"""

from fastapi import APIRouter, HTTPException
from datetime import datetime
import uuid
from app.db.models import AnnotationDocument, AnnotationCreate, AnnotationUpdate, DrawingAnnotation, DrawingElement

router = APIRouter()

# In-memory storage (replace with real database)
annotations_db: dict[str, dict[str, AnnotationDocument]] = {}
# Simple drawing annotations storage
drawing_annotations_db: dict[str, dict[str, DrawingAnnotation]] = {}


@router.get("/boards/{board_id}/annotations/{side}")
async def get_annotations(board_id: str, side: str):
    """Get annotations for a specific board side"""
    if board_id not in annotations_db:
        return {
            "boardId": board_id,
            "side": side,
            "annotation": None,
        }

    annotation = annotations_db[board_id].get(side)
    return {
        "boardId": board_id,
        "side": side,
        "annotation": annotation,
    }


@router.post("/boards/{board_id}/annotations/{side}")
async def save_annotations(board_id: str, side: str, data: AnnotationCreate):
    """Save annotations for a board side"""
    annotation_id = str(uuid.uuid4())
    now = datetime.utcnow()

    annotation = AnnotationDocument(
        id=annotation_id,
        boardId=board_id,
        side=side,
        layers=data.layers,
        createdAt=now,
        updatedAt=now,
        notes=data.notes,
    )

    if board_id not in annotations_db:
        annotations_db[board_id] = {}

    annotations_db[board_id][side] = annotation
    return annotation


@router.put("/boards/{board_id}/annotations/{side}")
async def update_annotations(board_id: str, side: str, data: AnnotationUpdate):
    """Update annotations for a board side"""
    if board_id not in annotations_db or side not in annotations_db[board_id]:
        raise HTTPException(status_code=404, detail="Annotations not found")

    annotation = annotations_db[board_id][side]
    update_data = data.dict(exclude_unset=True)

    for field, value in update_data.items():
        if value is not None:
            setattr(annotation, field, value)

    annotation.updatedAt = datetime.utcnow()
    annotations_db[board_id][side] = annotation
    return annotation


@router.delete("/boards/{board_id}/annotations/{side}")
async def delete_annotations(board_id: str, side: str):
    """Delete annotations for a board side"""
    if board_id not in annotations_db or side not in annotations_db[board_id]:
        raise HTTPException(status_code=404, detail="Annotations not found")

    del annotations_db[board_id][side]
    return {"status": "deleted"}


# Drawing Annotations (Canvas-based)
@router.post("/boards/{board_id}/drawings/{side}")
async def save_drawing_annotations(board_id: str, side: str, data: DrawingAnnotation):
    """Save drawing annotations for a board side"""
    annotation_id = str(uuid.uuid4())
    now = datetime.utcnow()

    annotation = DrawingAnnotation(
        boardId=board_id,
        side=side,
        annotations=data.annotations,
        createdAt=now,
        updatedAt=now,
    )

    if board_id not in drawing_annotations_db:
        drawing_annotations_db[board_id] = {}

    drawing_annotations_db[board_id][side] = annotation
    return {
        "status": "saved",
        "boardId": board_id,
        "side": side,
        "count": len(data.annotations),
        "savedAt": now.isoformat(),
    }


@router.get("/boards/{board_id}/drawings/{side}")
async def get_drawing_annotations(board_id: str, side: str):
    """Get drawing annotations for a specific board side"""
    if board_id not in drawing_annotations_db or side not in drawing_annotations_db[board_id]:
        return {
            "boardId": board_id,
            "side": side,
            "annotations": [],
            "found": False,
        }

    annotation = drawing_annotations_db[board_id][side]
    return {
        "boardId": board_id,
        "side": side,
        "annotations": annotation.annotations,
        "createdAt": annotation.createdAt.isoformat(),
        "updatedAt": annotation.updatedAt.isoformat(),
        "found": True,
    }


@router.delete("/boards/{board_id}/drawings/{side}")
async def delete_drawing_annotations(board_id: str, side: str):
    """Delete drawing annotations for a board side"""
    if board_id not in drawing_annotations_db or side not in drawing_annotations_db[board_id]:
        raise HTTPException(status_code=404, detail="Annotations not found")

    del drawing_annotations_db[board_id][side]
    return {"status": "deleted", "boardId": board_id, "side": side}
