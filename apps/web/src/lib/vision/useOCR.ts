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

/**
 * useOCR Hook - Uses Tesseract.js Worker Pool for efficient, non-blocking OCR
 * Tesseract.js automatically uses Web Workers to avoid blocking the main thread
 */
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
  const initPromiseRef = useRef<Promise<void> | null>(null)

  // Initialize Tesseract worker (lazy initialization)
  const initWorker = useCallback(async () => {
    if (initPromiseRef.current) return initPromiseRef.current
    if (workerRef.current) return

    const promise = (async () => {
      try {
        // Tesseract.createWorker() automatically uses Web Workers
        const worker = await Tesseract.createWorker() as any
        await worker.loadLanguage?.(language)
        await worker.initialize?.(language)
        workerRef.current = worker
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize OCR')
        throw err
      }
    })()

    initPromiseRef.current = promise
    return promise
  }, [language])

  // Setup and cleanup
  useEffect(() => {
    if (!enabled) return

    if (typeof window !== 'undefined') {
      // Initialize worker when hook mounts
      initWorker().catch((err) => {
        console.error('Failed to initialize OCR worker:', err)
      })
    }

    return () => {
      if (workerRef.current) {
        try {
          workerRef.current.terminate()
        } catch (e) {
          // Ignore termination errors
        }
        workerRef.current = null
        initPromiseRef.current = null
      }
    }
  }, [enabled, initWorker])

  const processFrame = useCallback(
    async (canvas: HTMLCanvasElement) => {
      if (!enabled || isProcessing) return

      // Throttle OCR processing
      const now = Date.now()
      if (now - lastProcessTimeRef.current < throttle) {
        return
      }
      lastProcessTimeRef.current = now

      try {
        setIsProcessing(true)
        setError(null)

        // Ensure worker is initialized
        if (!workerRef.current) {
          await initWorker()
        }

        if (!workerRef.current) {
          throw new Error('OCR worker not available')
        }

        // Tesseract.js runs recognition in a Web Worker automatically
        // This doesn't block the main thread
        const result = await workerRef.current.recognize(canvas)
        const { data } = result

        // Extract words with confidence and bounding boxes
        const extractedWords: OCRWord[] = []
        if (data.words) {
          data.words.forEach((word: any) => {
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
    [enabled, isProcessing, throttle, initWorker]
  )

  return {
    words,
    isProcessing,
    error,
    processFrame,
  }
}
