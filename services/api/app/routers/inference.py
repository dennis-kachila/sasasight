"""
services/api/app/routers/inference.py
AI inference endpoints for component detection, OCR, and board ID recognition
"""

import io
import uuid
from typing import List, Optional
from fastapi import APIRouter, File, UploadFile, HTTPException, status, Depends
from pydantic import BaseModel
from PIL import Image
import logging
from sqlalchemy.orm import Session

from app.db import get_db
from app.dependencies import get_current_user
from app.db.orm_models import User
import difflib

router = APIRouter()
logger = logging.getLogger(__name__)

# Try to import OCR libraries
try:
    import pytesseract
    import platform
    import os
    
    # Configure Tesseract binary path for Windows
    if platform.system() == 'Windows':
        tesseract_paths = [
            r'C:\Program Files\Tesseract-OCR\tesseract.exe',
            r'C:\Program Files (x86)\Tesseract-OCR\tesseract.exe',
        ]
        for path in tesseract_paths:
            if os.path.exists(path):
                pytesseract.pytesseract.tesseract_cmd = path
                logger.info(f"✅ Tesseract binary configured: {path}")
                break
    
    HAS_PYTESSERACT = True
    logger.info(f"✅ pytesseract {pytesseract.__version__} loaded successfully")
except ImportError as e:
    HAS_PYTESSERACT = False
    logger.warning(f"❌ pytesseract not installed: {e}, using fallback OCR")

# Pydantic models
class ImageRequest(BaseModel):
    imageUrl: str


class OCRResult(BaseModel):
    text: str
    confidence: float
    bbox: dict  # {x, y, width, height}


class ProcessedImageStage(BaseModel):
    label: str
    description: str
    image_base64: str  # Base64 encoded image


class OcrResponseEnhanced(BaseModel):
    status: str
    text_regions: List[OCRResult]
    total_regions: int
    algorithm: str
    processed_stages: Optional[List[ProcessedImageStage]] = []


class DetectionResult(BaseModel):
    label: str
    confidence: float
    bbox: dict


class ComponentMatch(BaseModel):
    refDes: str
    partNumber: Optional[str] = None
    marking: Optional[str] = None
    confidence: float
    bbox: dict


# Reference designator prefixes and common components
COMPONENT_PREFIXES = {
    'R': 'Resistor',
    'C': 'Capacitor',
    'L': 'Inductor',
    'U': 'IC/Microcontroller',
    'Q': 'Transistor',
    'D': 'Diode',
    'LED': 'LED',
    'SW': 'Switch',
    'J': 'Connector',
    'P': 'Connector',
    'X': 'Crystal/Oscillator',
    'Y': 'Crystal',
    'FB': 'Ferrite Bead',
    'T': 'Transformer',
    'M': 'Motor',
    'TP': 'Test Point',
}


def extract_reference_designator(text: str) -> Optional[str]:
    """Extract reference designator from text (e.g., 'R120', 'C33', 'U7')"""
    text = text.upper().strip()
    
    # Common patterns
    patterns = [
        (r'^([A-Z]{1,3})(\d+)$', 'simple'),  # R120, U7, LED1
        (r'^([A-Z]{1,3})(\d+)([A-Z]?)$', 'with_suffix'),  # R120A
    ]
    
    import re
    for pattern, ptype in patterns:
        match = re.match(pattern, text)
        if match:
            prefix = match.group(1)
            if prefix in COMPONENT_PREFIXES:
                return text
    
    return None


