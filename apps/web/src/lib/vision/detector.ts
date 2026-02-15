/**
 * apps/web/src/lib/vision/detector.ts
 * Component detection using TensorFlow.js with COCO-SSD model
 */

import * as cocoSsd from '@tensorflow-models/coco-ssd'

export interface Detection {
  class: string
  score: number
  bbox: [number, number, number, number]  // [x, y, width, height]
}

export interface ComponentDetection {
  label: string
  confidence: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
}

// Reference designator patterns
const COMPONENT_PREFIXES = {
  'R': 'Resistor',
  'C': 'Capacitor',
  'L': 'Inductor',
  'U': 'IC',
  'Q': 'Transistor',
  'D': 'Diode',
  'LED': 'LED',
  'SW': 'Switch',
  'J': 'Connector',
  'P': 'Connector',
  'X': 'Crystal',
  'Y': 'Crystal',
  'FB': 'Ferrite Bead',
  'T': 'Transformer',
}

/**
 * Initialize and load COCO-SSD model
 * This is a pre-trained model for general object detection
 */
let modelInstance: cocoSsd.ObjectDetection | null = null

async function loadModel(): Promise<cocoSsd.ObjectDetection> {
  if (modelInstance) {
    return modelInstance
  }
  
  try {
    console.log('Loading COCO-SSD model...')
    modelInstance = await cocoSsd.load()
    console.log('COCO-SSD model loaded successfully')
    return modelInstance
  } catch (error) {
    console.error('Failed to load detection model:', error)
    throw new Error('Could not load detection model')
  }
}

/**
 * Detect components in an image element
 */
export async function detectComponentsInImage(
  imageElement: HTMLImageElement | HTMLCanvasElement
): Promise<ComponentDetection[]> {
  try {
    const model = await loadModel()
    
    // Run inference using COCO-SSD API
    const predictions = await model.detect(imageElement)
    
    // Filter and convert predictions (COCO-SSD returns predictions directly)
    const detections: ComponentDetection[] = predictions
      .map((pred: any, index: number) => ({
        label: `Component ${index + 1}`,  // Or parse from OCR
        confidence: pred.score,
        bbox: {
          x: pred.bbox[0],
          y: pred.bbox[1],
          width: pred.bbox[2],
          height: pred.bbox[3],
        },
      }))
    
    return detections
  } catch (error) {
    console.error('Detection error:', error)
    return []
  }
}

/**
 * Detect components from canvas
 */
export async function detectComponentsFromCanvas(
  canvas: HTMLCanvasElement
): Promise<ComponentDetection[]> {
  try {
    // Create temporary image from canvas
    const img = new Image()
    img.src = canvas.toDataURL()
    
    return new Promise((resolve, reject) => {
      img.onload = async () => {
        try {
          const detections = await detectComponentsInImage(img)
          resolve(detections)
        } catch (error) {
          reject(error)
        }
      }
      img.onerror = () => reject(new Error('Failed to load canvas image'))
    })
  } catch (error) {
    console.error('Canvas detection error:', error)
    return []
  }
}

/**
 * Detect components from video frame
 */
export async function detectComponentsFromVideo(
  video: HTMLVideoElement
): Promise<ComponentDetection[]> {
  try {
    const model = await loadModel()
    
    // Create temporary canvas from video frame
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('Could not get canvas context')
    }
    
    ctx.drawImage(video, 0, 0)
    
    // Run inference using COCO-SSD API
    const predictions = await model.detect(canvas)
    
    // Convert predictions
    const detections: ComponentDetection[] = predictions
      .map((pred: any, index: number) => ({
        label: `Component ${index + 1}`,
        confidence: pred.score,
        bbox: {
          x: pred.bbox[0],
          y: pred.bbox[1],
          width: pred.bbox[2],
          height: pred.bbox[3],
        },
      }))
    
    return detections
  } catch (error) {
    console.error('Video detection error:', error)
    return []
  }
}

/**
 * Extract reference designator from text
 * Matches patterns like R120, C33, U7, etc.
 */
