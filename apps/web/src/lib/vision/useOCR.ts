'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Tesseract from 'tesseract.js'

export interface OCRWord {
  text: string
  confidence: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
}

interface UseOCROptions {
  enabled?: boolean
  language?: string
  throttle?: number // milliseconds between OCR runs
}

export function useOCR(options: UseOCROptions = {}) {
  const {
    enabled = true,
    language = 'eng',
    throttle = 500, // Don't run OCR too frequently to avoid lag
  } = options

  const [words, setWords] = useState<OCRWord[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Tesseract.Worker | null>(null)
  const lastProcessTimeRef = useRef(0)

  // Initialize Tesseract worker
  useEffect(() => {
    const initWorker = async () => {
      try {
        const worker = await Tesseract.createWorker() as any
        await worker.loadLanguage?.(language)
        await worker.initialize?.(language)
        workerRef.current = worker
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize OCR')
      }
    }

    if (enabled) {
      initWorker()
    }

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate()
      }
    }
  }, [enabled, language])

  const processFrame = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (!enabled || !workerRef.current || isProcessing) return

      // Throttle OCR processing
      const now = Date.now()
      if (now - lastProcessTimeRef.current < throttle) {
        return
      }
      lastProcessTimeRef.current = now

      try {
        setIsProcessing(true)
        setError(null)

        const result = await workerRef.current.recognize(canvas)
        const { data } = result

        // Extract words with confidence and bounding boxes
        const extractedWords: OCRWord[] = []
        if (data.words) {
          data.words.forEach((word) => {
            if (word.confidence > 0) {
              extractedWords.push({
                text: word.text,
                confidence: word.confidence / 100, // Convert to 0-1 range
                bbox: {
                  x: word.bbox.x0,
                  y: word.bbox.y0,
                  width: word.bbox.x1 - word.bbox.x0,
                  height: word.bbox.y1 - word.bbox.y0,
                },
              })
            }
          })
        }

        setWords(extractedWords)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'OCR processing failed')
      } finally {
        setIsProcessing(false)
      }
    },
    [enabled, isProcessing, throttle]
  )

  return {
    words,
    isProcessing,
    error,
    processFrame,
  }
}