def fuzzy_match_designator(detected: str, ocr_texts: List[str], threshold: float = 0.6) -> Optional[str]:
    """Find best fuzzy match for a detected designator in OCR results"""
    detected_upper = detected.upper().strip()
    
    # Handle common OCR confusions: 0↔O, 1↔I, 5↔S, 8↔B, etc.
    confusables = {
        '0': ['O'],
        'O': ['0'],
        '1': ['I', 'L'],
        'I': ['1', 'L'],
        'L': ['1', 'I'],
        '5': ['S'],
        'S': ['5'],
        '8': ['B'],
        'B': ['8'],
    }
    
    best_match = None
    best_ratio = threshold
    
    for ocr_text in ocr_texts:
        ocr_upper = ocr_text.upper().strip()
        
        # Direct similarity
        ratio = difflib.SequenceMatcher(None, detected_upper, ocr_upper).ratio()
        
        if ratio > best_ratio:
            best_ratio = ratio
            best_match = ocr_text
        
        # Check with character substitutions
        for confusion_char, alternatives in confusables.items():
            for alt in alternatives:
                modified = ocr_upper.replace(alt, confusion_char)
                ratio = difflib.SequenceMatcher(None, detected_upper, modified).ratio()
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_match = ocr_text
    
    return best_match if best_ratio > threshold else None


