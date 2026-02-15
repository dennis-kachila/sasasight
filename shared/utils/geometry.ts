/**
 * shared/utils/geometry.ts
 * Geometry and math utilities
 */

export interface Point {
  x: number
  y: number
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface Transform {
  a: number // 2D transformation matrix
  b: number
  c: number
  d: number
  e: number
  f: number
}

/**
 * Calculate distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate angle between two points (in degrees)
 */
export function angle(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  return Math.atan2(dy, dx) * (180 / Math.PI)
}

/**
 * Apply 2D affine transformation to a point
 */
export function transformPoint(point: Point, transform: Transform): Point {
  return {
    x: transform.a * point.x + transform.c * point.y + transform.e,
    y: transform.b * point.x + transform.d * point.y + transform.f,
  }
}

/**
 * Compose two transformations
 */
export function composeTransforms(t1: Transform, t2: Transform): Transform {
  return {
    a: t1.a * t2.a + t1.c * t2.b,
    b: t1.b * t2.a + t1.d * t2.b,
    c: t1.a * t2.c + t1.c * t2.d,
    d: t1.b * t2.c + t1.d * t2.d,
    e: t1.a * t2.e + t1.c * t2.f + t1.e,
    f: t1.b * t2.e + t1.d * t2.f + t1.f,
  }
}

/**
 * Invert a 2D affine transformation
 */
export function invertTransform(t: Transform): Transform {
  const det = t.a * t.d - t.b * t.c
  if (Math.abs(det) < 1e-10) {
    return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
  }

  const invDet = 1 / det
  return {
    a: t.d * invDet,
    b: -t.b * invDet,
    c: -t.c * invDet,
    d: t.a * invDet,
    e: (t.c * t.f - t.d * t.e) * invDet,
    f: (t.b * t.e - t.a * t.f) * invDet,
  }
}

/**
 * Check if point is inside bounding box
 */
export function pointInBox(point: Point, box: BoundingBox): boolean {
  return (
    point.x >= box.x &&
    point.x <= box.x + box.width &&
    point.y >= box.y &&
    point.y <= box.y + box.height
  )
}

/**
 * Check if two bounding boxes intersect
 */
export function boxesIntersect(box1: BoundingBox, box2: BoundingBox): boolean {
  return !(
    box1.x + box1.width < box2.x ||
    box2.x + box2.width < box1.x ||
    box1.y + box1.height < box2.y ||
    box2.y + box2.height < box1.y
  )
}

/**
 * Get union of two bounding boxes
 */
export function unionBoxes(box1: BoundingBox, box2: BoundingBox): BoundingBox {
  const x = Math.min(box1.x, box2.x)
  const y = Math.min(box1.y, box2.y)
  const x2 = Math.max(box1.x + box1.width, box2.x + box2.width)
  const y2 = Math.max(box1.y + box1.height, box2.y + box2.height)

  return {
    x,
    y,
    width: x2 - x,
    height: y2 - y,
  }
}

/**
 * Get intersection of two bounding boxes
 */
export function intersectBoxes(box1: BoundingBox, box2: BoundingBox): BoundingBox | null {
  const x = Math.max(box1.x, box2.x)
  const y = Math.max(box1.y, box2.y)
  const x2 = Math.min(box1.x + box1.width, box2.x + box2.width)
  const y2 = Math.min(box1.y + box1.height, box2.y + box2.height)

  if (x2 < x || y2 < y) return null

  return {
    x,
    y,
    width: x2 - x,
    height: y2 - y,
  }
}
