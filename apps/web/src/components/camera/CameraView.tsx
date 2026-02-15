'use client'

import { useEffect, useRef, useState } from 'react'

interface CameraViewProps {
  onFrame?: (canvas: HTMLCanvasElement) => void
  onError?: (error: Error) => void
  width?: number
  height?: number
  facingMode?: 'user' | 'environment'
}

export function CameraView({
  onFrame,
  onError,
  width = 640,
  height = 480,
  facingMode = 'environment',
}: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationRef = useRef<number | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Early return if not on client
    if (typeof window === 'undefined') return

    const startCamera = async () => {
      try {
        // Check if getUserMedia is available
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Camera API not available. Please use HTTPS and a modern browser.')
        }

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

          // Start frame capture loop
          const captureFrame = () => {
            if (videoRef.current && canvasRef.current) {
              const ctx = canvasRef.current.getContext('2d')
              if (ctx) {
                ctx.drawImage(videoRef.current, 0, 0, width, height)
                onFrame?.(canvasRef.current)
              }
            }
            animationRef.current = requestAnimationFrame(captureFrame)
          }
          captureFrame()
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error('Camera error:', error.message)
        setError(error.message)
        onError?.(error)
      }
    }

    startCamera()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [facingMode, height, onError, onFrame, width])

  const toggleTorch = async () => {
    if (!streamRef.current) return

    try {
      const track = streamRef.current.getVideoTracks()[0]
      const capabilities = track.getCapabilities() as any
      const settings = track.getSettings() as any

      if (capabilities.torch) {
        await track.applyConstraints({
          advanced: [{ torch: !settings.torch } as any],
        })
      }
    } catch (err) {
      console.error('Failed to toggle torch:', err)
    }
  }

  const stopCamera = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    setIsActive(false)
  }

  return (
    <div className="relative w-full bg-black rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className="w-full h-auto bg-black"
        style={{ maxHeight: '80vh' }}
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="hidden"
      />

      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-70">
          <p className="text-white text-center px-4">{error}</p>
        </div>
      )}

      {isActive && (
        <div className="absolute bottom-4 right-4 flex gap-2">
          <button
            onClick={toggleTorch}
            className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full"
            title="Toggle flashlight"
          >
            💡
          </button>
          <button
            onClick={stopCamera}
            className="p-2 bg-red-600 hover:bg-red-700 rounded-full"
            title="Stop camera"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
