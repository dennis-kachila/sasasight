"""
services/api/app/db/orm_models.py
SQLAlchemy ORM models for database persistence
"""

import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, ForeignKey, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship
from app.db.base import BaseModel


class User(BaseModel):
    """User account model"""
    __tablename__ = "users"

    username = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    # Relationships
    boards = relationship("Board", back_populates="user")
    scans = relationship("BoardScan", back_populates="user")
    annotations = relationship("Annotation", back_populates="user")

    def __init__(self, **kwargs):
        if "id" not in kwargs:
            kwargs["id"] = str(uuid.uuid4())
        super().__init__(**kwargs)


class Board(BaseModel):
    """Board record model"""
    __tablename__ = "boards"

    board_id = Column(String, index=True, nullable=False)
    device_model = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    side = Column(String, nullable=False)  # 'front' or 'back'
    image_url = Column(String, nullable=True)
    thumbnail_url = Column(String, nullable=True)
    created_by = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    # Metadata
    manufacturer = Column(String, nullable=True)
    board_revision = Column(String, nullable=True)
    coverage = Column(Float, nullable=True)  # 0-100% coverage

    # Relationships
    user = relationship("User", back_populates="boards")
    scans = relationship("BoardScan", back_populates="board", cascade="all, delete-orphan")
    annotations = relationship("Annotation", back_populates="board", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        if "id" not in kwargs:
            kwargs["id"] = str(uuid.uuid4())
        super().__init__(**kwargs)


class BoardScan(BaseModel):
    """Scan session model"""
    __tablename__ = "board_scans"

    board_id = Column(String, ForeignKey("boards.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    side = Column(String, nullable=False)  # 'front' or 'back'
    status = Column(String, default="scanning")  # 'scanning', 'stitching', 'complete', 'failed'
    progress = Column(Float, nullable=True)  # 0-100%
    frames_collected = Column(Integer, default=0)
    quality_score = Column(Float, nullable=True)  # 0-1
    stitched_image_path = Column(String, nullable=True)
    stitch_quality = Column(Float, nullable=True)

    # Relationships
    board = relationship("Board", back_populates="scans")
    user = relationship("User", back_populates="scans")
    frames = relationship("ScanFrame", back_populates="scan", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        if "id" not in kwargs:
            kwargs["id"] = str(uuid.uuid4())
        super().__init__(**kwargs)


class ScanFrame(BaseModel):
    """Individual frame captured during scan"""
    __tablename__ = "scan_frames"

    scan_id = Column(String, ForeignKey("board_scans.id"), nullable=False)
    image_path = Column(String, nullable=False)
    order = Column(Integer, nullable=False)  # Order in scan sequence
    quality_score = Column(Float, nullable=True)  # 0-1
    blur_score = Column(Float, nullable=True)  # 0-1 (higher = sharper)
    motion_score = Column(Float, nullable=True)  # 0-1 (lower = less motion)
    exposure_quality = Column(Float, nullable=True)  # 0-1

    # Relationships
    scan = relationship("BoardScan", back_populates="frames")

    def __init__(self, **kwargs):
        if "id" not in kwargs:
            kwargs["id"] = str(uuid.uuid4())
        super().__init__(**kwargs)


class Upload(BaseModel):
    """File upload record"""
    __tablename__ = "uploads"

    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    mime_type = Column(String, nullable=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)
    upload_metadata = Column(Text, nullable=True)  # JSON string

    def __init__(self, **kwargs):
        if "id" not in kwargs:
            kwargs["id"] = str(uuid.uuid4())
        super().__init__(**kwargs)


class Annotation(BaseModel):
    """Annotation document with layers and objects"""
    __tablename__ = "annotations"

    board_id = Column(String, ForeignKey("boards.id"), nullable=False)
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    side = Column(String, nullable=False)  # 'front' or 'back'
    version = Column(Integer, default=1)
    notes = Column(Text, nullable=True)
    data = Column(Text, nullable=True)  # JSON string storing layers and objects

    # Relationships
    board = relationship("Board", back_populates="annotations")
    user = relationship("User", back_populates="annotations")

    def __init__(self, **kwargs):
        if "id" not in kwargs:
            kwargs["id"] = str(uuid.uuid4())
        super().__init__(**kwargs)
