"""
services/api/app/routers/boards.py
Board endpoints with database persistence
"""

import uuid
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.db import get_db, Board, BoardScan as ScanModel, ScanFrame
from app.dependencies import get_current_user
from app.db.orm_models import User
from app.exceptions import BoardNotFound

# Pydantic models for API
class BoardMetadata(BaseModel):
    manufacturer: Optional[str] = None
    boardRevision: Optional[str] = None
    scanDuration: Optional[int] = None
    totalFrames: Optional[int] = None
    stitchQuality: Optional[float] = None
    coverage: Optional[float] = None


class BoardCreate(BaseModel):
    boardId: str
    deviceModel: Optional[str] = None
    side: str  # 'front' or 'back'
    imageUrl: str
    notes: Optional[str] = None
    metadata: Optional[BoardMetadata] = None


class BoardUpdate(BaseModel):
    deviceModel: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[BoardMetadata] = None


class BoardOut(BaseModel):
    id: str
    boardId: str
    deviceModel: Optional[str]
    side: str
    imageUrl: str
    thumbnailUrl: Optional[str]
    createdAt: datetime
    createdBy: Optional[str]
    notes: Optional[str]

    class Config:
        from_attributes = True


class ScanProgress(BaseModel):
    boardSetId: str
    boardId: str
    side: str
    status: str
    progress: Optional[float] = None
    framesCollected: Optional[int] = None
    estimatedQuality: Optional[float] = None


router = APIRouter()


@router.get("/boards", response_model=dict)
async def list_boards(
    device_model: Optional[str] = Query(None),
    board_id: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all boards for current user with optional filters"""
    query = db.query(Board).filter(Board.user_id == current_user.id)

    if device_model:
        query = query.filter(Board.device_model == device_model)
    if board_id:
        query = query.filter(Board.board_id == board_id)

    total = query.count()
    boards = query.offset(skip).limit(limit).all()

    return {
        "total": total,
        "items": [BoardOut.from_orm(b).dict() for b in boards],
    }


@router.get("/boards/{board_id}", response_model=BoardOut)
async def get_board(
    board_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a specific board"""
    board = db.query(Board).filter(
        (Board.id == board_id) & (Board.user_id == current_user.id)
    ).first()

    if not board:
        raise BoardNotFound(board_id)

    return BoardOut.from_orm(board)


@router.post("/boards", response_model=BoardOut, status_code=status.HTTP_201_CREATED)
async def create_board(
    data: BoardCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a new board record"""
    board = Board(
        id=str(uuid.uuid4()),
        board_id=data.boardId,
        device_model=data.deviceModel,
        side=data.side,
        image_url=data.imageUrl,
        user_id=current_user.id,
        created_by=current_user.username,
        notes=data.notes,
        manufacturer=data.metadata.manufacturer if data.metadata else None,
        board_revision=data.metadata.boardRevision if data.metadata else None,
        coverage=data.metadata.coverage if data.metadata else None,
    )

    try:
        db.add(board)
        db.commit()
        db.refresh(board)
        return BoardOut.from_orm(board)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create board"
        )


@router.put("/boards/{board_id}", response_model=BoardOut)
async def update_board(
    board_id: str,
    data: BoardUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update a board record"""
    board = db.query(Board).filter(
        (Board.id == board_id) & (Board.user_id == current_user.id)
    ).first()

    if not board:
        raise BoardNotFound(board_id)

    try:
        if data.deviceModel is not None:
            board.device_model = data.deviceModel
        if data.notes is not None:
            board.notes = data.notes
        if data.metadata is not None:
            if data.metadata.manufacturer is not None:
                board.manufacturer = data.metadata.manufacturer
            if data.metadata.boardRevision is not None:
                board.board_revision = data.metadata.boardRevision
            if data.metadata.coverage is not None:
                board.coverage = data.metadata.coverage

        db.commit()
        db.refresh(board)
        return BoardOut.from_orm(board)
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update board"
        )


@router.delete("/boards/{board_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_board(
    board_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a board record"""
    board = db.query(Board).filter(
        (Board.id == board_id) & (Board.user_id == current_user.id)
    ).first()

    if not board:
        raise BoardNotFound(board_id)

    try:
        db.delete(board)
        db.commit()
        return None
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete board"
        )


@router.post("/boards/{board_id}/scans")
async def save_scan(
    board_id: str,
    image_url: str,
    side: str,
    metadata: Optional[dict] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save scan session progress"""
    # Verify board exists and belongs to user
    board = db.query(Board).filter(
        (Board.id == board_id) & (Board.user_id == current_user.id)
    ).first()

    if not board:
        raise BoardNotFound(board_id)

    try:
        scan = ScanModel(
            id=str(uuid.uuid4()),
            board_id=board_id,
            user_id=current_user.id,
            side=side,
            status="complete",
            quality_score=metadata.get("quality_score") if metadata else None,
        )

        db.add(scan)
        db.commit()
        db.refresh(scan)

        return {
            "id": scan.id,
            "status": scan.status,
            "quality_score": scan.quality_score,
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save scan"
        )


@router.get("/boards/{board_id}/scans")
async def get_scans(
    board_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get all scans for a board"""
    # Verify board exists and belongs to user
    board = db.query(Board).filter(
        (Board.id == board_id) & (Board.user_id == current_user.id)
    ).first()

    if not board:
        raise BoardNotFound(board_id)

    scans = db.query(ScanModel).filter(ScanModel.board_id == board_id).all()

    return {
        "board_id": board_id,
        "total": len(scans),
        "scans": [
            {
                "id": s.id,
                "side": s.side,
                "status": s.status,
                "quality_score": s.quality_score,
                "created_at": s.created_at,
            }
            for s in scans
        ],
    }


@router.get("/boards/samples/list")
async def get_sample_boards():
    """Get sample boards for study mode testing"""
    return {
        "samples": [
            {
                "id": "sample-front",
                "boardId": "sample-board-01",
                "deviceModel": "Laptop Motherboard",
                "side": "front",
                "imageUrl": "/api/uploads/laptop-motherboard-front.jpg",
                "notes": "Sample laptop motherboard - front side",
            },
            {
                "id": "sample-back",
                "boardId": "sample-board-02", 
                "deviceModel": "Circuit Board",
                "side": "back",
                "imageUrl": "/api/uploads/computer-circuit-back.jpg",
                "notes": "Sample computer circuit board - back side",
            },
        ]
    }