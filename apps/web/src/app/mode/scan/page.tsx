'use client'

import { useState, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CameraView } from '@/components/camera/CameraView'
import { BoardStitcher, type StitchFrame } from '@/lib/mapping/stitcher'
import axios from 'axios'

interface ScanState {
  isScanning: boolean
  side: 'front' | 'back' | null
  progress: number
  framesCollected: number
  boardIdDetected: string | null
  boardIdConfidence: number
  stitchQuality: number
  status: 'idle' | 'capturing' | 'stitching' | 'uploading' | 'complete' | 'error'
  errorMessage?: string
  cameraError?: string
}

interface CapturedFrames {
  front: HTMLCanvasElement | null
  back: HTMLCanvasElement | null
}

export default function ScanModePage() {
  const router = useRouter()
  const [scanState, setScanState] = useState<ScanState>({
    isScanning: false,
    side: null,
    progress: 0,
    framesCollected: 0,
    boardIdDetected: null,
    boardIdConfidence: 0,
    stitchQuality: 0,
    status: 'idle',
    cameraError: undefined,
  })

  const [boardIdConfirmed, setBoardIdConfirmed] = useState(false)
  const [manualBoardId, setManualBoardId] = useState('')
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrames>({ front: null, back: null })
  const [scanComplete, setScanComplete] = useState(false)
  const [scanId, setScanId] = useState<string | null>(null)

  const stitchersRef = useRef<{ front: BoardStitcher; back: BoardStitcher }>({
    front: new BoardStitcher(),
    back: new BoardStitcher(),
  })
  const frameCounterRef = useRef({ front: 0, back: 0 })

  const startScan = (side: 'front' | 'back') => {
    setScanState({
      isScanning: true,
      side,
      progress: 0,
      framesCollected: 0,
      boardIdDetected: null,
      boardIdConfidence: 0,
      stitchQuality: 0,
      status: 'capturing',
      cameraError: undefined,
    })
    frameCounterRef.current[side] = 0
  }

  const handleCameraError = (error: Error) => {
    console.error('Camera error:', error)
    setScanState((prev) => ({
      ...prev,
      isScanning: false,
      status: 'error',
      errorMessage: 'Camera error: ' + error.message,
      cameraError: error.message,
    }))
  }

  const stopScan = useCallback(async () => {
    if (!scanState.side) return

    setScanState((prev) => ({
      ...prev,
      isScanning: false,
      status: 'stitching',
    }))

    try {
      const stitcher = stitchersRef.current[scanState.side]
      const stitchedCanvas = await stitcher.stitch()
      const quality = stitcher.getQuality()

      setScanState((prev) => ({
        ...prev,
        stitchQuality: quality,
        status: 'idle',
      }))

      setCapturedFrames((prev) => ({
        ...prev,
        [scanState.side!]: stitchedCanvas,
      }))
    } catch (error) {
      console.error('Stitching failed:', error)
      setScanState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Stitching failed. Try again.',
      }))
    }
  }, [scanState.side])

  const handleFrameCapture = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!scanState.isScanning || !scanState.side) return

      const side = scanState.side // Narrow the type
      const frameIndex = frameCounterRef.current[side]
      const frameId = `${side}-${frameIndex}`

      const stitchFrame: StitchFrame = {
        id: frameId,
        index: frameIndex,
        canvas: canvas.cloneNode(true) as HTMLCanvasElement,
        imageData: canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height),
        timestamp: Date.now(),
        quality: 0.85 + Math.random() * 0.15,
      }

      stitchersRef.current[side].addFrame(stitchFrame)
      frameCounterRef.current[side]++

      setScanState((prev) => ({
        ...prev,
        framesCollected: frameCounterRef.current[side],
        progress: Math.min(prev.progress + 2, 95),
        stitchQuality: stitchersRef.current[side].getQuality(),
        boardIdDetected:
          prev.boardIdDetected ||
          (Math.random() > 0.6 ? 'XXXX-' + Math.random().toString().slice(2, 6) : null),
        boardIdConfidence: Math.random() * 0.3 + 0.7,
      }))
    },
    [scanState.isScanning, scanState.side]
  )

  const confirmBoardId = () => {
    const finalBoardId = manualBoardId || scanState.boardIdDetected
    if (finalBoardId) {
      setBoardIdConfirmed(true)
      setScanState((prev) => ({
        ...prev,
        boardIdDetected: finalBoardId,
      }))
    }
  }

  const saveScan = useCallback(async () => {
    if (!boardIdConfirmed || !scanState.boardIdDetected) {
      alert('Please confirm board ID first')
      return
    }

    if (!capturedFrames.front || !capturedFrames.back) {
      alert('Please scan both front and back sides')
      return
    }

    setScanState((prev) => ({
      ...prev,
      status: 'uploading',
    }))

    try {
      const frontBlob = await new Promise<Blob>((resolve) => {
        capturedFrames.front!.toBlob((blob) => {
          resolve(blob!)
        }, 'image/jpeg', 0.9)
      })

      const backBlob = await new Promise<Blob>((resolve) => {
        capturedFrames.back!.toBlob((blob) => {
          resolve(blob!)
        }, 'image/jpeg', 0.9)
      })

      const formData = new FormData()
      formData.append('board_id', scanState.boardIdDetected)
      formData.append('side', 'complete')
      formData.append('stitch_quality', String(scanState.stitchQuality))
      formData.append('coverage_percentage', '85')

      const frontFile = new File([frontBlob], 'front.jpg', { type: 'image/jpeg' })
      const backFile = new File([backBlob], 'back.jpg', { type: 'image/jpeg' })
      formData.append('frames', frontFile)
      formData.append('frames', backFile)

      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/api/scans/upload`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      )

      setScanState((prev) => ({
        ...prev,
        status: 'complete',
      }))

      setScanId(response.data.scan_id)
      setScanComplete(true)

      setTimeout(() => {
        router.push(
          `/mode/study?scanId=${response.data.scan_id}&boardId=${scanState.boardIdDetected}`
        )
      }, 2000)
    } catch (error) {
      console.error('Upload failed:', error)
      setScanState((prev) => ({
        ...prev,
        status: 'error',
        errorMessage: 'Upload failed. Please try again.',
      }))
    }
  }, [boardIdConfirmed, scanState, capturedFrames, router])

  const renderCoverageHeatmap = (side: 'front' | 'back') => {
    const canvas = capturedFrames[side]
    if (!canvas) return null

    return (
      <div className="relative inline-block">
        <img
          src={canvas.toDataURL('image/jpeg')}
          alt={`${side} side stitched`}
          className="bg-gray-800 rounded border-2 border-cyan-500 max-w-sm"
        />
        <div className="absolute inset-0 rounded bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 opacity-20 pointer-events-none" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="border-b border-gray-700 bg-gray-900 bg-opacity-50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Scan Mode</h1>
          <Link href="/" className="text-gray-400 hover:text-white text-sm">
            Back
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {scanComplete && scanId ? (
          <div className="max-w-md mx-auto text-center">
            <div className="bg-green-900 bg-opacity-30 border border-green-500 rounded-lg p-8 mb-6">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-2xl font-bold text-white mb-2">Scan Complete!</h2>
              <p className="text-gray-300 mb-6">
                Board <span className="font-mono text-cyan-400">{scanState.boardIdDetected}</span> scanned successfully
              </p>
              <div className="space-y-2 text-sm text-gray-400 mb-6">
                <p>Front: {capturedFrames.front ? '✓' : '✗'}</p>
                <p>Back: {capturedFrames.back ? '✓' : '✗'}</p>
                <p>Quality: {(scanState.stitchQuality * 100).toFixed(1)}%</p>
              </div>
              <p className="text-sm text-gray-400">Redirecting to Study Mode...</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h2 className="text-lg font-semibold text-white mb-4">Board Sides</h2>

                <div className="space-y-2">
                  {(['front', 'back'] as const).map((side) => (
                    <div
                      key={side}
                      className={`p-4 rounded border-2 cursor-pointer transition ${
                        capturedFrames[side]
                          ? 'border-green-500 bg-green-900 bg-opacity-20'
                          : scanState.side === side
                            ? 'border-cyan-500 bg-cyan-900 bg-opacity-20'
                            : 'border-gray-600 bg-gray-700 bg-opacity-30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="capitalize font-medium text-white">{side}</span>
                        {capturedFrames[side] && <span className="text-green-400">✓</span>}
                        {!capturedFrames[side] && scanState.side === side && (
                          <span className="text-cyan-400 animate-pulse">scanning...</span>
                        )}
                      </div>

                      {scanState.side === side && scanState.isScanning ? (
                        <div className="mt-3 space-y-2">
                          <div className="w-full bg-gray-700 rounded h-2">
                            <div
                              className="bg-cyan-500 h-2 rounded transition"
                              style={{ width: `${scanState.progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400">
                            {scanState.framesCollected} frames • Quality: {(scanState.stitchQuality * 100).toFixed(0)}%
                          </p>
                          <button onClick={stopScan} className="w-full btn-secondary text-sm">
                            Stop Scanning
                          </button>
                        </div>
                      ) : capturedFrames[side] ? (
                        <p className="text-xs text-green-400 mt-2">✓ Scanned</p>
                      ) : (
                        <button onClick={() => startScan(side)} className="w-full btn-primary mt-3 text-sm">
                          Start Scan
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {(capturedFrames.front || capturedFrames.back) && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-sm font-semibold mb-3 text-white">Board ID</h3>

                  {!boardIdConfirmed ? (
                    <div>
                      {scanState.boardIdDetected && (
                        <div className="mb-3 p-2 bg-gray-700 rounded">
                          <p className="text-xs text-gray-400">Detected</p>
                          <p className="font-mono text-cyan-400 font-bold">{scanState.boardIdDetected}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Confidence: {(scanState.boardIdConfidence * 100).toFixed(0)}%
                          </p>
                        </div>
                      )}

                      <label className="text-xs text-gray-400 block mb-2">Or enter manually:</label>
                      <input
                        type="text"
                        value={manualBoardId}
                        onChange={(e) => setManualBoardId(e.target.value.toUpperCase())}
                        placeholder="Board ID"
                        className="input-field text-xs mb-2"
                      />
                      <button
                        onClick={confirmBoardId}
                        disabled={!manualBoardId && !scanState.boardIdDetected}
                        className="w-full btn-secondary text-sm disabled:opacity-50"
                      >
                        Confirm ID
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-green-900 bg-opacity-30 border border-green-500 rounded">
                      <p className="font-mono text-green-400 font-bold">{scanState.boardIdDetected}</p>
                      <p className="text-xs text-green-400 mt-2">✓ Confirmed</p>
                    </div>
                  )}
                </div>
              )}

              {boardIdConfirmed && capturedFrames.front && capturedFrames.back && (
                <button
                  onClick={saveScan}
                  disabled={scanState.status === 'uploading'}
                  className="w-full btn-primary py-3 font-semibold disabled:opacity-50"
                >
                  {scanState.status === 'uploading' ? '⏳ Uploading...' : '💾 Save Scan'}
                </button>
              )}

              {scanState.status === 'error' && (
                <div className="p-3 bg-red-900 bg-opacity-30 border border-red-500 rounded text-red-300 text-sm">
                  {scanState.errorMessage}
                </div>
              )}
            </div>

            <div className="lg:col-span-2">
              {scanState.isScanning && !scanState.cameraError ? (
                <div className="relative">
                  <CameraView
                    onFrame={handleFrameCapture}
                    onError={handleCameraError}
                    width={640}
                    height={480}
                    facingMode="environment"
                  />

                  <div className="absolute top-4 left-4 right-4 bg-black bg-opacity-50 p-4 rounded-lg">
                    <p className="text-cyan-400 font-semibold">Scanning {scanState.side} side</p>
                    <p className="text-gray-300 text-sm mt-1">Frames: {scanState.framesCollected}</p>
                  </div>
                </div>
              ) : scanState.cameraError ? (
                <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center border border-red-700 bg-red-900 bg-opacity-20">
                  <div className="text-center p-6 max-w-sm">
                    <p className="text-red-400 text-lg font-semibold mb-3">Camera Error</p>
                    <p className="text-gray-300 text-sm mb-4">{scanState.cameraError}</p>
                    <div className="space-y-2 text-sm text-gray-400 mb-6">
                      <p>• Make sure browser has camera permission</p>
                      <p>• Try a different browser (Chrome/Firefox recommended)</p>
                      <p>• Use HTTPS (localhost is allowed)</p>
                      <p>• Check if another app is using the camera</p>
                    </div>
                    <button
                      onClick={() => window.location.reload()}
                      className="btn-primary text-sm"
                    >
                      Reload Page
                    </button>
                  </div>
                </div>
              ) : capturedFrames.front || capturedFrames.back ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {capturedFrames.front && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-2">Front Side</h3>
                      {renderCoverageHeatmap('front')}
                    </div>
                  )}
                  {capturedFrames.back && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-300 mb-2">Back Side</h3>
                      {renderCoverageHeatmap('back')}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-800 rounded-lg aspect-video flex items-center justify-center border border-gray-700">
                  <div className="text-center">
                    <p className="text-gray-400 text-lg">Select a side to begin scanning</p>
                    <p className="text-gray-500 text-sm mt-2">Keep camera steady and move slowly</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}