def preprocess_image_for_ocr(image: Image.Image, return_stages: bool = False) -> tuple[Image.Image, List[ProcessedImageStage]]:
    """Apply comprehensive image preprocessing to improve OCR accuracy on PCB boards
    
    Args:
        image: Input PIL Image
        return_stages: If True, return all intermediate processing stages
        
    Returns:
        Tuple of (processed_image, stages_list)
    """
    stages = []
    
    try:
        import cv2
        import numpy as np
        import base64
        from io import BytesIO
        
        def image_to_base64(img_array: np.ndarray, is_grayscale: bool = True) -> str:
            """Convert numpy array to base64 string"""
            if is_grayscale and len(img_array.shape) == 2:
                pil_img = Image.fromarray(img_array)
            else:
                pil_img = Image.fromarray(cv2.cvtColor(img_array, cv2.COLOR_BGR2RGB) if len(img_array.shape) == 3 else img_array)
            
            buffered = BytesIO()
            pil_img.save(buffered, format="JPEG", quality=85)
            return base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        # Convert PIL to OpenCV format
        img_array = np.array(image)
        
        # STEP 1: Original Image
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Original",
                description="Original uploaded image without any processing",
                image_base64=image_to_base64(img_array, is_grayscale=False)
            ))
        
        # STEP 2: Convert to grayscale
        if len(img_array.shape) == 3:
            gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        else:
            gray = img_array
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Grayscale",
                description="Converted to single-channel grayscale for faster processing",
                image_base64=image_to_base64(gray)
            ))
        
        # STEP 3: Denoise with bilateral filter (preserves edges)
        denoised = cv2.bilateralFilter(gray, 9, 75, 75)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Denoised",
                description="Bilateral filter removes noise while preserving component edges",
                image_base64=image_to_base64(denoised)
            ))
        
        # STEP 4: Sharpen image to enhance text edges
        gaussian = cv2.GaussianBlur(denoised, (0, 0), 2.0)
        sharpened = cv2.addWeighted(denoised, 1.5, gaussian, -0.5, 0)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Sharpened",
                description="Unsharp mask applied to enhance text edges and clarity",
                image_base64=image_to_base64(sharpened)
            ))
        
        # STEP 5: Apply CLAHE for adaptive contrast enhancement
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(sharpened)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Enhanced",
                description="CLAHE applied for adaptive contrast enhancement in dark/bright regions",
                image_base64=image_to_base64(enhanced)
            ))
        
        # STEP 6: Slight Gaussian smoothing before thresholding
        smoothed = cv2.GaussianBlur(enhanced, (3, 3), 0)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Smoothed",
                description="Gaussian blur to reduce fine noise before binarization",
                image_base64=image_to_base64(smoothed)
            ))
        
        # STEP 7: Adaptive thresholding (primary method)
        binary_adaptive = cv2.adaptiveThreshold(
            smoothed, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY, 11, 2
        )
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Binary (Adaptive)",
                description="Adaptive thresholding separates text from background locally",
                image_base64=image_to_base64(binary_adaptive)
            ))
        
        # STEP 8: Otsu's thresholding (alternative method for comparison)
        _, binary_otsu = cv2.threshold(smoothed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Binary (Otsu)",
                description="Otsu's method automatically finds optimal global threshold",
                image_base64=image_to_base64(binary_otsu)
            ))
        
        # STEP 9: Dilation to thicken text strokes
        kernel_dilate = np.ones((2, 2), np.uint8)
        dilated = cv2.dilate(binary_adaptive, kernel_dilate, iterations=1)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Dilated",
                description="Dilation thickens text strokes to connect broken characters",
                image_base64=image_to_base64(dilated)
            ))
        
        # STEP 10: Erosion to remove small noise artifacts
        kernel_erode = np.ones((2, 2), np.uint8)
        eroded = cv2.erode(dilated, kernel_erode, iterations=1)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Eroded",
                description="Erosion removes small noise while preserving text",
                image_base64=image_to_base64(eroded)
            ))
        
        # STEP 11: Final morphological cleanup
        kernel_final = np.ones((2, 2), np.uint8)
        cleaned = cv2.morphologyEx(eroded, cv2.MORPH_CLOSE, kernel_final)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_OPEN, kernel_final)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Final Cleaned",
                description="Final morphological operations (close→open) for optimal OCR input",
                image_base64=image_to_base64(cleaned)
            ))
        
        # ==================== TRACE DETECTION SECTION ====================
        # STEP 12: Canny Edge Detection (for trace detection)
        canny_edges = cv2.Canny(smoothed, 50, 150)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Canny Edges",
                description="Canny edge detection identifies trace boundaries and sharp intensity changes",
                image_base64=image_to_base64(canny_edges)
            ))
        
        # STEP 13: Trace Enhancement using morphology on Canny edges
        kernel_trace = np.ones((3, 3), np.uint8)
        trace_enhanced = cv2.dilate(canny_edges, kernel_trace, iterations=2)
        trace_enhanced = cv2.erode(trace_enhanced, kernel_trace, iterations=1)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Trace Enhanced",
                description="Morphological operations enhance and connect detected traces",
                image_base64=image_to_base64(trace_enhanced)
            ))
        
        # ==================== COMPONENT SUPPRESSION SECTION ====================
        # STEP 14: Component Detection by Color Range (for color images)
        component_mask = np.zeros_like(gray)
        
        if len(img_array.shape) == 3:
            # Convert to HSV for better color detection
            hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)
            
            # Detect common component colors
            # Black components (SMD - very dark)
            lower_black = np.array([0, 0, 0])
            upper_black = np.array([180, 255, 50])
            mask_black = cv2.inRange(hsv, lower_black, upper_black)
            
            # Blue components (capacitors)
            lower_blue = np.array([100, 50, 50])
            upper_blue = np.array([130, 255, 255])
            mask_blue = cv2.inRange(hsv, lower_blue, upper_blue)
            
            # Green components (resistors)
            lower_green = np.array([40, 30, 30])
            upper_green = np.array([80, 255, 255])
            mask_green = cv2.inRange(hsv, lower_green, upper_green)
            
            # Brown/Orange components (ICs, transistors)
            lower_brown1 = np.array([10, 50, 50])
            upper_brown1 = np.array([20, 255, 255])
            mask_brown1 = cv2.inRange(hsv, lower_brown1, upper_brown1)
            
            lower_brown2 = np.array([0, 50, 50])
            upper_brown2 = np.array([10, 255, 255])
            mask_brown2 = cv2.inRange(hsv, lower_brown2, upper_brown2)
            
            # Combine all component masks
            component_mask = cv2.bitwise_or(mask_black, mask_blue)
            component_mask = cv2.bitwise_or(component_mask, mask_green)
            component_mask = cv2.bitwise_or(component_mask, mask_brown1)
            component_mask = cv2.bitwise_or(component_mask, mask_brown2)
            
            # Morphological cleanup of component mask
            kernel_comp = np.ones((5, 5), np.uint8)
            component_mask = cv2.morphologyEx(component_mask, cv2.MORPH_CLOSE, kernel_comp)
            component_mask = cv2.morphologyEx(component_mask, cv2.MORPH_OPEN, kernel_comp)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Component Mask",
                description="HSV-based color detection masks common component colors (black, blue, green, brown)",
                image_base64=image_to_base64(component_mask)
            ))
        
        # STEP 15: Component Suppression (create image with components removed)
        suppressed = gray.copy()
        if len(img_array.shape) == 3:
            # Use color inpainting to fill component areas
            component_mask_uint8 = component_mask.astype(np.uint8)
            # Dilate mask to ensure full component removal
            kernel_inpaint = np.ones((5, 5), np.uint8)
            mask_dilated = cv2.dilate(component_mask_uint8, kernel_inpaint, iterations=2)
            
            # Simple inpainting: replace component areas with background average
            suppressed_color = img_array.copy()
            board_background = cv2.inpaint(suppressed_color, mask_dilated, 3, cv2.INPAINT_TELEA)
            suppressed = cv2.cvtColor(board_background, cv2.COLOR_RGB2GRAY)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Component Suppressed",
                description="Inpainting removes components and fills areas with background color",
                image_base64=image_to_base64(suppressed)
            ))
        
        # STEP 16: Trace Isolation (mask out traces from suppressed image)
        # Thresholding the component-suppressed image
        _, trace_isolated = cv2.threshold(suppressed, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        # Combine with Canny edges for better trace definition
        trace_mask = cv2.bitwise_or(trace_enhanced, trace_isolated)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Trace Isolated",
                description="Isolated trace map showing only PCB traces without components",
                image_base64=image_to_base64(trace_mask)
            ))
        
        # ==================== COLORED TRACE OVERLAY SECTION ====================
        # STEP 17: Colored Traces - Blue overlay on original
        trace_colored = img_array.copy().astype(np.float32)
        
        # Create blue colored trace overlay
        trace_colored_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR).astype(np.float32)
        blue_overlay = np.zeros_like(trace_colored_bgr)
        blue_overlay[:, :, 0] = 255  # Blue channel
        
        # Apply blue color only where traces are detected
        trace_mask_3channel = cv2.cvtColor(trace_mask, cv2.COLOR_GRAY2BGR).astype(np.float32) / 255.0
        trace_colored_bgr = cv2.addWeighted(trace_colored_bgr, 0.7, blue_overlay * trace_mask_3channel, 0.3, 0)
        trace_colored_output = cv2.cvtColor(trace_colored_bgr.astype(np.uint8), cv2.COLOR_BGR2RGB)
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Traces (Blue Overlay)",
                description="Detected traces overlaid in blue on top of the original PCB image",
                image_base64=image_to_base64(trace_colored_output, is_grayscale=False)
            ))
        
        # STEP 18: Trace + Board Enhancement
        # High contrast trace visualization
        board_bg = suppressed.copy()
        board_with_traces = np.where(trace_mask > 0, 0, board_bg)  # Black traces on board background
        
        if return_stages:
            stages.append(ProcessedImageStage(
                label="Final Trace Map",
                description="Clean trace map with board background and black traces - ready for circuit analysis",
                image_base64=image_to_base64(board_with_traces)
            ))
        
        # Convert back to PIL using the final cleaned version for OCR
        return Image.fromarray(cleaned), stages
        
    except Exception as e:
        logger.warning(f"Image preprocessing failed: {e}, using original")
        return image, stages


