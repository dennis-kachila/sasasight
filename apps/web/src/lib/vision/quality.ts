/**
 * apps/web/src/lib/vision/quality.ts
 * Frame quality assessment utilities
 */

export interface QualityMetrics {
  blurScore: number
  motionScore: number
  exposureQuality: number
  timestamp: number
}

/**
 * Estimate blur using Laplacian variance
 * Higher value = sharper image
 */
export function estimateBlur(imageData: Uint8ClampedArray, _width: number, _height: number): number {
  // Simplified blur detection using edge detection
  let edgeCount = 0
  let maxDifference = 0

  for (let i = 0; i < imageData.length - 4; i += 4) {
    const brightnessCurrent = imageData[i] + imageData[i + 1] + imageData[i + 2]
    const brightnessNext = imageData[i + 4] + imageData[i + 5] + imageData[i + 6]
    const difference = Math.abs(brightnessNext - brightnessCurrent)

    if (difference > 30) {
      edgeCount++
    }
    maxDifference = Math.max(maxDifference, difference)
  }

  // Normalize to 0-1, where 1 is sharpest
  return Math.min(1, (edgeCount / (imageData.length / 4)) * 10)
}

/**
 * Estimate motion between two frames
 * Lower value = less motion
 */
export function estimateMotion(
  current: Uint8ClampedArray,
  previous: Uint8ClampedArray
): number {
  if (current.length !== previous.length) return 1

  let differences = 0
  for (let i = 0; i < current.length; i += 4) {
    const diff =
      Math.abs(current[i] - previous[i]) +
      Math.abs(current[i + 1] - previous[i + 1]) +
      Math.abs(current[i + 2] - previous[i + 2])

    if (diff > 10) {
      differences++
    }
  }

  // Normalize: 0 = no motion, 1 = high motion
  return Math.min(1, (differences / (current.length / 4)) * 5)
}

/**
 * Assess exposure quality
 * Checks if image is too dark or too bright
 */
export function assessExposure(imageData: Uint8ClampedArray): number {
  let totalBrightness = 0

  for (let i = 0; i < imageData.length; i += 4) {
    totalBrightness += (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3
  }

  const averageBrightness = totalBrightness / (imageData.length / 4)

  // Ideal brightness is around 128
  // Score: 1 = perfect exposure, 0 = poor exposure
  const deviation = Math.abs(averageBrightness - 128) / 128
  return Math.max(0, 1 - deviation)
}

/**
 * Calculate overall quality metrics for a frame
 */
export function getFrameQuality(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  previousFrame?: Uint8ClampedArray
): QualityMetrics {
  const blurScore = estimateBlur(imageData, width, height)
  const exposureQuality = assessExposure(imageData)
  const motionScore = previousFrame
    ? 1 - estimateMotion(imageData, previousFrame)
    : 0.5

  return {
    blurScore,
    motionScore,
    exposureQuality,
    timestamp: Date.now(),
  }
}
