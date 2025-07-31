/**
 * Mock Request module for testing
 */

import { vi } from 'vitest'

const Request = vi.fn().mockImplementation(async (config) => {
  const { url, params, responseType } = config
  
  // Mock different API endpoints
  if (url.includes('/createDownloadUrl/')) {
    return {
      data: 'mock_download_code_123'
    }
  }
  
  if (url.includes('/getChunkInfo/')) {
    return {
      data: {
        downloadCode: 'mock_download_code_123',
        fileName: 'test.txt',
        fileSize: 1024 * 1024, // 1MB
        totalChunks: 2,
        chunkSize: 512 * 1024
      }
    }
  }
  
  if (url.includes('/downloadChunk/')) {
    if (responseType === 'blob') {
      // Return a mock blob for chunk data
      return new Blob(['mock chunk data'], { type: 'application/octet-stream' })
    }
  }
  
  // Default response
  return {
    data: null
  }
})

export default Request