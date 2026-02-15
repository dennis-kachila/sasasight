'use client'

import { useCallback, useRef, useState } from 'react'
import { OCRWord } from './useOCR'
import {
  detectComponentsFromVideo,
  detectComponentsFromCanvas,
  extractReferenceDesignator,
  fuzzyMatchDesignator as fuzzyMatch,
  drawDetections,
  ComponentDetection,
} from './detector'

export interface DetectedComponent {
  label: string
  confidence: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
  isMatch: boolean // Whether this matches the search query
}

interface ComponentDetectionOptions {
  searchQuery: string
  ocrWords: OCRWord[]
  confidenceThreshold?: number
  stabilizationFrames?: number // Number of frames to average for smoothing
  enableMLDetection?: boolean // Enable TensorFlow.js detection
}

export function useComponentDetection(options: ComponentDetectionOptions) {
  const {
    searchQuery,
    ocrWords,
    confidenceThreshold = 0.5,
    stabilizationFrames = 3,
    enableMLDetection = false,
  } = options

  const historyRef = useRef<(DetectedComponent | null)[]>([])
  const [matchedComponent, setMatchedComponent] = useState<DetectedComponent | null>(null)
  const [mlDetections, setMlDetections] = useState<ComponentDetection[]>([])

  // Levenshtein distance for fuzzy matching
  const calculateLevenshtein = useCallback((str1: string, str2: string): number => {
    const a = str1.toLowerCase()
    const b = str2.toLowerCase()
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }
    return matrix[b.length][a.length]
  }, [])

  // Calculate similarity score (0 = different, 1 = identical)
  const calculateSimilarity = useCallback(
    (text: string, query: string): number => {
      if (!query || !text) return 0
      const distance = calculateLevenshtein(text, query)
      const maxLen = Math.max(text.length, query.length)
      return Math.max(0, 1 - distance / maxLen)
    },
    [calculateLevenshtein]
  )

  // Find matching component from OCR results
  const detectComponent = useCallback(() => {
    if (!searchQuery.trim() || ocrWords.length === 0) {
      return null
    }

    let bestMatch: DetectedComponent | null = null
    let bestSimilarity = 0

    // Find the best matching component based on OCR results
    ocrWords.forEach((word) => {
      if (word.confidence < confidenceThreshold) return

      const similarity = calculateSimilarity(word.text, searchQuery)

      // Consider both exact matches and close fuzzy matches
      if (similarity > bestSimilarity) {
        bestSimilarity = similarity
        bestMatch = {
          label: word.text,
          confidence: word.confidence,
          bbox: word.bbox,
          isMatch: similarity > 0.7, // 70% similarity threshold for a good match
        }
      }
    })

    return bestMatch
  }, [searchQuery, ocrWords, confidenceThreshold, calculateSimilarity])

  // Apply temporal smoothing to reduce flickering
  const getSmoothedResult = useCallback((): DetectedComponent | null => {
    const detected = detectComponent()

    // Add to history
    historyRef.current.push(detected)
    if (historyRef.current.length > stabilizationFrames) {
      historyRef.current.shift()
    }

    // Count consistent detections
    const validDetections = historyRef.current.filter(
      (d) => d !== null && d.isMatch
    ) as DetectedComponent[]

    // Return smoothed result if we have consistent detections
    if (validDetections.length >= Math.ceil(stabilizationFrames / 2)) {
      // Average the bounding boxes for smoother movement
      const avgBbox = {
        x: validDetections.reduce((sum, d) => sum + d.bbox.x, 0) / validDetections.length,
        y: validDetections.reduce((sum, d) => sum + d.bbox.y, 0) / validDetections.length,
        width:
          validDetections.reduce((sum, d) => sum + d.bbox.width, 0) /
          validDetections.length,
        height:
          validDetections.reduce((sum, d) => sum + d.bbox.height, 0) /
          validDetections.length,
      }

      const avgComponent: DetectedComponent = {
        label: validDetections[0].label,
        confidence:
          validDetections.reduce((sum, d) => sum + d.confidence, 0) /
          validDetections.length,
        bbox: avgBbox,
        isMatch: true,
      }

      return avgComponent
    }

    return null
  }, [detectComponent, stabilizationFrames])

  // Get nearby components for the UI
  const getNearbyComponents = useCallback((): DetectedComponent[] => {
    return ocrWords
      .filter((word) => word.confidence >= confidenceThreshold)
      .map((word) => ({
        label: word.text,
        confidence: word.confidence,
        bbox: word.bbox,
        isMatch: calculateSimilarity(word.text, searchQuery) > 0.7,
      }))
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10) // Top 10 nearby components
  }, [ocrWords, confidenceThreshold, searchQuery, calculateSimilarity])

  // ML-based detection from video frame
  const detectFromVideoML = useCallback(async (video: HTMLVideoElement) => {
    if (!enableMLDetection) return

    const detections = await detectComponentsFromVideo(video)
    setMlDetections(detections)
  }, [enableMLDetection])

  // ML-based detection from canvas
  const detectFromCanvasML = useCallback(async (canvas: HTMLCanvasElement) => {
    if (!enableMLDetection) return

    const detections = await detectComponentsFromCanvas(canvas)
    setMlDetections(detections)
  }, [enableMLDetection])

  // Draw ML detections on canvas
  const drawMLDetections = useCallback(
    (canvas: HTMLCanvasElement) => {
      drawDetections(canvas, mlDetections, {
        lineWidth: 2,
        strokeStyle: '#FF00FF',
        fillStyle: '#FF00FF',
      })
    },
    [mlDetections]
  )

  const smoothedComponent = getSmoothedResult()
  if (smoothedComponent && matchedComponent !== smoothedComponent) {
    setMatchedComponent(smoothedComponent)
  }

  return {
    matchedComponent,
    nearbyComponents: getNearbyComponents(),
    mlDetections,
    detectFromVideoML,
    detectFromCanvasML,
    drawMLDetections,
    extractRefDes: extractReferenceDesignator,
    fuzzyMatch,
    reset: () => {
      historyRef.current = []
      setMatchedComponent(null)
      setMlDetections([])    },
  }
}