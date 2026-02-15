/**
 * apps/web/src/lib/api/client.ts
 * API client for backend communication
 */

import axios, { AxiosInstance } from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  // Board endpoints
  async listBoards() {
    const response = await this.client.get('/api/boards')
    return response.data
  }

  async getBoard(boardId: string) {
    const response = await this.client.get(`/api/boards/${boardId}`)
    return response.data
  }

  async createBoard(data: any) {
    const response = await this.client.post('/api/boards', data)
    return response.data
  }

  async updateBoard(boardId: string, data: any) {
    const response = await this.client.put(`/api/boards/${boardId}`, data)
    return response.data
  }

  async deleteBoard(boardId: string) {
    await this.client.delete(`/api/boards/${boardId}`)
  }

  async getSampleBoards() {
    const response = await this.client.get('/api/boards/samples/list')
    return response.data
  }

  // Upload endpoints
  async uploadImage(file: File, metadata: any = {}) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('metadata', JSON.stringify(metadata))

    const response = await this.client.post('/api/uploads/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async uploadBoardScan(
    boardId: string,
    imageUrl: string,
    side: 'front' | 'back',
    metadata: any = {}
  ) {
    const response = await this.client.post(`/api/boards/${boardId}/scans`, {
      imageUrl,
      side,
      metadata,
    })
    return response.data
  }

  // Inference endpoints
  async detectComponent(imageUrl: string) {
    const response = await this.client.post('/api/inference/detect', {
      imageUrl,
    })
    return response.data
  }

  async recognizeOcrFromFile(file: File | Blob) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.client.post('/api/inference/ocr', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async recognizeOcrFromUrl(imageUrl: string) {
    // Fetch the image and convert to blob
    try {
      const imageResponse = await fetch(imageUrl)
      const blob = await imageResponse.blob()
      return this.recognizeOcrFromFile(blob)
    } catch (error) {
      console.error('Failed to fetch image for OCR:', error)
      throw error
    }
  }

  async detectComponentsFromFile(file: File | Blob) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.client.post('/api/inference/detect', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async detectComponentsFromUrl(imageUrl: string) {
    // Fetch the image and convert to blob
    try {
      const imageResponse = await fetch(imageUrl)
      const blob = await imageResponse.blob()
      return this.detectComponentsFromFile(blob)
    } catch (error) {
      console.error('Failed to fetch image for component detection:', error)
      throw error
    }
  }

  async recognizeOcr(imageUrl: string) {
    return this.recognizeOcrFromUrl(imageUrl)
  }

  async extractBoardId(imageUrl: string) {
    const response = await this.client.post('/api/inference/board-id', {
      imageUrl,
    })
    return response.data
  }

  async enhanceTraces(file: File | Blob) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.client.post('/api/traces/enhance', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      responseType: 'blob', // Important: we expect an image back
    })
    return response.data
  }

  async enhanceTracesFromUrl(imageUrl: string) {
    try {
      const imageResponse = await fetch(imageUrl)
      const blob = await imageResponse.blob()
      return this.enhanceTraces(blob)
    } catch (error) {
      console.error('Failed to fetch image for trace enhancement:', error)
      throw error
    }
  }

  async enhanceTracesWithStages(file: File | Blob) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.client.post('/api/traces/enhance-with-stages', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async enhanceTracesWithStagesFromUrl(imageUrl: string) {
    try {
      const imageResponse = await fetch(imageUrl)
      const blob = await imageResponse.blob()
      return this.enhanceTracesWithStages(blob)
    } catch (error) {
      console.error('Failed to fetch image for trace enhancement with stages:', error)
      throw error
    }
  }

  async analyzeTraces(file: File | Blob) {
    const formData = new FormData()
    formData.append('file', file)

    const response = await this.client.post('/api/traces/analyze', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  }

  async analyzeTracesFromUrl(imageUrl: string) {
    try {
      const imageResponse = await fetch(imageUrl)
      const blob = await imageResponse.blob()
      return this.analyzeTraces(blob)
    } catch (error) {
      console.error('Failed to fetch image for trace analysis:', error)
      throw error
    }
  }

  // Annotation endpoints
  async getAnnotations(boardId: string, side: 'front' | 'back') {
    const response = await this.client.get(
      `/api/boards/${boardId}/annotations/${side}`
    )
    return response.data
  }

  async saveAnnotations(
    boardId: string,
    side: 'front' | 'back',
    annotations: any
  ) {
    const response = await this.client.post(
      `/api/boards/${boardId}/annotations/${side}`,
      annotations
    )
    return response.data
  }

  // Drawing Annotations (Canvas-based)
  async getDrawingAnnotations(boardId: string, side: 'front' | 'back') {
    try {
      const response = await this.client.get(
        `/api/boards/${boardId}/drawings/${side}`
      )
      return response.data
    } catch (error) {
      console.error('Failed to fetch drawing annotations:', error)
      return { annotations: [], found: false }
    }
  }

  async saveDrawingAnnotations(
    boardId: string,
    side: 'front' | 'back',
    annotations: any[]
  ) {
    try {
      const response = await this.client.post(
        `/api/boards/${boardId}/drawings/${side}`,
        {
          boardId,
          side,
          annotations,
        }
      )
      return response.data
    } catch (error) {
      console.error('Failed to save drawing annotations:', error)
      return { status: 'error', message: 'Failed to save' }
    }
  }

  async deleteDrawingAnnotations(boardId: string, side: 'front' | 'back') {
    try {
      const response = await this.client.delete(
        `/api/boards/${boardId}/drawings/${side}`
      )
      return response.data
    } catch (error) {
      console.error('Failed to delete drawing annotations:', error)
      return { status: 'error' }
    }
  }

  // Health check
  async health() {
    const response = await this.client.get('/health')
    return response.data
  }
}

export const apiClient = new ApiClient()