export function extractReferenceDesignator(text: string): string | null {
  const text_upper = text.toUpperCase().trim()
  
  // Pattern: Letter(s) followed by number(s) with optional suffix
  const patterns = [
    /^([A-Z]{1,3})(\d+)([A-Z]?)$/,  // R120, U7, LED1, R120A
    /^([A-Z]{1,3})\s*(\d+)$/,       // R 120 (with space)
  ]
  
  for (const pattern of patterns) {
    const match = text_upper.match(pattern)
    if (match) {
      const prefix = match[1]
      if (prefix in COMPONENT_PREFIXES) {
        return text_upper
      }
    }
  }
  
  return null
}

/**
 * Fuzzy match a detected reference designator with OCR text
 * Handles common OCR errors: 0↔O, 1↔I, 5↔S, 8↔B
 */
export function fuzzyMatchDesignator(
  detected: string,
  ocrTexts: string[],
  threshold: number = 0.7
): string | null {
  const detected_upper = detected.toUpperCase().trim()
  
  // Character confusion mappings
  const confusionMap: Record<string, string[]> = {
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
  
  let bestMatch: string | null = null
  let bestScore = threshold
  
  for (const ocrText of ocrTexts) {
    const ocr_upper = ocrText.toUpperCase().trim()
    
    // Direct similarity
    const directScore = calculateSimilarity(detected_upper, ocr_upper)
    if (directScore > bestScore) {
      bestScore = directScore
      bestMatch = ocrText
    }
    
    // Try with character substitutions
    for (const [char, alternatives] of Object.entries(confusionMap)) {
      for (const alt of alternatives) {
        const modified = ocr_upper.split(alt).join(char)
        const modScore = calculateSimilarity(detected_upper, modified)
        if (modScore > bestScore) {
          bestScore = modScore
          bestMatch = ocrText
        }
      }
    }
  }
  
  return bestMatch
}

/**
 * Calculate similarity between two strings (0-1)
 */
function calculateSimilarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a
  
  if (longer.length === 0) return 1.0
  
  const editDistance = getEditDistance(longer, shorter)
  return (longer.length - editDistance) / longer.length
}

/**
 * Levenshtein distance - measure of string difference
 */
function getEditDistance(s1: string, s2: string): number {
  const costs: number[] = []
  
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j
      } else if (j > 0) {
        let newValue = costs[j - 1]
        if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
        }
        costs[j - 1] = lastValue
        lastValue = newValue
      }
    }
    if (i > 0) costs[s2.length] = lastValue
  }
  
  return costs[s2.length]
}

/**
 * Draw detections on canvas
 */
export function drawDetections(
  canvas: HTMLCanvasElement,
  detections: ComponentDetection[],
  options?: {
    lineWidth?: number
    strokeStyle?: string
    fillStyle?: string
    font?: string
  }
): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const lineWidth = options?.lineWidth ?? 2
  const strokeStyle = options?.strokeStyle ?? '#00FFFF'
  const fillStyle = options?.fillStyle ?? '#00FFFF'
  const font = options?.font ?? '12px Arial'
  
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = strokeStyle
  ctx.font = font
  ctx.fillStyle = fillStyle
  
  for (const detection of detections) {
    const { bbox } = detection
    
    // Draw bounding box
    ctx.strokeRect(bbox.x, bbox.y, bbox.width, bbox.height)
    
    // Draw label
    const label = `${detection.label} (${(detection.confidence * 100).toFixed(1)}%)`
    const textMetrics = ctx.measureText(label)
    const textHeight = 16
    
    ctx.fillStyle = strokeStyle
    ctx.fillRect(bbox.x, bbox.y - textHeight, textMetrics.width + 4, textHeight)
    
    ctx.fillStyle = '#000000'
    ctx.fillText(label, bbox.x + 2, bbox.y - 4)
  }
}

/**
 * Dispose of model to free memory
 */
export function disposeModel(): void {
  if (modelInstance) {
    modelInstance.dispose()
    modelInstance = null
  }
}
