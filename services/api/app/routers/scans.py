"""
services/api/app/routers/scans.py
Scan management: capture, stitch, and storage endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import uuid

from app.db.orm_models import User, Board, BoardScan, ScanFrame, Upload
from app.db.session import get_db
from app.dependencies import get_current_user
from app.storage.image_manager import ImageManager
from app.exceptions import NotFoundError, ValidationError

router = APIRouter(prefix="/api/scans", tags=["scans"])
image_manager = ImageManager()


class ScanFrameData:
    """Frame data model for uploads"""
    def __init__(self, frame_index: int, frame_data: bytes, quality_metrics: dict):
        self.frame_index = frame_index
        self.frame_data = frame_data
        self.quality_metrics = quality_metrics


@router.post("/upload")
async def upload_scan(
    board_id: str = Form(...),
    side: str = Form(...),  # "front" or "back"
    frames: List[UploadFile] = File(...),
    stitch_quality: float = Form(default=0.85),
    stitched_image: Optional[UploadFile] = File(None),
    coverage_percentage: float = Form(default=0.0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Upload scanned frames and create a scan session
    
    **Parameters:**
    - board_id: Board identifier string
    - side: "front" or "back"
    - frames: List of frame images (JPEG/PNG)
    - stitch_quality: Quality score of stitching (0-1)
    - stitched_image: Optional pre-stitched panorama
    - coverage_percentage: Estimated coverage of board surface
    
    **Returns:**
    - scan_id: UUID of the created scan session
    - scan_session: Full scan metadata
    - status: "success" or "error"
    """
    
    # Validate input
    if side not in ["front", "back"]:
        raise ValidationError("side must be 'front' or 'back'")
    
    if not 0 <= stitch_quality <= 1:
        raise ValidationError("stitch_quality must be between 0 and 1")
    
    if not frames or len(frames) == 0:
        raise ValidationError("At least one frame is required")
    
    if len(frames) > 100:
        raise ValidationError("Maximum 100 frames per scan allowed")
    
    # Get or create board
    board = db.query(Board).filter(
        (Board.board_id == board_id) & (Board.user_id == current_user.id)
    ).first()
    
    if not board:
        # Create new board if doesn't exist
        board = Board(
            board_id=board_id,
            user_id=current_user.id,
            device_model="Unknown",
            side=side,
        )
        db.add(board)
        db.flush()
    
    # Create scan session
    scan_id = str(uuid.uuid4())
    scan_session = BoardScan(
        id=scan_id,
        board_id=board.id,
        user_id=current_user.id,
        side=side,
        status="completed",
        frames_collected=len(frames),
        quality_score=stitch_quality,
        coverage_percentage=coverage_percentage,
        metadata={
            "upload_time": datetime.utcnow().isoformat(),
            "frame_count": len(frames),
            "board_id_string": board_id,
        }
    )
    db.add(scan_session)
    db.flush()
    
    # Process stitched image if provided
    stitched_image_path = None
    if stitched_image:
        stitched_path = await image_manager.save_uploaded_file(
            stitched_image,
            category="stitched",
            user_id=current_user.id
        )
        stitched_image_path = stitched_path
        scan_session.stitched_image_path = stitched_path
    
    # Store individual frames
    frame_paths = []
    for idx, frame_file in enumerate(frames):
        try:
            frame_path = await image_manager.save_uploaded_file(
                frame_file,
                category="frames",
                user_id=current_user.id
            )
            frame_paths.append(frame_path)
            
            # Create ScanFrame record
            scan_frame = ScanFrame(
                id=str(uuid.uuid4()),
                scan_id=scan_id,
                frame_index=idx,
                image_url=frame_path,
                quality_metrics={
                    "blur_score": 0.85,  # TODO: Calculate from frame
                    "motion_score": 0.90,
                    "exposure_quality": 0.88,
                }
            )
            db.add(scan_frame)
        except Exception as e:
            raise ValidationError(f"Failed to save frame {idx}: {str(e)}")
    
    db.commit()
    
    return {
        "status": "success",
        "scan_id": scan_id,
        "board_id": board_id,
        "side": side,
        "frames_saved": len(frame_paths),
        "stitched_image_url": stitched_image_path,
        "quality_score": stitch_quality,
        "coverage_percentage": coverage_percentage,
        "created_at": datetime.utcnow().isoformat(),
    }


