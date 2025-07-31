/**
 * 浏览器兼容性测试
 * 测试分片下载功能在不同浏览器中的兼容性和降级机制
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import DownloadManager from '../DownloadManager.js'
import ChunkDownloader from '../ChunkDownloader.js'

describe('浏览器兼容性测试', () => {
  let originalUserAgent
  let originalFetch
  let originalURL
  let originalArrayBuffer
  let downloadManager

  beforeEach(() => {
    // 保存原始对象
    originalUserAgent = global.navigator?.userAgent
    originalFetch = global.fetch
    originalURL = global.URL
    originalArrayBuffer = global.ArrayBuffer
    
    downloadManager = new DownloadManager()
    
    // 基础 Mock 设置
    global.fetch = vi.fn()
    global.URL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    }
  })

  afterEach(() => {
    // 恢复原始对象
    if (originalUserAgent !== undefined) {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: originalUserAgent,
        configurable: true
      })
    }
    global.fetch = originalFetch
    global.URL = originalURL
    global.ArrayBuffer = originalArrayBuffer
    vi.clearAllMocks()
  })

  describe('现代浏览器支持测试', () => {
    const modernBrowsers = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
    ]

    modernBrowsers.forEach((userAgent, index) => {
      const browserName = ['Chrome', 'Firefox', 'Safari', 'Edge'][index]
      
      it(`应该在 ${browserName} 中支持分片下载`, async () => {
        // 设置用户代理
        Object.defineProperty(global.navigator, 'userAgent', {
          value: userAgent,
          configurable: true
        })

        // Mock 现代浏览器的 API 支持
        global.fetch = vi.fn().mockImplementation((url) => {
          if (url.includes('/getChunkInfo')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                success: true,
                data: {
                  downloadCode: 'test_code',
                  fileName: 'test.txt',
                  fileSize: 1024 * 1024,
                  totalChunks: 2,
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

        const fileInfo = {
          fileName: 'test.txt',
          fileSize: 1024 * 1024,
          downloadCode: 'test_code'
        }

        const result = await downloadManager.downloadFile(fileInfo)

        expect(result.success).toBe(true)
        expect(result.method).toBe('chunked')
      })
    })
  })

  describe('旧版浏览器降级测试', () => {
    const legacyBrowsers = [
      'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko', // IE 11
      'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36', // Chrome 49
      'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:45.0) Gecko/20100101 Firefox/45.0' // Firefox 45
    ]

    legacyBrowsers.forEach((userAgent, index) => {
      const browserName = ['IE 11', 'Chrome 49', 'Firefox 45'][index]
      
      it(`应该在 ${browserName} 中降级到传统下载`, async () => {
        // 设置用户代理
        Object.defineProperty(global.navigator, 'userAgent', {
          value: userAgent,
          configurable: true
        })

        // Mock 旧版浏览器的 API 限制
        if (browserName === 'IE 11') {
          // IE 11 不支持 fetch
          global.fetch = undefined
          global.XMLHttpRequest = vi.fn(() => ({
            open: vi.fn(),
            send: vi.fn(),
            setRequestHeader: vi.fn(),
            addEventListener: vi.fn((event, callback) => {
              if (event === 'load') {
                setTimeout(() => {
                  callback({
                    target: {
                      status: 200,
                      response: new Blob(['traditional download content'])
                    }
                  })
                }, 10)
              }
            })
          }))
        } else {
          // 其他旧版浏览器支持 fetch 但可能不支持某些特性
          global.fetch = vi.fn().mockImplementation(() => {
            // 模拟不支持分片下载的响应
            return Promise.resolve({
              ok: true,
              blob: () => Promise.resolve(new Blob(['traditional download content']))
            })
          })
        }

        const fileInfo = {
          fileName: 'test.txt',
          fileSize: 1024 * 1024,
          downloadCode: 'test_code'
        }

        const result = await downloadManager.downloadFile(fileInfo)

        expect(result.success).toBe(true)
        expect(result.method).toBe('traditional')
      })
    })
  })

  describe('移动端浏览器兼容性测试', () => {
    const mobileBrowsers = [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1', // iOS Safari
      'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36', // Android Chrome
      'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36' // Samsung Browser
    ]

    mobileBrowsers.forEach((userAgent, index) => {
      const browserName = ['iOS Safari', 'Android Chrome', 'Samsung Browser'][index]
      
      it(`应该在 ${browserName} 中正确处理分片下载`, async () => {
        // 设置用户代理
        Object.defineProperty(global.navigator, 'userAgent', {
          value: userAgent,
          configurable: true
        })

        // Mock 移动端的内存限制
        const originalMemory = global.navigator?.deviceMemory
        Object.defineProperty(global.navigator, 'deviceMemory', {
          value: 2, // 2GB 内存，模拟中等配置移动设备
          configurable: true
        })

        global.fetch = vi.fn().mockImplementation((url) => {
          if (url.includes('/getChunkInfo')) {
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                success: true,
                data: {
                  downloadCode: 'test_code',
                  fileName: 'test.txt',
                  fileSize: 2 * 1024 * 1024, // 2MB 文件
                  totalChunks: 4,
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

        const fileInfo = {
          fileName: 'test.txt',
          fileSize: 2 * 1024 * 1024,
          downloadCode: 'test_code'
        }

        const result = await downloadManager.downloadFile(fileInfo)

        expect(result.success).toBe(true)
        // 移动端可能会根据内存情况选择不同的下载方式
        expect(['chunked', 'traditional']).toContain(result.method)

        // 恢复原始值
        if (originalMemory !== undefined) {
          Object.defineProperty(global.navigator, 'deviceMemory', {
            value: originalMemory,
            configurable: true
          })
        }
      })
    })
  })

  describe('API 支持检测测试', () => {
    it('应该正确检测 ArrayBuffer 支持', () => {
      const chunkDownloader = new ChunkDownloader()
      
      // 测试支持 ArrayBuffer 的情况
      expect(chunkDownloader.isArrayBufferSupported()).toBe(true)
      
      // 测试不支持 ArrayBuffer 的情况
      global.ArrayBuffer = undefined
      expect(chunkDownloader.isArrayBufferSupported()).toBe(false)
    })

    it('应该正确检测 Blob 支持', () => {
      const chunkDownloader = new ChunkDownloader()
      
      // 测试支持 Blob 的情况
      global.Blob = function() {}
      expect(chunkDownloader.isBlobSupported()).toBe(true)
      
      // 测试不支持 Blob 的情况
      global.Blob = undefined
      expect(chunkDownloader.isBlobSupported()).toBe(false)
    })

    it('应该正确检测 URL.createObjectURL 支持', () => {
      const chunkDownloader = new ChunkDownloader()
      
      // 测试支持的情况
      global.URL = { createObjectURL: vi.fn() }
      expect(chunkDownloader.isCreateObjectURLSupported()).toBe(true)
      
      // 测试不支持的情况
      global.URL = {}
      expect(chunkDownloader.isCreateObjectURLSupported()).toBe(false)
      
      global.URL = undefined
      expect(chunkDownloader.isCreateObjectURLSupported()).toBe(false)
    })

    it('应该正确检测 localStorage 支持', () => {
      const chunkDownloader = new ChunkDownloader()
      
      // 测试支持的情况
      global.localStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
      expect(chunkDownloader.isLocalStorageSupported()).toBe(true)
      
      // 测试不支持的情况
      global.localStorage = undefined
      expect(chunkDownloader.isLocalStorageSupported()).toBe(false)
    })
  })

  describe('降级机制测试', () => {
    it('当分片下载不支持时应该自动降级', async () => {
      // 模拟不支持分片下载的环境
      global.ArrayBuffer = undefined
      global.fetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['fallback content']))
        })
      })

      const fileInfo = {
        fileName: 'test.txt',
        fileSize: 1024 * 1024,
        downloadCode: 'test_code'
      }

      const result = await downloadManager.downloadFile(fileInfo)

      expect(result.success).toBe(true)
      expect(result.method).toBe('traditional')
    })

    it('当网络不稳定时应该降级到传统下载', async () => {
      let failureCount = 0
      
      global.fetch = vi.fn().mockImplementation((url) => {
        if (url.includes('/getChunkInfo')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                downloadCode: 'test_code',
                fileName: 'test.txt',
                fileSize: 1024 * 1024,
                totalChunks: 2,
                chunkSize: 512 * 1024
              }
            })
          })
        }
        
        if (url.includes('/downloadChunk')) {
          failureCount++
          if (failureCount <= 6) { // 模拟多次失败
            return Promise.reject(new Error('Network unstable'))
          }
        }
        
        // 降级到传统下载
        return Promise.resolve({
          ok: true,
          blob: () => Promise.resolve(new Blob(['traditional download content']))
        })
      })

      const fileInfo = {
        fileName: 'test.txt',
        fileSize: 1024 * 1024,
        downloadCode: 'test_code'
      }

      const result = await downloadManager.downloadFile(fileInfo)

      expect(result.success).toBe(true)
      expect(result.method).toBe('traditional')
      expect(failureCount).toBeGreaterThan(3) // 验证确实尝试了分片下载
    })
  })

  describe('性能适配测试', () => {
    it('应该根据设备性能调整并发数', async () => {
      // 模拟低性能设备
      Object.defineProperty(global.navigator, 'hardwareConcurrency', {
        value: 2, // 双核设备
        configurable: true
      })
      
      Object.defineProperty(global.navigator, 'deviceMemory', {
        value: 1, // 1GB 内存
        configurable: true
      })

      const chunkDownloader = new ChunkDownloader()
      const optimalConcurrency = chunkDownloader.getOptimalConcurrency()

      // 低性能设备应该使用较少的并发数
      expect(optimalConcurrency).toBeLessThanOrEqual(2)
    })

    it('应该根据网络状况调整分片大小', async () => {
      // 模拟慢速网络
      Object.defineProperty(global.navigator, 'connection', {
        value: {
          effectiveType: '2g',
          downlink: 0.5 // 0.5 Mbps
        },
        configurable: true
      })

      const chunkDownloader = new ChunkDownloader()
      const optimalChunkSize = chunkDownloader.getOptimalChunkSize()

      // 慢速网络应该使用较小的分片
      expect(optimalChunkSize).toBeLessThan(512 * 1024)
    })
  })

  describe('错误处理兼容性测试', () => {
    it('应该在不同浏览器中正确处理网络错误', async () => {
      const errorTypes = [
        new TypeError('Failed to fetch'), // Chrome/Firefox
        new Error('Network request failed'), // Safari
        new Error('The request timed out') // IE/Edge
      ]

      for (const error of errorTypes) {
        global.fetch = vi.fn().mockRejectedValue(error)

        const fileInfo = {
          fileName: 'test.txt',
          fileSize: 1024 * 1024,
          downloadCode: 'test_code'
        }

        const result = await downloadManager.downloadFile(fileInfo)

        // 应该能够处理各种类型的网络错误
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
      }
    })

    it('应该在不同浏览器中正确处理存储限制', async () => {
      // 模拟存储空间不足
      global.localStorage = {
        setItem: vi.fn().mockImplementation(() => {
          throw new Error('QuotaExceededError')
        }),
        getItem: vi.fn(),
        removeItem: vi.fn()
      }

      const chunkDownloader = new ChunkDownloader()
      const canSaveProgress = chunkDownloader.canSaveProgress()

      expect(canSaveProgress).toBe(false)
    })
  })
})