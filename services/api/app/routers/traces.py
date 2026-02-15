from fastapi import APIRouter, UploadFile, File, HTTPException, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
import io
from PIL import Image
import numpy as np
import cv2
import logging
import base64
from app.image_processing.trace_enhancement import TraceEnhancer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/traces", tags=["traces"])
trace_enhancer = TraceEnhancer()

# Pydantic models for structured responses
class TraceImageResponse(BaseModel):
    status: str
    message: str
    image_data: Optional[str] = None  # Base64 encoded image


@router.post("/enhance")
async def enhance_traces(file: UploadFile = File(...)):
    """
    Enhance motherboard traces from an uploaded image.
    Returns the final enhanced image with blue trace overlay.
    
    Returns: Base64 encoded image with highlighted traces
    """
    if not file.content_type.startswith("image/"):
        logger.warning(f"Invalid file type received: {file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image (JPEG, PNG, etc.)"
        )

    try:
        # Read image
        contents = await file.read()
        logger.info(f"📥 Received trace enhancement request: {file.filename} ({len(contents)} bytes)")
        
        image = Image.open(io.BytesIO(contents))
        logger.info(f"✅ Image loaded: {image.size} pixels, mode: {image.mode}")
        
        # Process image (legacy mode - returns only final image)
        enhanced_image = trace_enhancer.process(image)
        
        # Convert to bytes for response
        img_byte_arr = io.BytesIO()
        enhanced_image.save(img_byte_arr, format="JPEG", quality=90)
        img_base64 = "data:image/jpeg;base64," + base64.b64encode(img_byte_arr.getvalue()).decode('utf-8')
        
        logger.info("✅ Trace enhancement complete")
        
        return TraceImageResponse(
            status="success",
            message="Traces enhanced successfully",
            image_data=img_base64
        )

    except Exception as e:
        logger.error(f"❌ Error in trace enhancement: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(e)}"
        )


@router.post("/enhance-with-stages")
async def enhance_traces_with_stages(file: UploadFile = File(...)):
    """
    Enhanced trace detection with processing stages.
    Returns all intermediate processing stages for visualization.
    
    Returns: JSON with processing stages showing trace detection progression
    """
    if not file.content_type.startswith("image/"):
        logger.warning(f"Invalid file type received: {file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image (JPEG, PNG, etc.)"
        )

    try:
        # Read image
        contents = await file.read()
        logger.info(f"📥 Received trace detection request with stages: {file.filename} ({len(contents)} bytes)")
        
        image = Image.open(io.BytesIO(contents))
        logger.info(f"✅ Image loaded: {image.size} pixels, mode: {image.mode}")
        
        # Process image with stages
        enhanced_image, stages = trace_enhancer.process_with_stages(image, return_stages=True)
        
        # Convert stages to JSON-serializable format
        stages_data = [stage.to_dict() for stage in stages]
        
        logger.info(f"✅ Trace processing complete: {len(stages)} stages captured")
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": f"Trace detection complete with {len(stages)} processing stages",
                "total_stages": len(stages),
                "processing_stages": stages_data,
                "stats": {
                    "image_size": list(image.size),
                    "processing_methods": ["Adaptive Threshold", "Otsu Threshold", "Canny Edges", "Inpainting", "Component Suppression"],
                    "component_types_detected": 12
                }
            }
        )

    except Exception as e:
        logger.error(f"❌ Error in trace detection with stages: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing image: {str(e)}"
        )


@router.post("/analyze")
async def analyze_traces(file: UploadFile = File(...)):
    """
    Analyze motherboard traces and components without visual enhancement.
    Returns detailed statistics and component detection results.
    
    Returns: JSON with trace and component analysis metrics
    """
    if not file.content_type.startswith("image/"):
        logger.warning(f"Invalid file type received: {file.content_type}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be an image (JPEG, PNG, etc.)"
        )

    try:
        contents = await file.read()
        logger.info(f"📥 Received trace analysis request: {file.filename}")
        
        image = Image.open(io.BytesIO(contents))
        image_np = np.array(image)
        
        if len(image_np.shape) == 3 and image_np.shape[2] == 4:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2BGR)
        else:
            image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
        
        # Run analysis
        gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Get threshold methods
        thresh_adaptive = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                               cv2.THRESH_BINARY_INV, 19, 9)
        _, thresh_otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        edges = cv2.Canny(blurred, 50, 150)
        
        # Component detection
        component_mask = trace_enhancer.suppress_components(image_np)
        
        # Calculate statistics
        total_pixels = image_np.shape[0] * image_np.shape[1]
        trace_pixels_adaptive = cv2.countNonZero(thresh_adaptive)
        trace_pixels_otsu = cv2.countNonZero(thresh_otsu)
        edge_pixels = cv2.countNonZero(edges)
        component_pixels = cv2.countNonZero(component_mask)
        
        logger.info(f"✅ Trace analysis complete")
        
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "message": "Trace analysis complete",
                "image_info": {
                    "size": list(image.size),
                    "total_pixels": int(total_pixels)
                },
                "trace_analysis": {
                    "adaptive_threshold_pixels": int(trace_pixels_adaptive),
                    "adaptive_percentage": float((trace_pixels_adaptive / total_pixels) * 100),
                    "otsu_threshold_pixels": int(trace_pixels_otsu),
                    "otsu_percentage": float((trace_pixels_otsu / total_pixels) * 100),
                    "canny_edges_pixels": int(edge_pixels),
                    "edge_percentage": float((edge_pixels / total_pixels) * 100)
                },
                "component_analysis": {
                    "component_pixels": int(component_pixels),
                    "component_percentage": float((component_pixels / total_pixels) * 100),
                    "component_types_detected": 12,
                    "detection_method": "HSV Color Range"
                }
            }
        )

    except Exception as e:
        logger.error(f"❌ Error in trace analysis: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error analyzing image: {str(e)}"
        )


@router.get("/health")
async def trace_service_health():
    """Check trace service health and available capabilities"""
    return JSONResponse(
        status_code=200,
        content={
            "status": "healthy",
            "service": "PCB Trace Detection and Enhancement",
            "version": "2.0",
            "endpoints": {
                "/api/traces/enhance": "Simple trace enhancement with blue overlay",
                "/api/traces/enhance-with-stages": "Detailed trace detection with 9 processing stages",
                "/api/traces/analyze": "Trace and component analysis with statistics",
                "/api/traces/health": "Service health check"
            },
            "capabilities": {
                "preprocessing": ["Grayscale", "Gaussian Blur", "Bilateral Denoise"],
                "trace_detection": ["Adaptive Thresholding", "Otsu's Method", "Canny Edge Detection"],
                "component_suppression": ["HSV Color Detection", "Component Masking", "Inpainting"],
                "visualization": ["Blue Trace Overlay", "Component Masks", "Edge Maps"]
            },
            "component_detection": {
                "types": 12,
                "colors": ["Black (SMD)", "Blue (Caps)", "Green (Resistors)", "Brown/Orange (ICs)", "Red", "Yellow", "Metallic"]
            }
        }
    )