@router.get("/board/{board_id}")
async def get_board_scans(
    board_id: str,
    side: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get all scans for a board
    
    **Parameters:**
    - board_id: Board identifier
    - side: Filter by "front" or "back" (optional)
    
    **Returns:**
    - scans: List of scan sessions with metadata
    """
    
    board = db.query(Board).filter(
        (Board.board_id == board_id) & (Board.user_id == current_user.id)
    ).first()
    
    if not board:
        raise NotFoundError(f"Board '{board_id}' not found")
    
    query = db.query(BoardScan).filter(BoardScan.board_id == board.id)
    
    if side:
        if side not in ["front", "back"]:
            raise ValidationError("side must be 'front' or 'back'")
        query = query.filter(BoardScan.side == side)
    
    scans = query.order_by(BoardScan.created_at.desc()).all()
    
    return {
        "status": "success",
        "board_id": board_id,
        "total_scans": len(scans),
        "scans": [
            {
                "id": scan.id,
                "side": scan.side,
                "status": scan.status,
                "frames_collected": scan.frames_collected,
                "quality_score": scan.quality_score,
                "coverage_percentage": scan.coverage_percentage,
                "stitched_image_url": scan.stitched_image_path,
                "created_at": scan.created_at.isoformat(),
            }
            for scan in scans
        ]
    }


@router.get("/{scan_id}")
async def get_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Get details of a specific scan session"""
    
    scan = db.query(BoardScan).filter(
        (BoardScan.id == scan_id) & (BoardScan.user_id == current_user.id)
    ).first()
    
    if not scan:
        raise NotFoundError(f"Scan '{scan_id}' not found")
    
    # Get frames for this scan
    frames = db.query(ScanFrame).filter(ScanFrame.scan_id == scan_id).order_by(ScanFrame.frame_index).all()
    
    return {
        "status": "success",
        "scan_id": scan_id,
        "side": scan.side,
        "frames_collected": scan.frames_collected,
        "quality_score": scan.quality_score,
        "coverage_percentage": scan.coverage_percentage,
        "stitched_image_url": scan.stitched_image_path,
        "frames": [
            {
                "index": frame.frame_index,
                "image_url": frame.image_url,
                "quality_metrics": frame.quality_metrics,
            }
            for frame in frames
        ],
        "created_at": scan.created_at.isoformat(),
    }


@router.delete("/{scan_id}")
async def delete_scan(
    scan_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Delete a scan session and its associated frames"""
    
    scan = db.query(BoardScan).filter(
        (BoardScan.id == scan_id) & (BoardScan.user_id == current_user.id)
    ).first()
    
    if not scan:
        raise NotFoundError(f"Scan '{scan_id}' not found")
    
    # Delete associated frames
    frames = db.query(ScanFrame).filter(ScanFrame.scan_id == scan_id).all()
    for frame in frames:
        db.delete(frame)
    
    # Delete the scan
    db.delete(scan)
    db.commit()
    
    return {
        "status": "success",
        "message": f"Scan '{scan_id}' deleted",
        "frames_deleted": len(frames),
    }


@router.get("/{scan_id}/frames")
async def get_scan_frames(
    scan_id: str,
    skip: int = 0,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get paginated frames for a scan
    
    **Parameters:**
    - scan_id: Scan session ID
    - skip: Number of frames to skip
    - limit: Maximum frames to return
    
    **Returns:**
    - frames: List of frame metadata
    - total: Total frame count
    """
    
    scan = db.query(BoardScan).filter(
        (BoardScan.id == scan_id) & (BoardScan.user_id == current_user.id)
    ).first()
    
    if not scan:
        raise NotFoundError(f"Scan '{scan_id}' not found")
    
    frames = db.query(ScanFrame).filter(
        ScanFrame.scan_id == scan_id
    ).order_by(ScanFrame.frame_index).offset(skip).limit(limit).all()
    
    total = db.query(ScanFrame).filter(ScanFrame.scan_id == scan_id).count()
    
    return {
        "status": "success",
        "scan_id": scan_id,
        "total": total,
        "returned": len(frames),
        "skip": skip,
        "limit": limit,
        "frames": [
            {
                "index": frame.frame_index,
                "image_url": frame.image_url,
                "quality_metrics": frame.quality_metrics,
            }
            for frame in frames
        ]
    }