def perform_ocr_tesseract(image: Image.Image, return_stages: bool = False) -> tuple[List[OCRResult], List[ProcessedImageStage]]:
    """Perform OCR using pytesseract with enhanced preprocessing
    
    Args:
        image: Input PIL Image
        return_stages: If True, return intermediate processing stages
        
    Returns:
        Tuple of (ocr_results, processing_stages)
    """
    if not HAS_PYTESSERACT:
        logger.error("❌ pytesseract not available!")
        return [], []
    
    try:
        logger.info("🔧 Starting Tesseract OCR with preprocessing...")
        
        # Preprocess image for better OCR
        preprocessed, stages = preprocess_image_for_ocr(image, return_stages=return_stages)
        logger.info(f"✅ Preprocessing complete: {preprocessed.size} pixels")
        
        # Configure Tesseract for PCB text (small, mixed alphanumeric)
        custom_config = r'--oem 3 --psm 11 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
        logger.info(f"⚙️ Tesseract config: {custom_config}")
        
        # Get detailed data with bounding boxes
        logger.info("🔍 Calling pytesseract.image_to_data...")
        data = pytesseract.image_to_data(
            preprocessed, 
            config=custom_config,
            output_type='dict'
        )
        
        logger.info(f"📊 Tesseract returned {len(data['text'])} raw text entries")
        
        results = []
        for i in range(len(data['text'])):
            text = data['text'][i].strip()
            if text and len(text) >= 2:  # Skip single chars and empty
                conf = int(data['conf'][i])
                if conf > 40:  # Confidence threshold
                    results.append(OCRResult(
                        text=text,
                        confidence=conf / 100.0,
                        bbox={
                            'x': int(data['left'][i]),
                            'y': int(data['top'][i]),
                            'width': int(data['width'][i]),
                            'height': int(data['height'][i]),
                        }
                    ))
                else:
                    logger.debug(f"❌ Rejected '{text}' (conf={conf}%)")
            elif text:
                logger.debug(f"❌ Rejected '{text}' (too short: {len(text)} chars)")
        
        logger.info(f"✅ OCR extracted {len(results)} text regions (after filtering)")
        return results, stages
        
    except Exception as e:
        logger.error(f"❌ OCR error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return [], []


def perform_ocr_fallback(image: Image.Image) -> List[OCRResult]:
    """Fallback OCR - return empty list or use simple heuristics"""
    logger.warning("Using fallback OCR (no real OCR library available)")
    return []


@router.post("/inference/ocr")
async def extract_text_from_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """Extract text (OCR) from uploaded image - public endpoint for demo"""
    try:
        # Read image
        contents = await file.read()
        logger.info(f"📥 Received image: {file.filename}, size: {len(contents)} bytes")
        image = Image.open(io.BytesIO(contents))
        logger.info(f"📸 Image opened: {image.size} pixels, mode: {image.mode}")
        
        # Perform OCR
        logger.info(f"🔍 Starting OCR with HAS_PYTESSERACT={HAS_PYTESSERACT}")
        processed_stages = []
        
        if HAS_PYTESSERACT:
            ocr_results, processed_stages = perform_ocr_tesseract(image, return_stages=True)
        else:
            ocr_results = perform_ocr_fallback(image)
        
        logger.info(f"OCR completed: {len(ocr_results)} text regions detected")
        if len(ocr_results) > 0:
            logger.info(f"📝 Sample detections: {[r.text for r in ocr_results[:5]]}")
        else:
            logger.warning("⚠️ NO TEXT DETECTED - check image quality or Tesseract config")
        
        return {
            "status": "success",
            "text_regions": [r.dict() for r in ocr_results],
            "total_regions": len(ocr_results),
            "algorithm": "pytesseract" if HAS_PYTESSERACT else "fallback",
            "processed_stages": [s.dict() for s in processed_stages],
        }
    
    except Exception as e:
        logger.error(f"OCR processing failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="OCR processing failed"
        )


@router.post("/inference/detect")
async def detect_components(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """Detect electronic components in an image - public endpoint for demo"""
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Convert to grayscale for analysis
        gray = image.convert('L')
        
        # Basic edge detection simulation using PIL
        # In production, this would use trained ML model (TensorFlow, YOLO, etc.)
        detections = []
        
        logger.info(f"Component detection completed on image {image.size}")
        
        return {
            "status": "success",
            "detections": detections,
            "image_size": {"width": image.width, "height": image.height},
            "total_detections": len(detections),
            "note": "Use frontend TensorFlow.js for real-time detection",
        }
    
    except Exception as e:
        logger.error(f"Component detection failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Component detection failed"
        )


@router.post("/inference/board-id")
async def extract_board_id(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> dict:
    """Extract board ID from image using OCR - public endpoint for demo"""
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Perform OCR to find board ID
        if HAS_PYTESSERACT:
            ocr_results = perform_ocr_tesseract(image)
        else:
            ocr_results = perform_ocr_fallback(image)
        
        # Look for board ID patterns (common patterns: XXXXX-XXXXX, REV, MODEL, etc.)
        board_id = None
        board_id_confidence = 0.0
        board_id_bounds = None
        
        import re
        for result in ocr_results:
            text = result.text.upper()
            
            # Look for board ID patterns
            patterns = [
                r'([A-Z0-9]{4,}-[A-Z0-9]{4,})',  # XXXX-XXXX
                r'(REV\s*[A-Z0-9]+)',  # REV A1
                r'(MODEL\s*[\w-]+)',  # MODEL XXXX
                r'([A-Z0-9]{6,}-[A-Z0-9]{1,})',  # Extended format
            ]
            
            for pattern in patterns:
                match = re.search(pattern, text)
                if match:
                    potential_id = match.group(1)
                    if result.confidence > board_id_confidence:
                        board_id = potential_id
                        board_id_confidence = result.confidence
                        board_id_bounds = result.bbox
        
        return {
            "status": "success",
            "board_id": board_id,
            "confidence": board_id_confidence,
            "bounds": board_id_bounds,
            "ocr_regions": len(ocr_results),
        }
    
    except Exception as e:
        logger.error(f"Board ID extraction failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Board ID extraction failed"
        )


@router.post("/inference/match-components")
async def match_detected_components(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Match detected components with OCR labels"""
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Perform OCR to get all text
        if HAS_PYTESSERACT:
            ocr_results = perform_ocr_tesseract(image)
        else:
            ocr_results = perform_ocr_fallback(image)
        
        # Extract all OCR text
        ocr_texts = [r.text for r in ocr_results]
        
        # In production, get detections from ML model
        # For now, extract reference designators from OCR
        matches = []
        
        for result in ocr_results:
            ref_des = extract_reference_designator(result.text)
            if ref_des:
                matches.append({
                    "refDes": ref_des,
                    "partNumber": None,
                    "marking": result.text,
                    "confidence": result.confidence,
                    "bbox": result.bbox,
                })
        
        logger.info(f"Matched {len(matches)} components")
        
        return {
            "status": "success",
            "matches": matches,
            "total_matches": len(matches),
            "ocr_regions_analyzed": len(ocr_results),
        }
    
    except Exception as e:
        logger.error(f"Component matching failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Component matching failed"
        )


@router.post("/inference/quality-check")
async def check_image_quality(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    """Check image quality for scanning"""
    try:
        import numpy as np
        
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        
        # Convert to numpy array for analysis
        img_array = np.array(image.convert('L'), dtype=np.float32)
        
        # Calculate blur score using Laplacian variance
        from scipy import signal
        kernel = np.array([
            [0, -1, 0],
            [-1, 4, -1],
            [0, -1, 0]
        ], dtype=np.float32)
        
        blurred = signal.convolve2d(img_array, kernel, mode='same', boundary='symm')
        blur_score = float(np.var(blurred)) / 5000.0  # Normalize
        blur_score = min(1.0, max(0.0, blur_score))  # Clamp to 0-1
        
        # Calculate exposure quality (brightness)
        mean_brightness = float(np.mean(img_array)) / 255.0
        exposure_quality = 1.0 - abs(0.5 - mean_brightness)  # Optimal at 0.5
        
        # Motion score (simplified - check if image has good detail)
        motion_score = max(0.5, blur_score)  # Simplified
        
        return {
            "status": "success",
            "blur_score": blur_score,
            "motion_score": motion_score,
            "exposure_quality": exposure_quality,
            "overall_quality": (blur_score + motion_score + exposure_quality) / 3.0,
            "image_size": {"width": image.width, "height": image.height},
        }
    
    except ImportError:
        logger.warning("scipy not available for quality analysis")
        return {
            "status": "error",
            "message": "Image quality check requires scipy library",
        }
    except Exception as e:
        logger.error(f"Quality check failed: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Quality check failed"
        )
