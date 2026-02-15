/**
 * apps/web/src/lib/camera/useCamera.ts
 * React hook for managing camera access
 */

import { useEffect, useRef, useState, useCallback } from 'react'

export interface UseCameraOptions {
  facingMode?: 'user' | 'environment'
  width?: number
  height?: number
}

export function useCamera(options: UseCameraOptions = {}) {
  const {
    facingMode = 'environment',
    width = 640,
    height = 480,
  } = options

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [isClient, setIsClient] = useState(false)

  // Ensure we're on client before accessing navigator
  useEffect(() => {
    setIsClient(true)
  }, [])

  const startCamera = useCallback(async () => {
    // Check if we're on client and navigator is available
    if (typeof window === 'undefined' || !navigator?.mediaDevices?.getUserMedia) {
      const error = new Error('Camera API not available. Please ensure you are using a modern browser.')
      setError(error)
      setIsActive(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: width },
          height: { ideal: height },
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setIsActive(true)
        setError(null)
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setIsActive(false)
      console.error('Camera error:', error.message)
    }
  }, [facingMode, height, width])

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    setIsActive(false)
  }, [])

  const toggleTorch = useCallback(async () => {
    if (!streamRef.current) return

    try {
      const track = streamRef.current.getVideoTracks()[0]
      const capabilities = track.getCapabilities() as any
      const settings = track.getSettings() as any

      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: !settings.torch } as any],
        })
        return !settings.torch
      }
    } catch (err) {
      console.error('Failed to toggle torch:', err)
    }
    return false
  }, [])

  useEffect(() => {
    if (!isClient) return
    
    startCamera()
    return () => stopCamera()
  }, [isClient, startCamera, stopCamera])

  return {
    videoRef,
    isActive,
    error,
    startCamera,
    stopCamera,
    toggleTorch,
  }
}
