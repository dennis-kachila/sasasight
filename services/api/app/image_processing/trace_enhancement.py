import cv2
import numpy as np
from PIL import Image
import logging
import base64
from io import BytesIO
from typing import List, Dict, Tuple

logger = logging.getLogger(__name__)

class ProcessingStage:
    """Represents a single stage in the trace processing pipeline"""
    def __init__(self, label: str, description: str, image_array: np.ndarray, is_grayscale: bool = True):
        self.label = label
        self.description = description
        self.image_array = image_array
        self.is_grayscale = is_grayscale
    
    def to_base64(self) -> str:
        """Convert image to base64 string"""
        if self.is_grayscale and len(self.image_array.shape) == 2:
            pil_img = Image.fromarray(self.image_array)
        else:
            if len(self.image_array.shape) == 3:
                pil_img = Image.fromarray(cv2.cvtColor(self.image_array, cv2.COLOR_BGR2RGB))
            else:
                pil_img = Image.fromarray(self.image_array)
        
        buffered = BytesIO()
        pil_img.save(buffered, format="JPEG", quality=85)
        return base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    def to_dict(self) -> Dict:
        """Convert to dictionary"""
        return {
            'label': self.label,
            'description': self.description,
            'image_base64': self.to_base64()
        }


class TraceEnhancer:
    """Enhanced trace detection with processing stages and better component detection"""
    
    def __init__(self):
        # Expanded HSV color ranges for better component detection
        self.component_colors = {
            # Black components (SMD, resistors, ICs)
            'black_dark': ((0, 0, 0), (180, 255, 50)),
            'black_medium': ((0, 0, 40), (180, 50, 100)),
            
            # Blue components (capacitors, connectors)
            'blue_light': ((90, 30, 100), (120, 255, 255)),
            'blue_dark': ((100, 50, 50), (130, 200, 200)),
            
            # Green components (resistors, marking)
            'green': ((40, 30, 30), (80, 255, 255)),
            
            # Brown/Orange components (ICs, transistors, inductors)
            'brown1': ((0, 50, 50), (15, 255, 255)),
            'brown2': ((10, 50, 50), (25, 255, 255)),
            'orange': ((5, 100, 100), (20, 255, 255)),
            
            # Red components
            'red': ((0, 50, 50), (10, 255, 255)),
            'red_dark': ((170, 50, 50), (180, 255, 255)),
            
            # Yellow components
            'yellow': ((20, 50, 50), (35, 255, 255)),
            
            # Metallic/Silver
            'metallic': ((0, 0, 150), (180, 50, 255))
        }
        
        self.stages: List[ProcessingStage] = []

    def preprocess(self, image: np.ndarray) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Convert to grayscale, blur, and apply both adaptive and Otsu thresholding with edge detection.
        Returns: (binary_adaptive, binary_otsu, edges)
        """
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        
        # Blur to reduce noise
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        
        # Adaptive Thresholding
        thresh_adaptive = cv2.adaptiveThreshold(
            blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
            cv2.THRESH_BINARY_INV, 19, 9
        )
        
        # Otsu's Thresholding
        _, thresh_otsu = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        
        # Canny Edge Detection
        edges = cv2.Canny(blurred, 50, 150)
        
        logger.info("✅ Preprocessing complete: adaptive threshold, Otsu threshold, and Canny edges")
        
        return thresh_adaptive, thresh_otsu, edges

    def enhance_traces(self, binary_adaptive: np.ndarray, binary_otsu: np.ndarray, 
                      edges: np.ndarray) -> np.ndarray:
        """
        Combine multiple trace detection methods and enhance with morphological operations.
        """
        # Combine all methods: adaptive + Otsu + Canny edges
        combined = cv2.bitwise_or(binary_adaptive, binary_otsu)
        combined = cv2.bitwise_or(combined, edges)
        
        # Morphological operations to connect broken lines and thicken traces
        kernel_dilate = np.ones((3, 3), np.uint8)
        dilated = cv2.dilate(combined, kernel_dilate, iterations=2)
        
        kernel_erode = np.ones((2, 2), np.uint8)
        eroded = cv2.erode(dilated, kernel_erode, iterations=1)
        
        # Final close operation to fill small holes
        kernel_close = np.ones((3, 3), np.uint8)
        enhanced = cv2.morphologyEx(eroded, cv2.MORPH_CLOSE, kernel_close)
        
        logger.info("✅ Trace enhancement complete: combined methods + morphology")
        
        return enhanced

    def suppress_components(self, image: np.ndarray) -> np.ndarray:
        """
        Detect and mask out common component colors using expanded HSV ranges.
        """
        hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
        mask_combined = np.zeros(image.shape[:2], dtype=np.uint8)
        
        component_count = {}
        
        for name, (lower, upper) in self.component_colors.items():
            lower_np = np.array(lower, dtype=np.uint8)
            upper_np = np.array(upper, dtype=np.uint8)
            mask = cv2.inRange(hsv, lower_np, upper_np)
            detected_pixels = cv2.countNonZero(mask)
            component_count[name] = detected_pixels
            mask_combined = cv2.bitwise_or(mask_combined, mask)
        
        # Dilate mask to ensure full component coverage
        kernel = np.ones((7, 7), np.uint8)
        mask_combined = cv2.dilate(mask_combined, kernel, iterations=2)
        
        logger.info(f"✅ Component suppression: detected {len([v for v in component_count.values() if v > 0])} component types")
        
        return mask_combined

    def inpaint_components(self, image: np.ndarray, component_mask: np.ndarray) -> np.ndarray:
        """
        Use inpainting to remove components and fill with background color.
        """
        if cv2.countNonZero(component_mask) == 0:
            logger.info("⏭️ No components detected for inpainting")
            return image
        
        # Apply inpainting
        inpainted = cv2.inpaint(image, component_mask.astype(np.uint8), 5, cv2.INPAINT_TELEA)
        
        logger.info("✅ Component inpainting complete")
        
        return inpainted

    def apply_trace_color(self, image_shape: Tuple, trace_mask: np.ndarray, 
                         color: Tuple = (0, 255, 0)) -> np.ndarray:
        """
        Create a colored layer for traces (BGR format).
        Default is Green: (0, 255, 0)
        Blue: (255, 0, 0)
        """
        colored_traces = np.zeros(image_shape, dtype=np.uint8)
        colored_traces[:] = color
        
        return cv2.bitwise_and(colored_traces, colored_traces, mask=trace_mask)

    def process_with_stages(self, image_pil: Image.Image, 
                           return_stages: bool = True) -> Tuple[Image.Image, List[ProcessingStage]]:
        """
        Main trace detection pipeline with processing stage tracking.
        Returns: (final_image, processing_stages)
        """
        self.stages = []
        
        try:
            # Convert PIL to cv2
            image_np = np.array(image_pil)
            
            # Handle RGBA images
            if len(image_np.shape) == 3 and image_np.shape[2] == 4:
                image_np = cv2.cvtColor(image_np, cv2.COLOR_RGBA2BGR)
            else:
                image_np = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
            
            if return_stages:
                self.stages.append(ProcessingStage(
                    "Original (Trace Detection)",
                    "Original PCB image for trace analysis",
                    image_np,
                    is_grayscale=False
                ))
            
            # Convert to grayscale
            gray = cv2.cvtColor(image_np, cv2.COLOR_BGR2GRAY)
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            if return_stages:
                self.stages.append(ProcessingStage(
                    "Preprocessed (Blur)",
                    "Gaussian blur applied to reduce noise",
                    blurred,
                    is_grayscale=True
                ))
            
            # 1. Preprocessing (dual thresholding + Canny)
            thresh_adaptive, thresh_otsu, edges = self.preprocess(image_np)
            
            if return_stages:
                self.stages.append(ProcessingStage(
                    "Traces (Adaptive Threshold)",
                    "Adaptive thresholding highlights traces",
                    thresh_adaptive,
                    is_grayscale=True
                ))
                self.stages.append(ProcessingStage(
                    "Traces (Otsu Threshold)",
                    "Otsu's automatic thresholding method",
                    thresh_otsu,
                    is_grayscale=True
                ))
                self.stages.append(ProcessingStage(
                    "Traces (Canny Edges)",
                    "Canny edge detection for trace boundaries",
                    edges,
                    is_grayscale=True
                ))
            
            # 2. Component Detection
            component_mask = self.suppress_components(image_np)
            
            if return_stages:
                self.stages.append(ProcessingStage(
                    "Component Mask",
                    "HSV-based detection of component colors (black, blue, green, brown, etc.)",
                    component_mask,
                    is_grayscale=True
                ))
            
            # 3. Enhance Traces
            enhanced_trace_mask = self.enhance_traces(thresh_adaptive, thresh_otsu, edges)
            
            if return_stages:
                self.stages.append(ProcessingStage(
                    "Traces (Enhanced)",
                    "Combined trace detection with morphological enhancement",
                    enhanced_trace_mask,
                    is_grayscale=True
                ))
            
            # 4. Component Inpainting
            inpainted = self.inpaint_components(image_np, component_mask)
            
            if return_stages:
                self.stages.append(ProcessingStage(
                    "Inpainted (Components Removed)",
                    "Components removed and areas filled with inpainting",
                    inpainted,
                    is_grayscale=False
                ))
            
            # 5. Remove components from trace mask
            safe_area_mask = cv2.bitwise_not(component_mask)
            final_trace_mask = cv2.bitwise_and(enhanced_trace_mask, enhanced_trace_mask, mask=safe_area_mask)
            
            if return_stages:
                self.stages.append(ProcessingStage(
                    "Traces (Component-Free)",
                    "Traces isolated without component interference",
                    final_trace_mask,
                    is_grayscale=True
                ))
            
            # 6. Assembly - Create colored trace overlay (Blue)
            base_layer = (image_np * 0.5).astype(np.uint8)
            colored_traces_blue = self.apply_trace_color(image_np.shape, final_trace_mask, color=(255, 0, 0))
            
            final_output_blue = base_layer.copy()
            trace_indices = np.where(final_trace_mask > 0)
            final_output_blue[trace_indices] = colored_traces_blue[trace_indices]
            final_output_blue = cv2.GaussianBlur(final_output_blue, (3, 3), 0)
            
            if return_stages:
                self.stages.append(ProcessingStage(
                    "Output (Blue Trace Overlay)",
                    "Final visualization with blue traces overlaid on PCB",
                    final_output_blue,
                    is_grayscale=False
                ))
            
            # Convert back to PIL
            output_pil = Image.fromarray(cv2.cvtColor(final_output_blue, cv2.COLOR_BGR2RGB))
            
            logger.info(f"✅ Trace processing complete: {len(self.stages)} stages captured")
            
            return output_pil, self.stages
        
        except Exception as e:
            logger.error(f"❌ Error in trace processing: {str(e)}")
            raise

    def process(self, image_pil: Image.Image) -> Image.Image:
        """
        Legacy method for backward compatibility - returns only final image.
        """
        result, _ = self.process_with_stages(image_pil, return_stages=False)
        return result

