'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { CameraView } from '@/components/camera/CameraView'
import { useOCR } from '@/lib/vision/useOCR'
import { useComponentDetection } from '@/lib/vision/useComponentDetection'

export default function FindModePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [highlightBox, setHighlightBox] = useState<any>(null)
  const [ocrEnabled, setOcrEnabled] = useState(false)
  const [processingStatus, setProcessingStatus] = useState('Initializing...')
  
  // Use OCR hook
  const { words, isProcessing: isOcrProcessing, error: ocrError, processFrame } = useOCR({
    enabled: ocrEnabled,
    language: 'eng',
    throttle: 300,
  })

  // Use component detection hook
  const {
    matchedComponent,
    nearbyComponents,
    reset: resetDetection,
  } = useComponentDetection({
    searchQuery,
    ocrWords: words,
    confidenceThreshold: 0.3,
    stabilizationFrames: 5,
  })

  // Update UI with matched component
  useEffect(() => {
    if (matchedComponent && matchedComponent.isMatch) {
      setHighlightBox(matchedComponent)
    }
  }, [matchedComponent])

  // Update processing status
  useEffect(() => {
    if (!isScanning) {
      setProcessingStatus('Idle')
    } else if (isOcrProcessing) {
      setProcessingStatus(`Processing... (${words.length} labels detected)`)
    } else if (matchedComponent?.isMatch) {
      setProcessingStatus('Match found!')
    } else if (words.length > 0) {
      setProcessingStatus(`Found ${words.length} labels`)
    } else {
      setProcessingStatus('Scanning...')
    }
  }, [isScanning, isOcrProcessing, words.length, matchedComponent])

  const handleFrameCapture = useCallback(
    (canvas: HTMLCanvasElement) => {
      if (!isScanning || !searchQuery) return
      processFrame(canvas)
    },
    [isScanning, searchQuery, processFrame]
  )

  const startScanning = () => {
    if (!searchQuery.trim()) {
      alert('Please enter a reference designator or part number')
      return
    }
    setIsScanning(true)
    setOcrEnabled(true)
    setHighlightBox(null)
    resetDetection()
    setProcessingStatus('Starting scan...')
  }

  const stopScanning = () => {
    setIsScanning(false)
    setOcrEnabled(false)
    setHighlightBox(null)
    resetDetection()
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900 bg-opacity-50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400">Find Mode</h1>
            <p className="text-gray-400 text-sm">Locate components by reference designator or part number</p>
          </div>
          <Link href="/" className="text-gray-400 hover:text-white">
            ← Back
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Search Panel */}
          <div className="card col-span-1">
            <h2 className="text-lg font-semibold mb-4">Search</h2>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">
                Reference Designator or Part Number
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                placeholder="e.g., R120, U7, C33"
                className="input-field"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isScanning) {
                    startScanning()
                  }
                }}
              />
            </div>

            <div className="flex gap-2">
              {!isScanning ? (
                <button
                  onClick={startScanning}
                  className="flex-1 btn-primary"
                >
                  Start Scanning
                </button>
              ) : (
                <button
                  onClick={stopScanning}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors"
                >
                  Stop Scanning
                </button>
              )}
            </div>

            {/* Status & Results */}
            <div className="mt-6 pt-6 border-t border-gray-700">
              <h3 className="text-sm font-medium mb-3">Status</h3>
              <div className="flex items-center gap-2 text-sm">
                {isScanning ? (
                  <div className="flex items-center gap-2 text-cyan-400">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-gray-400">
                    <div className="w-2 h-2 bg-gray-500 rounded-full" />
                  </div>
                )}
                <span>{processingStatus}</span>
              </div>

              {ocrError && (
                <div className="mt-3 p-2 bg-red-500 bg-opacity-10 border border-red-500 rounded text-xs text-red-400">
                  {ocrError}
                </div>
              )}

              {highlightBox && (
                <div className="mt-4 p-3 bg-cyan-500 bg-opacity-10 border border-cyan-500 rounded">
                  <p className="text-sm font-semibold text-cyan-400">
                    ✓ Found: {highlightBox.label}
                  </p>
                  <p className="text-xs text-gray-300">
                    Confidence: {(highlightBox.confidence * 100).toFixed(1)}%
                  </p>
                </div>
              )}
            </div>

            {/* Nearby Labels */}
            {nearbyComponents.length > 0 && (
              <div className="mt-6 pt-6 border-t border-gray-700">
                <h3 className="text-sm font-medium mb-3">
                  Nearby Components ({nearbyComponents.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {nearbyComponents.slice(0, 8).map((comp, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSearchQuery(comp.label)
                      }}
                      className={`p-2 rounded cursor-pointer text-xs transition-colors ${
                        comp.isMatch
                          ? 'bg-cyan-500 bg-opacity-20 border border-cyan-500 text-cyan-300'
                          : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                      }`}
                    >
                      <div className="font-semibold">{comp.label}</div>
                      <div className="text-gray-400">
                        {(comp.confidence * 100).toFixed(0)}% confidence
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Camera Feed */}
          <div className="col-span-1 lg:col-span-2">
            {isScanning ? (
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <CameraView
                  onFrame={handleFrameCapture}
                  width={640}
                  height={480}
                  facingMode="environment"
                />

                {/* Display all detected labels as small boxes */}
                {words.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none">
                    <svg
                      className="w-full h-full"
                      viewBox="0 0 640 480"
                      preserveAspectRatio="none"
                    >
                      {words.map((word, idx) => {
                        const isMatched =
                          matchedComponent?.label === word.text &&
                          matchedComponent?.isMatch
                        return (
                          <g key={idx}>
                            {/* Label box */}
                            <rect
                              x={word.bbox.x}
                              y={word.bbox.y}
                              width={word.bbox.width}
                              height={word.bbox.height}
                              fill="none"
                              stroke={
                                isMatched ? '#06b6d4' : '#6b7280'
                              }
                              strokeWidth={isMatched ? '3' : '1'}
                              className={isMatched ? 'animate-pulse' : ''}
                              opacity={
                                isMatched ? 1 : 0.5
                              }
                            />
                            {/* Label text */}
                            <text
                              x={word.bbox.x}
                              y={Math.max(word.bbox.y - 4, 14)}
                              fill={
                                isMatched ? '#06b6d4' : '#9ca3af'
                              }
                              fontSize="12"
                              fontWeight={isMatched ? 'bold' : 'normal'}
                              fontFamily="monospace"
                            >
                              {word.text}{' '}
                              {(word.confidence * 100).toFixed(0)}%
                            </text>
                          </g>
                        )
                      })}
                    </svg>
                  </div>
                )}

                {/* Main highlight overlay for matched component */}
                {highlightBox && (
                  <div className="absolute inset-0 pointer-events-none">
                    <svg
                      className="w-full h-full"
                      viewBox="0 0 640 480"
                      preserveAspectRatio="none"
                    >
                      <defs>
                        <style>{`
                          @keyframes pulse-glow {
                            0%, 100% { r: 3; opacity: 1; }
                            50% { r: 6; opacity: 0.5; }
                          }
                          .glow-circle {
                            animation: pulse-glow 2s ease-in-out infinite;
                          }
                        `}</style>
                      </defs>
                      {/* Primary highlight box */}
                      <rect
                        x={highlightBox.bbox.x}
                        y={highlightBox.bbox.y}
                        width={highlightBox.bbox.width}
                        height={highlightBox.bbox.height}
                        fill="none"
                        stroke="#06b6d4"
                        strokeWidth="4"
                        className="animate-pulse"
                      />
                      {/* Corner markers */}
                      {[
                        [0, 0],
                        [1, 0],
                        [0, 1],
                        [1, 1],
                      ].map((pos, i) => (
                        <circle
                          key={i}
                          cx={
                            highlightBox.bbox.x +
                            highlightBox.bbox.width * pos[0]
                          }
                          cy={
                            highlightBox.bbox.y +
                            highlightBox.bbox.height * pos[1]
                          }
                          r="3"
                          fill="#06b6d4"
                          className="glow-circle"
                        />
                      ))}
                      {/* Label text */}
                      <text
                        x={highlightBox.bbox.x}
                        y={
                          Math.max(
                            highlightBox.bbox.y - 12,
                            20
                          )
                        }
                        fill="#06b6d4"
                        fontSize="20"
                        fontWeight="bold"
                        fontFamily="monospace"
                        textAnchor="start"
                      >
                        {highlightBox.label} ✓
                      </text>
                    </svg>
                  </div>
                )}

                {/* HUD Info */}
                <div className="absolute top-4 left-4 right-4 bg-black bg-opacity-60 backdrop-blur p-4 rounded-lg border border-cyan-500 border-opacity-30">
                  <p className="text-cyan-400 font-semibold">
                    Searching for: <span className="text-white">{searchQuery}</span>
                  </p>
                  <p className="text-gray-300 text-sm mt-1">
                    {highlightBox
                      ? '✓ Component located'
                      : 'Move the camera to locate the component'}
                  </p>
                </div>

                {/* Processing indicator */}
                <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 backdrop-blur px-3 py-2 rounded text-xs text-gray-300 border border-gray-600">
                  {isOcrProcessing ? (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                      Processing frame...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                      Ready
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-800 rounded-lg aspect-video flex flex-col items-center justify-center border border-gray-700 gap-4">
                <div className="text-center">
                  <p className="text-gray-400 text-lg">Enter a reference designator and start scanning</p>
                  <p className="text-gray-500 text-sm mt-2">e.g., R120, U10, C5, D2</p>
                </div>
                <div className="flex gap-2 text-xs text-gray-400">
                  <span>📌 Reference designators (R, C, U, D, etc.)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
