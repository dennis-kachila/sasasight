"""
services/api/app/db/models.py
Database models for SasaSight
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# Request/Response Models
class BoardMetadata(BaseModel):
    manufacturer: Optional[str] = None
    boardRevision: Optional[str] = None
    scanDuration: Optional[int] = None
    totalFrames: Optional[int] = None
    stitchQuality: Optional[float] = None
    coverage: Optional[float] = None


class BoardRecord(BaseModel):
    id: str
    boardId: str
    deviceModel: Optional[str] = None
    side: str  # 'front' or 'back'
    imageUrl: str
    thumbnailUrl: Optional[str] = None
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    createdBy: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[BoardMetadata] = None


class BoardCreate(BaseModel):
    boardId: str
    deviceModel: Optional[str] = None
    side: str
    imageUrl: str
    notes: Optional[str] = None
    metadata: Optional[BoardMetadata] = None


class BoardUpdate(BaseModel):
    deviceModel: Optional[str] = None
    notes: Optional[str] = None
    metadata: Optional[BoardMetadata] = None


class ScanProgress(BaseModel):
    boardSetId: str
    boardId: str
    side: str
    status: str  # 'scanning', 'stitching', 'complete', 'failed'
    progress: Optional[float] = None
    framesCollected: Optional[int] = None
    estimatedQuality: Optional[float] = None


class AnnotationPoint(BaseModel):
    x: float
    y: float


class AnnotationObject(BaseModel):
    id: str
    type: str  # 'line', 'arrow', 'rect', 'circle', 'polygon', 'text'
    points: List[AnnotationPoint] = []
    text: Optional[str] = None
    color: str = "#06b6d4"
    strokeWidth: int = 2
    opacity: float = 1.0
    timestamp: int
    createdBy: Optional[str] = None


class AnnotationLayer(BaseModel):
    id: str
    name: str
    visible: bool = True
    objects: List[AnnotationObject] = []
    color: Optional[str] = None
    opacity: Optional[float] = None


class AnnotationDocument(BaseModel):
    id: str
    boardId: str
    boardSetId: Optional[str] = None
    side: str  # 'front' or 'back'
    layers: List[AnnotationLayer] = []
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)
    createdBy: Optional[str] = None
    notes: Optional[str] = None


class AnnotationCreate(BaseModel):
    layers: List[AnnotationLayer] = []
    notes: Optional[str] = None


# Drawing element model (from frontend canvas)
class DrawingElement(BaseModel):
    tool: str  # 'pen', 'arrow', 'rect', 'circle', 'text', 'eraser'
    color: str = "#06b6d4"
    strokeWidth: int = 2
    startX: Optional[float] = None
    startY: Optional[float] = None
    endX: Optional[float] = None
    endY: Optional[float] = None
    points: Optional[List[dict]] = None  # For pen strokes
    text: Optional[str] = None  # For text tool
    fontSize: Optional[int] = None  # For text tool


class DrawingAnnotation(BaseModel):
    """Simple drawing annotation format from canvas"""
    boardId: str
    side: str  # 'front' or 'back'
    annotations: List[DrawingElement] = []
    createdAt: datetime = Field(default_factory=datetime.utcnow)
    updatedAt: datetime = Field(default_factory=datetime.utcnow)


class AnnotationUpdate(BaseModel):
    layers: Optional[List[AnnotationLayer]] = None
    notes: Optional[str] = None


class DetectionResult(BaseModel):
    label: str
    confidence: float
    bbox: dict  # {'x': int, 'y': int, 'width': int, 'height': int}


class OcrResult(BaseModel):
    text: str
    confidence: float
    bbox: dict


class BoardIdResult(BaseModel):
    boardId: str
    confidence: float
    bounds: dict
    rawText: str
