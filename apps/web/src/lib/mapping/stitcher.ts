/**
 * apps/web/src/lib/mapping/stitcher.ts
 * Image stitching and board mapping logic
 * Implements frame compositing with overlap detection and blending
 */

export interface StitchFrame {
  id: string
  index: number
  canvas: HTMLCanvasElement
  imageData: ImageData
  timestamp: number
  quality: number  // 0-1 quality score
}

export interface OverlapRegion {
  frame1Id: string
  frame2Id: string
  x: number
  y: number
  width: number
  height: number
  confidence: number
}

export interface Transform {
  tx: number  // translation X
  ty: number  // translation Y
  scale: number
}

export class BoardStitcher {
  private frames: StitchFrame[] = []
  private composition: HTMLCanvasElement | null = null
  private transforms: Map<string, Transform> = new Map()
  private overlaps: OverlapRegion[] = []

  addFrame(frame: StitchFrame): void {
    // Validate frame quality
    if (frame.quality < 0.3) {
      console.warn(`Skipping low-quality frame (quality: ${frame.quality})`)
      return
    }
    this.frames.push(frame)
  }

  /**
   * Detect overlap between two adjacent frames using edge correlation
   */
  private detectOverlap(frame1: StitchFrame, frame2: StitchFrame): OverlapRegion | null {
    const canvas1 = frame1.canvas
    const canvas2 = frame2.canvas

    // Extract right edge of frame1 and left edge of frame2
    const rightEdge = this.extractVerticalEdge(canvas1, 'right', 60)
    const leftEdge = this.extractVerticalEdge(canvas2, 'left', 60)

    if (!rightEdge || !leftEdge) return null

    // Calculate correlation across different offsets
    let bestOffset = 0
    let bestScore = 0

    for (let offset = 0; offset < Math.min(rightEdge.length, leftEdge.length) - 20; offset++) {
      const score = this.correlateEdges(rightEdge, leftEdge, offset)
      if (score > bestScore) {
        bestScore = score
        bestOffset = offset
      }
    }

    // Require minimum correlation confidence
    if (bestScore < 0.5) return null

    return {
      frame1Id: frame1.id,
      frame2Id: frame2.id,
      x: canvas1.width - 60,
      y: bestOffset,
      width: 60,
      height: canvas1.height - Math.abs(bestOffset),
      confidence: bestScore,
    }
  }

  /**
   * Extract edge pixels from canvas for correlation analysis
   */
  private extractVerticalEdge(
    canvas: HTMLCanvasElement,
    side: 'left' | 'right',
    width: number
  ): Uint8ClampedArray | null {
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    const x = side === 'right' ? canvas.width - width : 0
    const edge = new Uint8ClampedArray(canvas.height * width)

    for (let y = 0; y < canvas.height; y++) {
      for (let px = 0; px < width; px++) {
        const idx = (y * canvas.width + x + px) * 4
        // Convert to grayscale
        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
        edge[y * width + px] = gray
      }
    }

    return edge
  }

  /**
   * Calculate correlation between two edge strips
   */
  private correlateEdges(
    edge1: Uint8ClampedArray,
    edge2: Uint8ClampedArray,
    offset: number
  ): number {
    let sum = 0
    let count = 0

    for (let i = 0; i < Math.min(edge1.length, edge2.length - offset); i++) {
      const diff = Math.abs(edge1[i] - edge2[i + offset])
      sum += 1 - diff / 255  // Normalize to 0-1
      count++
    }

    return count > 0 ? sum / count : 0
  }

  /**
   * Blend overlapping regions between two canvases
   */
  private blendFrames(
    ctx: CanvasRenderingContext2D,
    frame1: HTMLCanvasElement,
    frame2: HTMLCanvasElement,
    overlap: OverlapRegion,
    xOffset: number,
    yOffset: number
  ): void {
    // Draw first frame
    ctx.globalAlpha = 1.0
    ctx.drawImage(frame1, xOffset, yOffset)

    // Draw second frame with alpha blend in overlap region
    const overlapX = xOffset + overlap.x
    const overlapY = yOffset + overlap.y
    const blendWidth = overlap.width

    // Draw frame2 with gradient alpha for smooth blending
    ctx.save()
    ctx.globalAlpha = 0.5

    // Create gradient mask for smooth transition
    const gradient = ctx.createLinearGradient(overlapX, 0, overlapX + blendWidth, 0)
    gradient.addColorStop(0, 'rgba(0,0,0,0.3)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')

    ctx.fillStyle = gradient
    ctx.fillRect(overlapX, overlapY, blendWidth, overlap.height)

    // Draw second frame
    ctx.globalAlpha = 0.7
    ctx.drawImage(frame2, xOffset + frame1.width - overlap.width, yOffset + overlap.y)

    ctx.restore()
  }

