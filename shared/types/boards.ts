/**
 * shared/types/boards.ts
 * Board record and storage types
 */

export interface BoardRecord {
  id: string
  boardId: string // e.g., "XXXX-XXXX-XXXX"
  deviceModel?: string // e.g., "MacBook Pro 13\" 2022"
  side: 'front' | 'back'
  imageUrl: string
  thumbnailUrl?: string
  createdAt: string
  createdBy?: string
  notes?: string
  metadata?: BoardMetadata
}

export interface BoardMetadata {
  manufacturer?: string
  boardRevision?: string
  scanDuration?: number // milliseconds
  totalFrames?: number
  stitchQuality?: number // 0-1
  coverage?: number // percentage of board scanned
}

export interface BoardSet {
  id: string
  deviceModel: string
  front?: BoardRecord
  back?: BoardRecord
  createdAt: string
  notes?: string
}

export interface BoardScan {
  boardSetId: string
  boardId: string
  side: 'front' | 'back'
  status: 'scanning' | 'stitching' | 'complete' | 'failed'
  progress?: number // 0-100
  framesCollected?: number
  estimatedQuality?: number // 0-1
}
