/**
 * shared/types/vision.ts
 * Vision and detection related types
 */

export interface DetectionResult {
  id: string
  label: string
  confidence: number
  bbox: BoundingBox
  timestamp: number
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface OcrResult {
  text: string
  confidence: number
  bbox: BoundingBox
  language?: string
}

export interface ComponentMatch {
  refDes: string // reference designator (R1, C5, U10)
  partNumber?: string
  marking?: string
  confidence: number
  bbox: BoundingBox
}

export interface QualityMetrics {
  blurScore: number // 0-1, higher is sharper
  motionScore: number // 0-1, lower is less motion
  exposureQuality: number // 0-1
  timestamp: number
}

export interface FrameData {
  imageData: Uint8ClampedArray
  width: number
  height: number
  timestamp: number
  quality: QualityMetrics
}

export interface StitchFrame {
  id: string
  frameIndex: number
  imageUrl: string
  keypoints: Keypoint[]
  transform: Transform
  quality: QualityMetrics
}

export interface Keypoint {
  x: number
  y: number
  angle: number
  size: number
  descriptor: number[]
}

export interface Transform {
  a: number // scale x / rotation
  b: number
  c: number
  d: number // scale y / rotation
  e: number // translate x
  f: number // translate y
}

export interface BoardIdResult {
  boardId: string
  confidence: number
  bounds: BoundingBox
  rawText: string
}