  /**
   * Stitch all collected frames into a single panoramic image
   */
  async stitch(): Promise<HTMLCanvasElement> {
    if (this.frames.length === 0) {
      throw new Error('No frames to stitch')
    }

    if (this.frames.length === 1) {
      // Single frame - return as-is
      return this.frames[0].canvas
    }

    // Detect overlaps between adjacent frames
    this.overlaps = []
    for (let i = 0; i < this.frames.length - 1; i++) {
      const overlap = this.detectOverlap(this.frames[i], this.frames[i + 1])
      if (overlap) {
        this.overlaps.push(overlap)
      }
    }

    // Calculate composition size
    let totalWidth = this.frames[0].canvas.width
    let maxHeight = this.frames[0].canvas.height

    for (let i = 1; i < this.frames.length; i++) {
      const overlap = this.overlaps[i - 1]
      const overlapWidth = overlap ? overlap.width : 0
      const frameContribution = this.frames[i].canvas.width - overlapWidth * 0.5

      totalWidth += frameContribution
      maxHeight = Math.max(maxHeight, this.frames[i].canvas.height)
    }

    // Create composition canvas with padding
    const padding = 20
    const composition = document.createElement('canvas')
    composition.width = totalWidth + padding * 2
    composition.height = maxHeight + padding * 2

    const ctx = composition.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // Fill with white background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, composition.width, composition.height)

    // Draw frames with blending
    let currentX = padding

    for (let i = 0; i < this.frames.length; i++) {
      const frame = this.frames[i]
      const transform: Transform = {
        tx: currentX,
        ty: padding,
        scale: 1,
      }

      this.transforms.set(frame.id, transform)

      if (i === 0) {
        // First frame - draw directly
        ctx.drawImage(frame.canvas, currentX, padding)
        currentX += frame.canvas.width
      } else {
        // Subsequent frames - blend with previous
        const prevFrame = this.frames[i - 1]
        const overlap = this.overlaps[i - 1]

        if (overlap) {
          // Draw with blending in overlap region
          this.blendFrames(ctx, prevFrame.canvas, frame.canvas, overlap, currentX - prevFrame.canvas.width, padding)
          currentX += frame.canvas.width - overlap.width * 0.7
        } else {
          // No overlap detected, draw adjacent
          ctx.drawImage(frame.canvas, currentX, padding)
          currentX += frame.canvas.width
        }
      }
    }

    // Crop to actual content (remove excess white space)
    const cropped = this.cropToContent(composition)
    this.composition = cropped

    return cropped
  }

  /**
   * Crop canvas to remove white background
   */
  private cropToContent(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d')
    if (!ctx) return canvas

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data

    let minX = canvas.width
    let maxX = 0
    let minY = canvas.height
    let maxY = 0

    // Find bounds of non-white content
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const a = data[i + 3]

      // Check if pixel is not white and visible
      if (!(r > 240 && g > 240 && b > 240) || a > 200) {
        const pixelIndex = i / 4
        const y = Math.floor(pixelIndex / canvas.width)
        const x = pixelIndex % canvas.width

        minX = Math.min(minX, x)
        maxX = Math.max(maxX, x)
        minY = Math.min(minY, y)
        maxY = Math.max(maxY, y)
      }
    }

    // Add padding
    const padding = 10
    minX = Math.max(0, minX - padding)
    minY = Math.max(0, minY - padding)
    maxX = Math.min(canvas.width, maxX + padding)
    maxY = Math.min(canvas.height, maxY + padding)

    const croppedCanvas = document.createElement('canvas')
    croppedCanvas.width = maxX - minX
    croppedCanvas.height = maxY - minY

    const croppedCtx = croppedCanvas.getContext('2d')
    if (croppedCtx) {
      croppedCtx.drawImage(canvas, minX, minY, maxX - minX, maxY - minY, 0, 0, maxX - minX, maxY - minY)
    }

    return croppedCanvas
  }

  /**
   * Get the current stitched composition
   */
  getComposition(): HTMLCanvasElement | null {
    return this.composition
  }

  /**
   * Get stitching progress (0-100)
   */
  getProgress(): number {
    if (this.frames.length === 0) return 0
    // Estimate progress based on frame count and overlap quality
    const frameProgress = (this.frames.length / 20) * 60  // Max 60% for frames
    const overlapProgress = (this.overlaps.length / Math.max(1, this.frames.length - 1)) * 40  // Max 40% for overlaps
    return Math.min(100, frameProgress + overlapProgress)
  }

  /**
   * Get quality score of current stitch (0-1)
   */
  getQuality(): number {
    if (this.frames.length < 2) return 0

    // Quality based on: frame count, overlap confidence, and frame quality
    const frameScore = Math.min(1, this.frames.length / 20)
    const avgOverlapConfidence = this.overlaps.length > 0
      ? this.overlaps.reduce((sum, o) => sum + o.confidence, 0) / this.overlaps.length
      : 0
    const avgFrameQuality = this.frames.reduce((sum, f) => sum + f.quality, 0) / this.frames.length

    return (frameScore * 0.4) + (avgOverlapConfidence * 0.3) + (avgFrameQuality * 0.3)
  }

  /**
   * Get number of frames collected
   */
  getFrameCount(): number {
    return this.frames.length
  }

  /**
   * Get all collected frames
   */
  getFrames(): StitchFrame[] {
    return [...this.frames]
  }

  /**
   * Clear all frames and reset state
   */
  clear(): void {
    this.frames = []
    this.composition = null
    this.transforms.clear()
    this.overlaps = []
  }
}
