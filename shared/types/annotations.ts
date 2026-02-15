/**
 * shared/types/annotations.ts
 * Annotation and drawing types for Study Mode
 */

export interface AnnotationLayer {
  id: string
  name: string
  visible: boolean
  objects: AnnotationObject[]
  color?: string
  opacity?: number
}

export interface AnnotationObject {
  id: string
  type: 'line' | 'arrow' | 'rect' | 'circle' | 'polygon' | 'text'
  points: Point[] // for lines, arrows, polygons
  text?: string // for text labels
  color: string
  strokeWidth: number
  opacity: number
  timestamp: number
  createdBy?: string
}

export interface Point {
  x: number
  y: number
}

export interface TextLabel extends AnnotationObject {
  type: 'text'
  fontSize: number
  fontFamily: string
  text: string
}

export interface RailTrace extends AnnotationLayer {
  name: 'railTrace'
  railType: '5V' | '3.3V' | 'VBAT' | 'GND' | 'custom'
  confidence?: number
  points: Point[]
}

export interface FaultMarkup extends AnnotationLayer {
  name: 'faultMarkup'
  faultType: 'short' | 'burn' | 'missing' | 'broken' | 'unknown'
  description: string
}

export interface AnnotationDocument {
  id: string
  boardId: string
  boardSetId?: string
  side: 'front' | 'back'
  layers: AnnotationLayer[]
  createdAt: string
  updatedAt: string
  createdBy?: string
  notes?: string
}

export interface DrawingToolState {
  activeTool: 'pen' | 'arrow' | 'rect' | 'circle' | 'text' | 'eraser' | 'none'
  color: string
  strokeWidth: number
  isDrawing: boolean
  startPoint?: Point
  currentPoints: Point[]
}

export type ToolType = 'pen' | 'arrow' | 'rect' | 'circle' | 'text' | 'eraser' | 'select'
