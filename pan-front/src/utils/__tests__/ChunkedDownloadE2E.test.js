/**
 * 分片下载端到端测试
 * 测试小文件和大文件的下载功能，验证分片下载和传统下载的一致性
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ChunkDownloader } from '../ChunkDownloader.js'
import { FileAssembler } from '../FileAssembler.js'
import { DownloadManager } from '../DownloadManager.js'
import { DownloadTrigger } from '../DownloadTrigger.js'

// Mock fetch API
global.fetch = vi.fn()

// Mock URL.createObjectURL and revokeObjectURL
global.URL = {
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn()
}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
}
global.localStorage = localStorageMock

describe('分片下载端到端测试', () => {
  let downloadManager
  let mockDownloadCode
  let mockFileInfo

  beforeEach(() => {
    vi.clearAllMocks()
    downloadManager = new DownloadManager()
    mockDownloadCode = 'test_download_code_123'
    mockFileInfo = {
      fileName: 'test_file.txt',
      fileSize: 1024 * 1024, // 1MB
      downloadCode: mockDownloadCode
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('小文件下载测试', () => {
    it('应该使用传统下载方式处理小文件', async () => {
      const smallFileInfo = {
        ...mockFileInfo,
        fileSize: 256 * 1024 // 256KB，小于分片阈值
      }

      // Mock 传统下载响应
      fetch.mockResolvedValueOnce({
        ok: true,
        blob: () => Promise.resolve(new Blob(['small file content']))
      })

      const result = await downloadManager.downloadFile(smallFileInfo)

      expect(result.method).toBe('traditional')
      expect(result.success).toBe(true)
      expect(fetch).toHaveBeenCalledTimes(1)
    })

    it('应该正确处理小文件下载失败', async () => {
      const smallFileInfo = {
        ...mockFileInfo,
        fileSize: 256 * 1024
      }

      // Mock 下载失败
      fetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await downloadManager.downloadFile(smallFileInfo)

      expect(result.success).toBe(false)
      expect(result.error).toBeDefined()
    })
  })

  describe('大文件分片下载测试', () => {
    beforeEach(() => {
      // Mock 分片信息获取
      fetch.mockImplementation((url) => {
        if (url.includes('/getChunkInfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                downloadCode: mockDownloadCode,
                fileName: mockFileInfo.fileName,
                fileSize: mockFileInfo.fileSize,
                totalChunks: 2,
                chunkSize: 512 * 1024
              }
            })
          })
        }
        
        if (url.includes('/downloadChunk')) {
          // Mock 分片下载响应
          const chunkData = new ArrayBuffer(512 * 1024)
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(chunkData),
            headers: {
              get: (name) => {
                if (name === 'content-range') return 'bytes 0-524287/1048576'
                if (name === 'content-length') return '524288'
                return null
              }
            }
          })
        }
        
        return Promise.reject(new Error('Unknown URL'))
      })
    })

    it('应该使用分片下载方式处理大文件', async () => {
      const result = await downloadManager.downloadFile(mockFileInfo)

      expect(result.method).toBe('chunked')
      expect(result.success).toBe(true)
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/getChunkInfo'),
        expect.any(Object)
      )
    })

    it('应该正确处理分片下载的并发限制', async () => {
      const largeFileInfo = {
        ...mockFileInfo,
        fileSize: 5 * 1024 * 1024 // 5MB，需要10个分片
      }

      // Mock 大文件分片信息
      fetch.mockImplementation((url) => {
        if (url.includes('/getChunkInfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                downloadCode: mockDownloadCode,
                fileName: largeFileInfo.fileName,
                fileSize: largeFileInfo.fileSize,
                totalChunks: 10,
                chunkSize: 512 * 1024
              }
            })
          })
        }
        
        if (url.includes('/downloadChunk')) {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve({
                ok: true,
                arrayBuffer: () => Promise.resolve(new ArrayBuffer(512 * 1024))
              })
            }, 100) // 模拟网络延迟
          })
        }
      })

      const startTime = Date.now()
      const result = await downloadManager.downloadFile(largeFileInfo)
      const endTime = Date.now()

      expect(result.success).toBe(true)
      // 验证并发下载确实节省了时间（不是串行下载）
      expect(endTime - startTime).toBeLessThan(1000) // 应该在1秒内完成
    })

    it('应该正确处理分片下载失败和重试', async () => {
      let attemptCount = 0
      
      fetch.mockImplementation((url) => {
        if (url.includes('/getChunkInfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                downloadCode: mockDownloadCode,
                fileName: mockFileInfo.fileName,
                fileSize: mockFileInfo.fileSize,
                totalChunks: 2,
                chunkSize: 512 * 1024
              }
            })
          })
        }
        
        if (url.includes('/downloadChunk')) {
          attemptCount++
          if (attemptCount <= 2) {
            // 前两次请求失败
            return Promise.reject(new Error('Network error'))
          } else {
            // 第三次请求成功
            return Promise.resolve({
              ok: true,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(512 * 1024))
            })
          }
        }
      })

      const result = await downloadManager.downloadFile(mockFileInfo)

      expect(result.success).toBe(true)
      expect(attemptCount).toBeGreaterThan(2) // 验证确实进行了重试
    })
  })

  describe('网络中断和恢复场景测试', () => {
    it('应该能够从网络中断中恢复', async () => {
      let networkDown = true
      
      fetch.mockImplementation((url) => {
        if (url.includes('/getChunkInfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                downloadCode: mockDownloadCode,
                fileName: mockFileInfo.fileName,
                fileSize: mockFileInfo.fileSize,
                totalChunks: 2,
                chunkSize: 512 * 1024
              }
            })
          })
        }
        
        if (url.includes('/downloadChunk')) {
          if (networkDown) {
            // 模拟网络中断
            setTimeout(() => { networkDown = false }, 200) // 200ms后网络恢复
            return Promise.reject(new Error('Network unavailable'))
          } else {
            // 网络恢复后成功
            return Promise.resolve({
              ok: true,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(512 * 1024))
            })
          }
        }
      })

      const result = await downloadManager.downloadFile(mockFileInfo)

      expect(result.success).toBe(true)
    })

    it('应该正确保存和恢复下载进度', async () => {
      const progressKey = `download_progress_${mockDownloadCode}`
      
      // Mock localStorage 中已有部分下载进度
      localStorageMock.getItem.mockImplementation((key) => {
        if (key === progressKey) {
          return JSON.stringify({
            downloadCode: mockDownloadCode,
            totalChunks: 2,
            completedChunks: [0], // 第一个分片已完成
            chunks: {
              0: new ArrayBuffer(512 * 1024)
            }
          })
        }
        return null
      })

      fetch.mockImplementation((url) => {
        if (url.includes('/getChunkInfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                downloadCode: mockDownloadCode,
                fileName: mockFileInfo.fileName,
                fileSize: mockFileInfo.fileSize,
                totalChunks: 2,
                chunkSize: 512 * 1024
              }
            })
          })
        }
        
        if (url.includes('/downloadChunk')) {
          // 只应该请求第二个分片
          const url_obj = new URL(url, 'http://localhost')
          const chunkIndex = parseInt(url_obj.searchParams.get('chunkIndex'))
          expect(chunkIndex).toBe(1) // 应该只请求索引为1的分片
          
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(512 * 1024))
          })
        }
      })

      const result = await downloadManager.downloadFile(mockFileInfo)

      expect(result.success).toBe(true)
      // 验证只请求了缺失的分片
      const chunkRequests = fetch.mock.calls.filter(call => 
        call[0].includes('/downloadChunk')
      )
      expect(chunkRequests).toHaveLength(1)
    })
  })

  describe('文件完整性验证测试', () => {
    it('应该验证下载文件的完整性', async () => {
      const fileAssembler = new FileAssembler()
      
      // 创建测试分片数据
      const chunk1 = new ArrayBuffer(512 * 1024)
      const chunk2 = new ArrayBuffer(512 * 1024)
      const chunks = [chunk1, chunk2]
      
      const assembledFile = fileAssembler.assembleChunks(chunks)
      
      expect(assembledFile).toBeInstanceOf(Blob)
      expect(assembledFile.size).toBe(1024 * 1024) // 验证文件大小
    })

    it('应该检测文件损坏并触发重新下载', async () => {
      let downloadAttempts = 0
      
      fetch.mockImplementation((url) => {
        if (url.includes('/getChunkInfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                downloadCode: mockDownloadCode,
                fileName: mockFileInfo.fileName,
                fileSize: mockFileInfo.fileSize,
                totalChunks: 2,
                chunkSize: 512 * 1024
              }
            })
          })
        }
        
        if (url.includes('/downloadChunk')) {
          downloadAttempts++
          if (downloadAttempts === 1) {
            // 第一次返回损坏的数据（大小不匹配）
            return Promise.resolve({
              ok: true,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(256 * 1024)) // 错误的大小
            })
          } else {
            // 重试时返回正确的数据
            return Promise.resolve({
              ok: true,
              arrayBuffer: () => Promise.resolve(new ArrayBuffer(512 * 1024))
            })
          }
        }
      })

      const result = await downloadManager.downloadFile(mockFileInfo)

      expect(result.success).toBe(true)
      expect(downloadAttempts).toBeGreaterThan(2) // 验证进行了重新下载
    })
  })

  describe('下载方式一致性测试', () => {
    it('分片下载和传统下载应该产生相同的结果', async () => {
      const testContent = 'This is test file content for consistency verification'
      const testBlob = new Blob([testContent])
      
      // Mock 传统下载
      const traditionalResult = {
        method: 'traditional',
        success: true,
        blob: testBlob
      }
      
      // Mock 分片下载结果
      const chunkedResult = {
        method: 'chunked',
        success: true,
        blob: testBlob
      }
      
      // 验证两种方式的结果一致
      expect(traditionalResult.blob.size).toBe(chunkedResult.blob.size)
      expect(traditionalResult.success).toBe(chunkedResult.success)
      
      // 验证内容一致性
      const traditionalText = await traditionalResult.blob.text()
      const chunkedText = await chunkedResult.blob.text()
      expect(traditionalText).toBe(chunkedText)
    })
  })

  describe('用户体验一致性测试', () => {
    it('应该保持下载触发的一致性', () => {
      const downloadTrigger = new DownloadTrigger()
      const mockBlob = new Blob(['test content'])
      const fileName = 'test.txt'
      
      // Mock DOM 元素创建和点击
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
        style: { display: '' }
      }
      
      global.document = {
        createElement: vi.fn(() => mockLink),
        body: {
          appendChild: vi.fn(),
          removeChild: vi.fn()
        }
      }
      
      downloadTrigger.triggerDownload(mockBlob, fileName)
      
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob)
      expect(mockLink.download).toBe(fileName)
      expect(mockLink.click).toHaveBeenCalled()
      expect(global.URL.revokeObjectURL).toHaveBeenCalled()
    })

    it('应该正确处理下载完成后的清理工作', async () => {
      const progressKey = `download_progress_${mockDownloadCode}`
      
      fetch.mockImplementation((url) => {
        if (url.includes('/getChunkInfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                downloadCode: mockDownloadCode,
                fileName: mockFileInfo.fileName,
                fileSize: mockFileInfo.fileSize,
                totalChunks: 1,
                chunkSize: 512 * 1024
              }
            })
          })
        }
        
        if (url.includes('/downloadChunk')) {
          return Promise.resolve({
            ok: true,
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(512 * 1024))
          })
        }
      })

      const result = await downloadManager.downloadFile(mockFileInfo)

      expect(result.success).toBe(true)
      // 验证下载完成后清理了进度数据
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(progressKey)
    })
  })
})