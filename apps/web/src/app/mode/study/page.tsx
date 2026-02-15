'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { apiClient } from '@/lib/api/client'

type ToolType = 'pen' | 'arrow' | 'rect' | 'circle' | 'text' | 'eraser' | 'select'

interface DrawingState {
  tool: ToolType
  color: string
  strokeWidth: number
  isDrawing: boolean
  startX: number
  startY: number
}

interface SampleBoard {
  id: string
  boardId: string
  deviceModel: string
  side: string
  imageUrl: string
  notes: string
}

interface LayerState {
  baseImageShown: boolean
  annotationsShown: boolean
  componentsShown: boolean
  ocrLabelsShown: boolean
}

export default function StudyModePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null)
  const minimapContainerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [drawing, setDrawing] = useState<DrawingState>({
    tool: 'pen',
    color: '#06b6d4',
    strokeWidth: 2,
    isDrawing: false,
    startX: 0,
    startY: 0,
  })
  const [sampleBoards, setSampleBoards] = useState<SampleBoard[]>([])
  const [selectedBoardId, setSelectedBoardId] = useState<string>('')
  const [imageLoading, setImageLoading] = useState(false)
  const [annotations, setAnnotations] = useState<any[]>([])
  const [currentStroke, setCurrentStroke] = useState<any>(null)
  const [layers, setLayers] = useState<LayerState>({
    baseImageShown: true,
    annotationsShown: true,
    componentsShown: true,
    ocrLabelsShown: true,
  })
  const [undoStack, setUndoStack] = useState<any[][]>([])
  const [redoStack, setRedoStack] = useState<any[][]>([])
  const [boardSide, setBoardSide] = useState<'front' | 'back'>('front')
  const [annotationsByBoard, setAnnotationsByBoard] = useState<{ [key: string]: any[] }>({})
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null)
  const [minimapDragging, setMinimapDragging] = useState(false)
  const [detectedComponents, setDetectedComponents] = useState<any[]>([])
  const [ocrLabels, setOcrLabels] = useState<any[]>([])
  const [processedImageStages, setProcessedImageStages] = useState<any[]>([])
  const [showProcessingPanel, setShowProcessingPanel] = useState(false)
  const [viewingStage, setViewingStage] = useState<any>(null)
  const boardKey = `${selectedBoardId}-${boardSide}`

  const colors = [
    '#06b6d4', // cyan
    '#ef4444', // red
    '#22c55e', // green
    '#eab308', // yellow
    '#a855f7', // purple
    '#ffffff', // white
  ]

  const tools: ToolType[] = ['pen', 'arrow', 'rect', 'circle', 'text', 'eraser']

  // Sync annotations with board-side key - MUST BE BEFORE useEffects
  const getCurrentAnnotations = () => annotationsByBoard[boardKey] || []

  const setCurrentAnnotations = (newAnnotations: any[]) => {
    setAnnotationsByBoard((prev) => ({
      ...prev,
      [boardKey]: newAnnotations,
    }))
    // Update main annotations state for redrawing
    setAnnotations(newAnnotations)
  }

  const addToUndoStack = (currentAnnotations: any[]) => {
    setUndoStack((prev) => [...prev, currentAnnotations])
    setRedoStack([])
  }

  const addToRedoStack = (annotationsToRedo: any[]) => {
    setRedoStack((prev) => [...prev, annotationsToRedo])
  }

  const handleUndo = () => {
    if (undoStack.length === 0) return

    const previousState = undoStack[undoStack.length - 1]
    addToRedoStack(getCurrentAnnotations())
    setUndoStack((prev) => prev.slice(0, -1))
    setCurrentAnnotations(previousState)
  }

  const handleRedo = () => {
    if (redoStack.length === 0) return

    const nextState = redoStack[redoStack.length - 1]
    addToUndoStack(getCurrentAnnotations())
    setRedoStack((prev) => prev.slice(0, -1))
    setCurrentAnnotations(nextState)
  }

  // Auto-save handler
  const handleAutoSave = async () => {
    if (!selectedBoardId) return
    try {
      setSaveStatus('saving')
      await apiClient.saveDrawingAnnotations(selectedBoardId, boardSide, getCurrentAnnotations())
      setSaveStatus('saved')
      setLastSavedTime(new Date())
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (error) {
      console.error('Auto-save failed:', error)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }

  // Manual save handler
  const handleExplicitSave = async () => {
    if (!selectedBoardId) {
      alert('Please select a board first')
      return
    }
    await handleAutoSave()
  }

  // Load saved annotations
  const handleLoadAnnotations = async () => {
    if (!selectedBoardId) {
      alert('Please select a board first')
      return
    }
    try {
      const result = await apiClient.getDrawingAnnotations(selectedBoardId, boardSide)
      if (result.found && result.annotations.length > 0) {
        setCurrentAnnotations(result.annotations)
        setUndoStack([])
        setRedoStack([])
        alert(`Loaded ${result.annotations.length} annotations`)
      } else {
        alert('No saved annotations found')
      }
    } catch (error) {
      console.error('Failed to load annotations:', error)
      alert('Failed to load annotations')
    }
  }

  // Auto-save annotations every 30 seconds
  useEffect(() => {
    const autoSaveInterval = setInterval(() => {
      if (getCurrentAnnotations().length > 0 && selectedBoardId) {
        handleAutoSave()
      }
    }, 30000)
    return () => clearInterval(autoSaveInterval)
  }, [selectedBoardId, boardSide])

  // Load sample boards on mount
  useEffect(() => {
    const loadSampleBoards = async () => {
      try {
        const data = await apiClient.getSampleBoards()
        setSampleBoards(data.samples || [])
        if (data.samples && data.samples.length > 0) {
          setSelectedBoardId(data.samples[0].id)
        }
      } catch (error) {
        console.error('Failed to load sample boards:', error)
      }
    }
    loadSampleBoards()
  }, [])

  // Redraw when annotations change - this ensures persisted drawings stay visible
  useEffect(() => {
    redrawAnnotations()
  }, [annotations, layers, detectedComponents, ocrLabels])

  // Handle board side changes (front/back toggle)
  useEffect(() => {
    const boardAnnotations = getCurrentAnnotations()
    setAnnotations(boardAnnotations)
  }, [boardSide, selectedBoardId])

  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
        e.preventDefault()
        handleRedo()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undoStack, redoStack])

  // Global minimap drag handling for smooth dragging
  useEffect(() => {
    if (!minimapDragging) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      navigateToMinimapPoint(e.clientX, e.clientY)
    }

    const handleGlobalMouseUp = () => {
      setMinimapDragging(false)
    }

    document.addEventListener('mousemove', handleGlobalMouseMove)
    document.addEventListener('mouseup', handleGlobalMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [minimapDragging, zoom, pan])

  // Load selected board image on canvas
  useEffect(() => {
    const selectedBoard = sampleBoards.find((b) => b.id === selectedBoardId)
    if (!selectedBoard) return

    setImageLoading(true)
    const canvas = canvasRef.current
    const annotationCanvas = annotationCanvasRef.current
    if (!canvas || !annotationCanvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      // Set canvas size to match image aspect ratio
      const maxWidth = 1200
      const maxHeight = 600
      let width = img.width
      let height = img.height

      if (width > maxWidth) {
        height = (maxWidth / width) * height
        width = maxWidth
      }
      if (height > maxHeight) {
        width = (maxHeight / height) * width
        height = maxHeight
      }

      canvas.width = width
      canvas.height = height
      annotationCanvas.width = width
      annotationCanvas.height = height

      // Only draw base image if layer is visible
      if (layers.baseImageShown) {
        ctx.drawImage(img, 0, 0, width, height)
      }
      setImageLoading(false)
      // Reset undo/redo when loading new board
      setUndoStack([])
      setRedoStack([])

      // Perform OCR detection asynchronously (don't block image loading)
      generateSampleComponentsAndOCR(width, height).catch(err => {
        console.error('OCR detection failed:', err)
      })
    }
    img.onerror = () => {
      console.error('Failed to load image:', selectedBoard.imageUrl)
      setImageLoading(false)
      // Draw error placeholder
      ctx.fillStyle = '#1a1a1a'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ff4444'
      ctx.font = '16px Arial'
      ctx.fillText('Failed to load image', 20, 30)
    }
    // Construct full URL with API base URL
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
    const fullUrl = selectedBoard.imageUrl.startsWith('http')
      ? selectedBoard.imageUrl
      : `${apiBaseUrl}${selectedBoard.imageUrl}`
    img.src = fullUrl
  }, [selectedBoardId, sampleBoards, layers.baseImageShown])

  const getCanvasCoordinates = (e: React.MouseEvent) => {
    const canvas = annotationCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const container = containerRef.current
    if (!container) return { x: 0, y: 0 }

    // Get the position of the container
    const containerRect = container.getBoundingClientRect()

    // Get mouse position relative to container
    const mouseX = e.clientX - containerRect.left
    const mouseY = e.clientY - containerRect.top

    // Get scroll offset
    const scrollX = container.scrollLeft
    const scrollY = container.scrollTop

    // Convert to canvas coordinates accounting for zoom and pan
    const x = (mouseX + scrollX) / zoom - pan.x
    const y = (mouseY + scrollY) / zoom - pan.y

    return { x, y }
  }

  const redrawAnnotations = () => {
    const canvas = annotationCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw annotations if enabled
    if (layers.annotationsShown) {
      annotations.forEach((ann) => {
        if (ann.tool === 'pen' && ann.points) {
          drawPenStroke(ctx, ann.points, ann.color, ann.strokeWidth)
        } else if (ann.tool === 'text') {
          drawTextStroke(ctx, ann.text, ann.startX, ann.startY, ann.color, ann.fontSize || 16)
        } else {
          drawShape(ctx, ann.tool, ann.startX, ann.startY, ann.endX, ann.endY, ann.color, ann.strokeWidth)
        }
      })
    }

    // Draw detected components if enabled
    if (layers.componentsShown) {
      detectedComponents.forEach((component) => {
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 2
        ctx.strokeRect(component.x, component.y, component.width, component.height)
        ctx.fillStyle = 'rgba(34, 197, 94, 0.1)'
        ctx.fillRect(component.x, component.y, component.width, component.height)

        // Draw component label
        ctx.fillStyle = '#22c55e'
        ctx.font = '12px Arial, sans-serif'
        ctx.fillText(component.label, component.x + 4, component.y - 4)
      })
    }

    // Draw OCR labels if enabled
    if (layers.ocrLabelsShown) {
      ocrLabels.forEach((label) => {
        ctx.fillStyle = '#eab308'
        ctx.font = 'bold 14px Arial, sans-serif'
        ctx.textBaseline = 'top'

        // Draw background for text
        const textMetrics = ctx.measureText(label.text)
        const textWidth = textMetrics.width
        ctx.fillStyle = 'rgba(234, 179, 8, 0.2)'
        ctx.fillRect(label.x - 2, label.y - 2, textWidth + 4, 18)

        // Draw text
        ctx.fillStyle = '#eab308'
        ctx.fillText(label.text, label.x, label.y)
      })
    }
  }

  const generateSampleComponentsAndOCR = async (_canvasWidth: number, _canvasHeight: number) => {
    // Call backend OCR to get real text detections
    const selectedBoard = sampleBoards.find((b) => b.id === selectedBoardId)
    if (!selectedBoard) return

    try {
      console.log('Starting OCR detection...')

      // Fetch image and convert to blob
      const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
      const fullUrl = selectedBoard.imageUrl.startsWith('http')
        ? selectedBoard.imageUrl
        : `${apiBaseUrl}${selectedBoard.imageUrl}`

      // Get OCR results from backend
      const ocrResponse = await apiClient.recognizeOcrFromUrl(fullUrl)

      console.log('OCR response:', JSON.stringify(ocrResponse, null, 2))
      console.log('Text regions array:', ocrResponse.text_regions)
      console.log('Total regions:', ocrResponse.total_regions)
      console.log('Algorithm:', ocrResponse.algorithm)
      console.log('Processed stages:', ocrResponse.processed_stages?.length || 0)

      // Store processed image stages
      if (ocrResponse.processed_stages && ocrResponse.processed_stages.length > 0) {
        setProcessedImageStages(ocrResponse.processed_stages)
        console.log('✅ Stored', ocrResponse.processed_stages.length, 'processing stages')
      }

      // Convert backend OCR results to our format
      const ocrLabels = ocrResponse.text_regions?.map((region: any) => ({
        x: region.bbox.x,
        y: region.bbox.y,
        text: region.text,
        confidence: region.confidence
      })) || []

      // Filter for component-like labels (R, C, U, etc.)
      const componentLabels = ocrLabels.filter((label: any) => {
        const text = label.text.toUpperCase()
        return /^[RCULQDJ]\d+/.test(text) // Match R123, C45, U7, etc.
      })

      // Create component detections from OCR
      const components = componentLabels.map((label: any) => ({
        x: label.x - 5,
        y: label.y - 5,
        width: 40,
        height: 30,
        label: label.text
      }))

      setDetectedComponents(components)
      setOcrLabels(ocrLabels)

      setDetectedComponents(components)
      setOcrLabels(ocrLabels)

      console.log(`✅ OCR detected ${ocrLabels.length} text regions, ${components.length} components`)

      // --- TRACE ENHANCEMENT INTEGRATION WITH STAGES ---
      try {
        console.log('Starting Trace Enhancement with Stages...')
        const traceResponse = await apiClient.enhanceTracesWithStagesFromUrl(fullUrl)

        if (traceResponse.processing_stages && Array.isArray(traceResponse.processing_stages)) {
          // Extract all trace processing stages
          const traceStages = traceResponse.processing_stages.map((stage: any, index: number) => ({
            label: stage.stage_name || `Trace Stage ${index + 1}`,
            description: stage.description || `Trace processing stage ${index + 1}`,
            image_base64: stage.image_base64 || stage.image,
            type: 'trace'
          }))

          console.log(`✅ Adding ${traceStages.length} trace stages to pipeline`)
          setProcessedImageStages(prev => [...prev, ...traceStages])

          // Also store trace statistics if available
          if (traceResponse.stats) {
            console.log('Trace pipeline stats:', JSON.stringify(traceResponse.stats, null, 2))
          }
        } else {
          console.warn('No processing stages in trace response:', traceResponse)
        }
      } catch (traceError) {
        console.error('❌ Failed to enhance traces with stages:', traceError)
        // Fallback to old trace enhancement method
        try {
          console.log('Falling back to legacy trace enhancement...')
          const traceBlob = await apiClient.enhanceTracesFromUrl(fullUrl)
          const reader = new FileReader()
          reader.readAsDataURL(traceBlob)
          reader.onloadend = () => {
            const base64data = reader.result as string
            const base64Content = base64data.split(',')[1]
            const traceStage = {
              label: "Trace Enhancement",
              description: "Motherboard traces isolated and highlighted with components suppressed.",
              image_base64: base64Content,
              type: 'trace'
            }
            setProcessedImageStages(prev => [...prev, traceStage])
            console.log('✅ Legacy trace enhancement added to pipeline')
          }
        } catch (legacyError) {
          console.error('❌ Legacy trace enhancement also failed:', legacyError)
        }
      }
      // -------------------------------------

    } catch (error) {
      console.error('❌ Failed to perform OCR:', error)

      // Fallback to sample data if backend fails
      const sampleComponents = [
        { x: 50, y: 80, width: 40, height: 30, label: 'R1' },
        { x: 120, y: 100, width: 35, height: 25, label: 'C1' },
        { x: 180, y: 60, width: 60, height: 40, label: 'U1' },
      ]
      const sampleOCRLabels = [
        { x: 60, y: 35, text: 'Sample Data (Backend Unavailable)' },
      ]
      setDetectedComponents(sampleComponents)
      setOcrLabels(sampleOCRLabels)
    }
  }

  const drawMinimap = () => {
    const miniCanvas = minimapCanvasRef.current
    const baseCanvas = canvasRef.current
    const container = containerRef.current

    if (!miniCanvas || !baseCanvas || !container) return

    const ctx = miniCanvas.getContext('2d')
    if (!ctx) return

    const MINIMAP_WIDTH = 120
    const MINIMAP_HEIGHT = 90
    miniCanvas.width = MINIMAP_WIDTH
    miniCanvas.height = MINIMAP_HEIGHT

    // Calculate scale ratio
    const scaleX = MINIMAP_WIDTH / baseCanvas.width
    const scaleY = MINIMAP_HEIGHT / baseCanvas.height

    // Draw base image as thumbnail
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT)

    // Draw scaled down base canvas
    try {
      ctx.drawImage(baseCanvas, 0, 0, baseCanvas.width, baseCanvas.height, 0, 0, MINIMAP_WIDTH, MINIMAP_HEIGHT)
    } catch (e) {
      // Canvas might not be ready
    }

    // Draw viewport rectangle (current view area)
    const containerRect = container.getBoundingClientRect()
    const viewWidth = containerRect.width / zoom
    const viewHeight = containerRect.height / zoom

    // Calculate viewport position on minimap
    const viewportX = Math.max(0, (-pan.x * scaleX))
    const viewportY = Math.max(0, (-pan.y * scaleY))
    const viewportWidth = Math.min(MINIMAP_WIDTH, (viewWidth / baseCanvas.width) * MINIMAP_WIDTH)
    const viewportHeight = Math.min(MINIMAP_HEIGHT, (viewHeight / baseCanvas.height) * MINIMAP_HEIGHT)

    // Draw red viewport rectangle
    ctx.strokeStyle = '#ef4444'
    ctx.lineWidth = 2
    ctx.strokeRect(viewportX, viewportY, viewportWidth, viewportHeight)

    // Fill with semi-transparent red overlay
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)'
    ctx.fillRect(viewportX, viewportY, viewportWidth, viewportHeight)
  }

  const navigateToMinimapPoint = (clientX: number, clientY: number) => {
    const miniCanvas = minimapCanvasRef.current
    const baseCanvas = canvasRef.current
    const container = containerRef.current

    if (!miniCanvas || !baseCanvas || !container) return

    const rect = miniCanvas.getBoundingClientRect()
    const clickX = clientX - rect.left
    const clickY = clientY - rect.top

    const MINIMAP_WIDTH = 120
    const MINIMAP_HEIGHT = 90

    // Clamp coordinates to minimap bounds
    const clampedX = Math.max(0, Math.min(MINIMAP_WIDTH, clickX))
    const clampedY = Math.max(0, Math.min(MINIMAP_HEIGHT, clickY))

    // Convert minimap coordinates to canvas coordinates
    const canvasX = (clampedX / MINIMAP_WIDTH) * baseCanvas.width
    const canvasY = (clampedY / MINIMAP_HEIGHT) * baseCanvas.height

    // Center the view on clicked position
    const containerRect = container.getBoundingClientRect()
    const centerX = canvasX - (containerRect.width / zoom) / 2
    const centerY = canvasY - (containerRect.height / zoom) / 2

    setPan({
      x: -centerX,
      y: -centerY,
    })
  }

  const handleMinimapMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setMinimapDragging(true)
    navigateToMinimapPoint(e.clientX, e.clientY)
  }

  const handleMinimapMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!minimapDragging) return
    navigateToMinimapPoint(e.clientX, e.clientY)
  }

  const handleMinimapMouseUp = () => {
    setMinimapDragging(false)
  }

  // Redraw minimap whenever zoom, pan, or canvas changes
  useEffect(() => {
    drawMinimap()
  }, [zoom, pan, selectedBoardId, annotations])

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoordinates(e)

    const newStroke = {
      tool: drawing.tool,
      startX: coords.x,
      startY: coords.y,
      endX: coords.x,
      endY: coords.y,
      color: drawing.color,
      strokeWidth: drawing.strokeWidth,
      points: drawing.tool === 'pen' ? [{ x: coords.x, y: coords.y }] : [],
    }

    setCurrentStroke(newStroke)
    setDrawing((prev) => ({
      ...prev,
      isDrawing: true,
      startX: coords.x,
      startY: coords.y,
    }))
  }

  const drawShape = (ctx: CanvasRenderingContext2D, tool: ToolType, startX: number, startY: number, endX: number, endY: number, color: string, width: number) => {
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    switch (tool) {
      case 'pen':
        // Pen strokes are handled separately in mouse move
        break

      case 'arrow': {
        const headlen = 15
        const angle = Math.atan2(endY - startY, endX - startX)
        ctx.beginPath()
        ctx.moveTo(startX, startY)
        ctx.lineTo(endX, endY)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(endX, endY)
        ctx.lineTo(endX - headlen * Math.cos(angle - Math.PI / 6), endY - headlen * Math.sin(angle - Math.PI / 6))
        ctx.moveTo(endX, endY)
        ctx.lineTo(endX - headlen * Math.cos(angle + Math.PI / 6), endY - headlen * Math.sin(angle + Math.PI / 6))
        ctx.stroke()
        break
      }

      case 'rect':
        ctx.strokeRect(startX, startY, endX - startX, endY - startY)
        break

      case 'circle': {
        const radius = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2))
        ctx.beginPath()
        ctx.arc(startX, startY, radius, 0, 2 * Math.PI)
        ctx.stroke()
        break
      }

      case 'text':
        // Text is handled separately
        break

      case 'eraser':
        ctx.clearRect(endX - width / 2, endY - width / 2, width, width)
        break

      default:
        break
    }
  }

  const drawTextStroke = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, fontSize: number = 16) => {
    ctx.fillStyle = color
    ctx.font = `${fontSize}px Arial, sans-serif`
    ctx.textBaseline = 'top'
    ctx.fillText(text, x, y)
  }

  const drawPenStroke = (ctx: CanvasRenderingContext2D, points: any[], color: string, width: number) => {
    if (points.length === 0) return

    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(points[0].x, points[0].y)

    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }

    ctx.stroke()
  }

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!drawing.isDrawing) return

    const canvas = annotationCanvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const coords = getCanvasCoordinates(e)

    // Update current stroke
    if (currentStroke) {
      if (drawing.tool === 'pen') {
        // Add point to pen stroke
        currentStroke.points.push({ x: coords.x, y: coords.y })
      } else {
        // Update end coordinates for other tools
        currentStroke.endX = coords.x
        currentStroke.endY = coords.y
      }
      setCurrentStroke({ ...currentStroke })
    }

    // Clear and redraw
    redrawAnnotations()

    // Draw current shape/stroke
    if (drawing.tool === 'pen') {
      if (currentStroke && currentStroke.points.length > 0) {
        drawPenStroke(ctx, currentStroke.points, drawing.color, drawing.strokeWidth)
      }
    } else {
      drawShape(ctx, drawing.tool, drawing.startX, drawing.startY, coords.x, coords.y, drawing.color, drawing.strokeWidth)
    }
  }

  const handleCanvasMouseUp = () => {
    if (!drawing.isDrawing || !currentStroke) return

    setDrawing((prev) => ({
      ...prev,
      isDrawing: false,
    }))

    // Handle text tool specially
    if (currentStroke.tool === 'text') {
      const text = prompt('Enter text:')
      if (text && text.trim()) {
        const newAnnotations = [
          ...getCurrentAnnotations(),
          {
            tool: 'text',
            startX: currentStroke.startX,
            startY: currentStroke.startY,
            text: text.trim(),
            color: drawing.color,
            fontSize: Math.max(12, drawing.strokeWidth * 4), // Scale font size with stroke width
          },
        ]
        addToUndoStack(getCurrentAnnotations())
        setCurrentAnnotations(newAnnotations)
      }
    } else if (currentStroke.tool === 'pen') {
      // For pen, save all points
      if (currentStroke.points.length > 1) {
        const newAnnotations = [...getCurrentAnnotations(), currentStroke]
        addToUndoStack(getCurrentAnnotations())
        setCurrentAnnotations(newAnnotations)
      }
    } else if (
      currentStroke.tool === 'arrow' ||
      currentStroke.tool === 'rect' ||
      currentStroke.tool === 'circle'
    ) {
      // For other shapes, check if they were actually drawn (not just a click)
      const distance = Math.sqrt(
        Math.pow(currentStroke.endX - currentStroke.startX, 2) +
        Math.pow(currentStroke.endY - currentStroke.startY, 2)
      )
      if (distance > 5) {
        // Only save if moved at least 5 pixels
        const newAnnotations = [...getCurrentAnnotations(), currentStroke]
        addToUndoStack(getCurrentAnnotations())
        setCurrentAnnotations(newAnnotations)
      }
    }

    setCurrentStroke(null)
    redrawAnnotations()
  }

  const handleZoom = (delta: number) => {
    setZoom((prev) => Math.max(0.5, Math.min(5, prev + delta)))
  }

  const handleFitToScreen = () => {
    const container = containerRef.current
    const baseCanvas = canvasRef.current

    if (!container || !baseCanvas) return

    // Get container dimensions (the visible area)
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight

    if (containerWidth <= 0 || containerHeight <= 0) return

    // Calculate zoom needed to fit the canvas
    const zoomX = containerWidth / baseCanvas.width
    const zoomY = containerHeight / baseCanvas.height
    const newZoom = Math.min(zoomX, zoomY, 1) // Don't zoom in beyond 1:1

    // Reset pan to origin (top-left)
    setPan({ x: 0, y: 0 })
    setZoom(newZoom)

    // Scroll container to top-left
    setTimeout(() => {
      container.scrollLeft = 0
      container.scrollTop = 0
    }, 0)
  }

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900 bg-opacity-50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-cyan-400">Study Mode</h1>
            <p className="text-gray-400 text-sm">Annotate and analyze board scans</p>
          </div>
          <Link href="/" className="text-gray-400 hover:text-white">
            ← Back
          </Link>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-200px)]">
          {/* Toolbar */}
          <div className="col-span-1 flex flex-col gap-4 overflow-y-auto">
            {/* Board Side Toggle */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Board Side</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setBoardSide('front')}
                  className={`p-2 rounded text-sm font-medium transition-colors ${boardSide === 'front'
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                >
                  Front
                </button>
                <button
                  onClick={() => setBoardSide('back')}
                  className={`p-2 rounded text-sm font-medium transition-colors ${boardSide === 'back'
                      ? 'bg-cyan-500 text-white'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                >
                  Back
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">Annotations saved separately</p>
            </div>

            {/* Sample Boards */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Sample Boards</h3>
              {imageLoading && (
                <p className="text-xs text-gray-400 mb-2">Loading...</p>
              )}
              <div className="space-y-2">
                {sampleBoards.map((board) => (
                  <button
                    key={board.id}
                    onClick={() => setSelectedBoardId(board.id)}
                    className={`w-full p-2 rounded text-sm text-left transition-colors ${selectedBoardId === board.id
                        ? 'bg-cyan-500 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      }`}
                  >
                    <div className="font-medium truncate">{board.deviceModel}</div>
                    <div className="text-xs opacity-75 truncate">{board.side}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Drawing Tools */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Tools</h3>
              <div className="grid grid-cols-2 gap-2">
                {tools.map((tool) => (
                  <button
                    key={tool}
                    onClick={() => setDrawing((prev) => ({ ...prev, tool }))}
                    className={`p-2 rounded text-sm font-medium transition-colors ${drawing.tool === tool
                        ? 'bg-cyan-500 text-white'
                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                      }`}
                  >
                    {tool === 'pen' && '✏️'}
                    {tool === 'arrow' && '→'}
                    {tool === 'rect' && '▭'}
                    {tool === 'circle' && '●'}
                    {tool === 'text' && 'T'}
                    {tool === 'eraser' && '⌫'}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Color</h3>
              <div className="grid grid-cols-3 gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setDrawing((prev) => ({ ...prev, color }))}
                    className={`w-full h-8 rounded border-2 ${drawing.color === color
                        ? 'border-white'
                        : 'border-gray-600'
                      }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            {/* Stroke Width */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Stroke Width</h3>
              <input
                type="range"
                min="1"
                max="20"
                value={drawing.strokeWidth}
                onChange={(e) =>
                  setDrawing((prev) => ({
                    ...prev,
                    strokeWidth: parseInt(e.target.value),
                  }))
                }
                className="w-full"
              />
              <p className="text-xs text-gray-400 mt-1">
                {drawing.strokeWidth}px
              </p>
            </div>

            {/* Zoom */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Zoom</h3>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => handleZoom(-0.2)}
                  className="flex-1 btn-secondary text-sm"
                >
                  −
                </button>
                <span className="flex-1 text-center text-sm py-2">
                  {(zoom * 100).toFixed(0)}%
                </span>
                <button
                  onClick={() => handleZoom(0.2)}
                  className="flex-1 btn-secondary text-sm"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleFitToScreen}
                className="w-full btn-secondary text-sm"
              >
                Fit
              </button>
            </div>

            {/* Undo / Redo */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">History</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length === 0}
                  className={`p-2 rounded text-sm font-medium transition-colors ${undoStack.length === 0
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                >
                  ↶ Undo
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className={`p-2 rounded text-sm font-medium transition-colors ${redoStack.length === 0
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                    }`}
                >
                  ↷ Redo
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Undo: {undoStack.length} · Redo: {redoStack.length}
              </p>
            </div>

            {/* Layers */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Layers</h3>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.baseImageShown}
                    onChange={(e) => setLayers((prev) => ({ ...prev, baseImageShown: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span>Base Image</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.annotationsShown}
                    onChange={(e) => setLayers((prev) => ({ ...prev, annotationsShown: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span>Annotations</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.componentsShown}
                    onChange={(e) => setLayers((prev) => ({ ...prev, componentsShown: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span>Components</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layers.ocrLabelsShown}
                    onChange={(e) => setLayers((prev) => ({ ...prev, ocrLabelsShown: e.target.checked }))}
                    className="w-4 h-4"
                  />
                  <span>OCR Labels</span>
                </label>
              </div>
            </div>

            {/* Image Processing Pipeline */}
            <div className="card">
              <h3 className="text-sm font-semibold mb-3">Processing Pipeline</h3>
              <button
                onClick={() => setShowProcessingPanel(!showProcessingPanel)}
                disabled={processedImageStages.length === 0}
                className="w-full btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🔬 View Stages ({processedImageStages.length})
              </button>
              {processedImageStages.length === 0 && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  Load a board to see processing stages
                </p>
              )}
            </div>

            {/* Export */}
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Storage</h3>
                {saveStatus === 'saved' && (
                  <span className="text-xs bg-green-900 text-green-200 px-2 py-1 rounded">✓ Saved</span>
                )}
                {saveStatus === 'saving' && (
                  <span className="text-xs bg-blue-900 text-blue-200 px-2 py-1 rounded">⟳ Saving...</span>
                )}
                {saveStatus === 'error' && (
                  <span className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded">✗ Error</span>
                )}
              </div>

              <button
                onClick={() => {
                  const bothCanvases = document.createElement('canvas')
                  const baseCanvas = canvasRef.current
                  const annotationCanvas = annotationCanvasRef.current
                  if (baseCanvas && annotationCanvas) {
                    bothCanvases.width = baseCanvas.width
                    bothCanvases.height = baseCanvas.height
                    const ctx = bothCanvases.getContext('2d')!
                    ctx.drawImage(baseCanvas, 0, 0)
                    ctx.drawImage(annotationCanvas, 0, 0)
                    const link = document.createElement('a')
                    link.href = bothCanvases.toDataURL('image/png')
                    link.download = `board-${boardSide}-${Date.now()}.png`
                    link.click()
                  }
                }}
                className="w-full btn-primary text-sm"
              >
                📥 Export PNG
              </button>

              <button
                onClick={handleExplicitSave}
                disabled={saveStatus === 'saving'}
                className="w-full btn-secondary text-sm mt-2 disabled:opacity-50"
              >
                ☁️ Save to Cloud
              </button>

              <button
                onClick={handleLoadAnnotations}
                className="w-full btn-secondary text-sm mt-2"
              >
                ⬇️ Load from Cloud
              </button>

              <button
                onClick={() => {
                  const data = JSON.stringify({
                    boardId: selectedBoardId,
                    side: boardSide,
                    annotations: getCurrentAnnotations(),
                    exportedAt: new Date().toISOString(),
                  }, null, 2)
                  const link = document.createElement('a')
                  link.href = 'data:text/json,' + encodeURIComponent(data)
                  link.download = `board-${boardSide}-annotations-${Date.now()}.json`
                  link.click()
                }}
                className="w-full btn-secondary text-sm mt-2"
              >
                💾 Export JSON
              </button>

              <button
                onClick={() => {
                  setCurrentAnnotations([])
                  setUndoStack([])
                  setRedoStack([])
                }}
                className="w-full btn-secondary text-sm mt-2"
              >
                🗑️ Clear All
              </button>

              {lastSavedTime && (
                <p className="text-xs text-gray-400 mt-2">
                  Last saved: {lastSavedTime.toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>

          {/* Canvas */}
          <div
            ref={containerRef}
            className="col-span-1 lg:col-span-3 bg-gray-800 rounded-lg border border-gray-700 overflow-hidden flex flex-col"
          >
            <div className="flex-1 overflow-auto relative">
              <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="absolute top-0 left-0"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  transformOrigin: 'top left',
                  cursor: 'default',
                }}
              />
              <canvas
                ref={annotationCanvasRef}
                width={800}
                height={600}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                className="absolute top-0 left-0 cursor-crosshair"
                style={{
                  transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                  transformOrigin: 'top left',
                  transition: drawing.isDrawing ? 'none' : 'transform 0.1s',
                }}
              />

              {/* Minimap */}
              <div
                ref={minimapContainerRef}
                className="absolute bottom-4 right-4 bg-black bg-opacity-80 p-2 rounded border border-gray-600 shadow-lg"
              >
                <p className="text-xs text-gray-400 mb-1 px-1 font-semibold">Minimap</p>
                <canvas
                  ref={minimapCanvasRef}
                  width={120}
                  height={90}
                  onMouseDown={handleMinimapMouseDown}
                  onMouseMove={handleMinimapMouseMove}
                  onMouseUp={handleMinimapMouseUp}
                  onMouseLeave={handleMinimapMouseUp}
                  className="border border-gray-700 rounded transition-colors bg-gray-900"
                  style={{
                    cursor: minimapDragging ? 'grabbing' : 'grab',
                    borderColor: minimapDragging ? '#ef4444' : '#374151',
                  }}
                  title="Click and drag to navigate"
                />
                <p className="text-xs text-gray-500 mt-1 px-1">
                  Zoom: {(zoom * 100).toFixed(0)}%
                </p>
              </div>
            </div>

            {/* Info Bar */}
            <div className="border-t border-gray-700 bg-gray-700 bg-opacity-50 px-4 py-2 flex justify-between text-xs text-gray-400">
              <span>Tool: {drawing.tool.toUpperCase()}</span>
              <span>Color: {drawing.color}</span>
              <span>Size: {drawing.strokeWidth}px</span>
            </div>
          </div>
        </div>

        {/* Image Processing Pipeline Panel */}
        {showProcessingPanel && processedImageStages.length > 0 && (
          <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-gray-700">
              {/* Header */}
              <div className="bg-gray-900 px-6 py-4 flex items-center justify-between border-b border-gray-700">
                <div>
                  <h2 className="text-xl font-bold text-white">🔬 Image Processing Pipeline</h2>
                  <p className="text-sm text-gray-400 mt-1">
                    Visualizing {processedImageStages.length} processing stages (OCR Enhancement + Trace Detection)
                  </p>
                </div>
                <button
                  onClick={() => setShowProcessingPanel(false)}
                  className="text-gray-400 hover:text-white transition-colors text-2xl leading-none"
                  title="Close"
                >
                  ×
                </button>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {processedImageStages.map((stage: any, index: number) => (
                    <div key={index} className="card border border-gray-700">
                      {/* Stage Label */}
                      <div className="mb-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="bg-cyan-600 text-white text-xs font-bold px-2 py-1 rounded">
                            STEP {index + 1}
                          </span>
                          <h3 className="text-lg font-bold text-white">
                            {stage.label}
                          </h3>
                        </div>
                        <p className="text-sm text-gray-400">
                          {stage.description}
                        </p>
                      </div>

                      {/* Image */}
                      <div
                        className="relative aspect-[4/3] bg-gray-900 rounded overflow-hidden border border-gray-700 cursor-pointer hover:border-cyan-500 transition-colors group"
                        onClick={() => setViewingStage(stage)}
                      >
                        <img
                          src={`data:image/jpeg;base64,${stage.image_base64}`}
                          alt={stage.label}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 text-sm font-semibold">
                            🔍 Click to view full size
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setViewingStage(stage)}
                          className="flex-1 btn-primary text-xs flex items-center justify-center gap-1"
                        >
                          👁️ View
                        </button>
                        <button
                          onClick={() => {
                            const link = document.createElement('a')
                            link.href = `data:image/jpeg;base64,${stage.image_base64}`
                            link.download = `step-${index + 1}-${stage.label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`
                            link.click()
                          }}
                          className="flex-1 btn-secondary text-xs flex items-center justify-center gap-1"
                        >
                          📥 Download
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pipeline Explanation */}
                <div className="mt-8 p-4 bg-gray-900 rounded border border-gray-700">
                  <h3 className="text-sm font-bold text-white mb-3">📚 Complete PCB Trace & Component Analysis Pipeline</h3>
                  <div className="text-sm text-gray-300 space-y-2">
                    <div className="bg-cyan-900 bg-opacity-30 p-3 rounded border border-cyan-700 mb-3">
                      <p className="text-xs text-cyan-200 font-bold">PREPROCESSING STAGES (Steps 1-11)</p>
                    </div>
                    <p>
                      <strong className="text-cyan-400">STEP 1 - Original:</strong> Raw PCB image baseline for all processing.
                    </p>
                    <p>
                      <strong className="text-cyan-400">STEP 2 - Grayscale:</strong> Removes color, focuses on intensity for trace/text detection.
                    </p>
                    <p>
                      <strong className="text-cyan-400">STEP 3 - Denoised:</strong> Bilateral filter removes noise while preserving sharp component edges.
                    </p>
                    <p>
                      <strong className="text-cyan-400">STEP 4 - Sharpened:</strong> Unsharp mask enhances trace edges for better visibility.
                    </p>
                    <p>
                      <strong className="text-cyan-400">STEP 5 - Enhanced:</strong> CLAHE improves contrast in dark/bright regions of PCB.
                    </p>
                    <p>
                      <strong className="text-cyan-400">STEP 6 - Smoothed:</strong> Gaussian blur removes fine noise before binarization.
                    </p>
                    <p>
                      <strong className="text-cyan-400">STEP 7 - Binary (Adaptive):</strong> Local thresholding separates traces from background.
                    </p>
                    <p>
                      <strong className="text-cyan-400">STEP 8 - Binary (Otsu):</strong> Global threshold method - compare with adaptive for best results.
                    </p>
                    <p>
                      <strong className="text-cyan-400">STEP 9 - Dilated:</strong> Thickens trace strokes to reconnect broken segments.
                    </p>
                    <p>
                      <strong className="text-cyan-400">STEP 10 - Eroded:</strong> Removes noise artifacts while preserving traces.
                    </p>
                    <p>
                      <strong className="text-cyan-400">STEP 11 - Final Cleaned:</strong> Morphological close→open for optimal OCR input.
                    </p>
                    
                    <div className="bg-green-900 bg-opacity-30 p-3 rounded border border-green-700 mt-4 mb-3">
                      <p className="text-xs text-green-200 font-bold">TRACE DETECTION STAGES (Steps 12-18)</p>
                    </div>
                    <p>
                      <strong className="text-green-400">STEP 12 - Canny Edges:</strong> Detects trace boundaries using edge detection (sharp intensity changes).
                    </p>
                    <p>
                      <strong className="text-green-400">STEP 13 - Trace Enhanced:</strong> Morphology enhances and connects detected trace segments.
                    </p>
                    <p>
                      <strong className="text-green-400">STEP 14 - Component Mask:</strong> HSV color detection identifies components (12 types: SMD, caps, resistors, ICs, etc).
                    </p>
                    <p>
                      <strong className="text-green-400">STEP 15 - Inpainted:</strong> Removes components and fills areas with board background using TELEA algorithm.
                    </p>
                    <p>
                      <strong className="text-green-400">STEP 16 - Trace Isolated:</strong> Pure trace map extracted independently of components.
                    </p>
                    <p>
                      <strong className="text-yellow-400">STEP 17 - Blue Trace Overlay:</strong> Detected traces highlighted in blue on original image - easy visualization!
                    </p>
                    <p>
                      <strong className="text-yellow-400">STEP 18 - Final Trace Map:</strong> Clean trace visualization with black traces on board background for circuit analysis.
                    </p>
                    
                    <div className="mt-4 p-3 bg-blue-900 bg-opacity-30 rounded border border-blue-700">
                      <p className="text-xs text-blue-200">
                        💡 <strong>PCB Analysis Tips:</strong><br/>
                        • Compare Canny Edges (Step 12) with binary methods to see different trace detection approaches<br/>
                        • Use Component Mask (Step 14) to verify component detection accuracy across 12 color types<br/>
                        • View Traces (Blue Overlay - Step 17) for easy trace identification<br/>
                        • Use Final Trace Map (Step 18) for circuit connectivity analysis<br/>
                        • Trace detection stages automatically extracted from /api/traces/enhance-with-stages endpoint
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Full-Size Image Viewer Modal */}
        {viewingStage && (
          <div
            className="fixed inset-0 bg-black bg-opacity-95 z-[60] flex items-center justify-center p-4"
            onClick={() => setViewingStage(null)}
          >
            <div className="relative max-w-[95vw] max-h-[95vh] flex flex-col">
              {/* Header */}
              <div className="bg-gray-900 px-4 py-3 rounded-t-lg flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="bg-cyan-600 text-white text-xs font-bold px-2 py-1 rounded">
                    STEP {processedImageStages.indexOf(viewingStage) + 1}
                  </span>
                  <div>
                    <h3 className="text-white font-bold">{viewingStage.label}</h3>
                    <p className="text-xs text-gray-400">{viewingStage.description}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setViewingStage(null)
                  }}
                  className="text-gray-400 hover:text-white transition-colors text-3xl leading-none px-2"
                  title="Close (or click anywhere)"
                >
                  ×
                </button>
              </div>

              {/* Full-Size Image */}
              <div className="bg-gray-900 rounded-b-lg overflow-hidden flex items-center justify-center">
                <img
                  src={`data:image/jpeg;base64,${viewingStage.image_base64}`}
                  alt={viewingStage.label}
                  className="max-w-full max-h-[85vh] object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Action Bar */}
              <div className="bg-gray-900 px-4 py-3 rounded-b-lg mt-2 flex gap-3 justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const currentIndex = processedImageStages.indexOf(viewingStage)
                    if (currentIndex > 0) {
                      setViewingStage(processedImageStages[currentIndex - 1])
                    }
                  }}
                  disabled={processedImageStages.indexOf(viewingStage) === 0}
                  className="btn-secondary text-sm px-4 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const link = document.createElement('a')
                    link.href = `data:image/jpeg;base64,${viewingStage.image_base64}`
                    const stepNum = processedImageStages.indexOf(viewingStage) + 1
                    link.download = `step-${stepNum}-${viewingStage.label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.jpg`
                    link.click()
                  }}
                  className="btn-primary text-sm px-6"
                >
                  📥 Download Full Size
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    const currentIndex = processedImageStages.indexOf(viewingStage)
                    if (currentIndex < processedImageStages.length - 1) {
                      setViewingStage(processedImageStages[currentIndex + 1])
                    }
                  }}
                  disabled={processedImageStages.indexOf(viewingStage) === processedImageStages.length - 1}
                  className="btn-secondary text-sm px-4 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
