/**
 * 浏览器兼容性集成测试
 * 测试分片下载功能在不同浏览器中的兼容性和降级机制
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the dependencies before importing the main classes
vi.mock('../Request.js', () => {
  return {
    default: vi.fn().mockImplementation(async (config) => {
      const { url, responseType } = config
      
      if (url.includes('/createDownloadUrl/')) {
        return { data: 'mock_download_code_123' }
      }
      
      if (url.includes('/getChunkInfo/')) {
        return {
          data: {
            downloadCode: 'mock_download_code_123',
            fileName: 'test.txt',
            fileSize: 1024 * 1024,
            totalChunks: 2,
            chunkSize: 512 * 1024
          }
        }
      }
      
      if (url.includes('/downloadChunk/')) {
        if (responseType === 'blob') {
          return new Blob(['mock chunk data'], { type: 'application/octet-stream' })
        }
      }
      
      return { data: null }
    })
  }
})

vi.mock('../FileAssembler.js', () => {
  return {
    default: class FileAssembler {
      constructor(fileName, expectedSize, options = {}) {
        this.fileName = fileName
        this.expectedSize = expectedSize
        this.options = options
      }
      
      async performIntegrityCheck() {
        return { isValid: true, errors: [], warnings: [] }
      }
    }
  }
})

vi.mock('../DownloadTrigger.js', () => {
  return {
    default: class DownloadTrigger {
      constructor(options = {}) {
        this.options = options
      }
      
      async triggerDownload(blob, fileName) {
        return Promise.resolve(true)
      }
      
      destroy() {}
    }
  }
})

vi.mock('../RetryManager.js', () => {
  const RetryManager = class {
    async executeWithRetry(operation, options = {}) {
      try {
        return await operation(1, 'mock-retry-id')
      } catch (error) {
        if (options.onRetryFailed) {
          options.onRetryFailed({
            totalAttempts: 1,
            finalError: error
          })
        }
        throw error
      }
    }
  }
  
  return {
    RetryManager,
    globalRetryManager: new RetryManager()
  }
})

// Now import the classes after mocking dependencies
import DownloadManager from '../DownloadManager.js'

describe('浏览器兼容性集成测试', () => {
  let originalUserAgent
  let originalFetch
  let originalURL
  let originalArrayBuffer
  let originalBlob
  let downloadManager

  beforeEach(() => {
    // 保存原始对象
    originalUserAgent = global.navigator?.userAgent
    originalFetch = global.fetch
    originalURL = global.URL
    originalArrayBuffer = global.ArrayBuffer
    originalBlob = global.Blob
    
    // 重置为默认的现代浏览器环境
    global.fetch = vi.fn()
    global.URL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    }
    global.ArrayBuffer = function(size) { return new ArrayBuffer(size) }
    global.Blob = function(parts, options) { return new Blob(parts, options) }
    
    downloadManager = new DownloadManager()
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
    global.Blob = originalBlob
    vi.clearAllMocks()
  })

  describe('现代浏览器支持测试', () => {
    const modernBrowsers = [
      {
        name: 'Chrome 91',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      {
        name: 'Firefox 89',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
      },
      {
        name: 'Safari 14',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
      },
      {
        name: 'Edge 91',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59'
      }
    ]

    modernBrowsers.forEach((browser) => {
      it(`应该在 ${browser.name} 中支持分片下载`, async () => {
        // 设置用户代理
        Object.defineProperty(global.navigator, 'userAgent', {
          value: browser.userAgent,
          configurable: true
        })

        const fileInfo = {
          fileId: 'test_file_id',
          fileName: 'test.txt',
          fileSize: 1024 * 1024, // 1MB，超过分片阈值
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
      {
        name: 'IE 11',
        userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko',
        mockLimitations: () => {
          global.fetch = undefined
          global.XMLHttpRequest = vi.fn(() => ({
            open: vi.fn(),
            send: vi.fn(),
            setRequestHeader: vi.fn(),
            addEventListener: vi.fn()
          }))
        }
      },
      {
        name: 'Chrome 49',
        userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36',
        mockLimitations: () => {
          // Chrome 49 supports fetch but may have other limitations
          global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(new Blob(['traditional download content']))
          })
        }
      },
      {
        name: 'Firefox 45',
        userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:45.0) Gecko/20100101 Firefox/45.0',
        mockLimitations: () => {
          global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            blob: () => Promise.resolve(new Blob(['traditional download content']))
          })
        }
      }
    ]

    legacyBrowsers.forEach((browser) => {
      it(`应该在 ${browser.name} 中降级到传统下载`, async () => {
        // 设置用户代理
        Object.defineProperty(global.navigator, 'userAgent', {
          value: browser.userAgent,
          configurable: true
        })

        // 应用浏览器限制
        browser.mockLimitations()

        const fileInfo = {
          fileId: 'test_file_id',
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
      {
        name: 'iOS Safari',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      },
      {
        name: 'Android Chrome',
        userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'
      },
      {
        name: 'Samsung Browser',
        userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/14.2 Chrome/87.0.4280.141 Mobile Safari/537.36'
      }
    ]

    mobileBrowsers.forEach((browser) => {
      it(`应该在 ${browser.name} 中正确处理分片下载`, async () => {
        // 设置用户代理
        Object.defineProperty(global.navigator, 'userAgent', {
          value: browser.userAgent,
          configurable: true
        })

        // Mock 移动端的内存限制
        Object.defineProperty(global.navigator, 'deviceMemory', {
          value: 2, // 2GB 内存
          configurable: true
        })

        const fileInfo = {
          fileId: 'test_file_id',
          fileName: 'test.txt',
          fileSize: 2 * 1024 * 1024, // 2MB 文件
          downloadCode: 'test_code'
        }

        const result = await downloadManager.downloadFile(fileInfo)

        expect(result.success).toBe(true)
        // 移动端可能会根据内存情况选择不同的下载方式
        expect(['chunked', 'traditional']).toContain(result.method)
      })
    })
  })

  describe('浏览器兼容性检测测试', () => {
    it('应该正确检测现代浏览器的兼容性', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        configurable: true
      })

      const compatibilityResult = downloadManager._checkBrowserCompatibility()

      expect(compatibilityResult.isCompatible).toBe(true)
      expect(compatibilityResult.browserInfo.name).toBe('Chrome')
      expect(compatibilityResult.browserInfo.version).toBe('91')
    })

    it('应该正确检测 IE 11 的兼容性', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko',
        configurable: true
      })

      // 模拟 IE 11 的 API 限制
      global.fetch = undefined

      const compatibilityResult = downloadManager._checkBrowserCompatibility()

      expect(compatibilityResult.isCompatible).toBe(false)
      expect(compatibilityResult.issues).toContain('fetch API not supported')
      expect(compatibilityResult.browserInfo.name).toBe('Internet Explorer')
      expect(compatibilityResult.browserInfo.version).toBe('11')
    })

    it('应该正确检测旧版 Chrome 的兼容性', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.2623.112 Safari/537.36',
        configurable: true
      })

      const compatibilityResult = downloadManager._checkBrowserCompatibility()

      expect(compatibilityResult.issues.some(issue => issue.includes('Chrome 48'))).toBe(true)
      expect(compatibilityResult.browserInfo.name).toBe('Chrome')
      expect(compatibilityResult.browserInfo.version).toBe('48')
    })

    it('应该正确检测移动端浏览器', () => {
      Object.defineProperty(global.navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        configurable: true
      })

      const compatibilityResult = downloadManager._checkBrowserCompatibility()

      expect(compatibilityResult.browserInfo.isMobile).toBe(true)
      expect(compatibilityResult.browserInfo.name).toBe('Safari')
    })
  })

  describe('降级机制测试', () => {
    it('当 ArrayBuffer 不支持时应该降级', async () => {
      global.ArrayBuffer = undefined

      const fileInfo = {
        fileId: 'test_file_id',
        fileName: 'test.txt',
        fileSize: 1024 * 1024,
        downloadCode: 'test_code'
      }

      const result = await downloadManager.downloadFile(fileInfo)

      expect(result.success).toBe(true)
      expect(result.method).toBe('traditional')
    })

    it('当 Blob 不支持时应该降级', async () => {
      global.Blob = undefined

      const fileInfo = {
        fileId: 'test_file_id',
        fileName: 'test.txt',
        fileSize: 1024 * 1024,
        downloadCode: 'test_code'
      }

      const result = await downloadManager.downloadFile(fileInfo)

      expect(result.success).toBe(true)
      expect(result.method).toBe('traditional')
    })

    it('当 URL.createObjectURL 不支持时应该降级', async () => {
      global.URL = {}

      const fileInfo = {
        fileId: 'test_file_id',
        fileName: 'test.txt',
        fileSize: 1024 * 1024,
        downloadCode: 'test_code'
      }

      const result = await downloadManager.downloadFile(fileInfo)

      expect(result.success).toBe(true)
      expect(result.method).toBe('traditional')
    })

    it('当分片下载失败时应该降级到传统下载', async () => {
      // Mock 分片下载失败
      const mockRequest = vi.mocked(await import('../Request.js')).default
      mockRequest.mockImplementation(async (config) => {
        if (config.url.includes('/downloadChunk/')) {
          throw new Error('Chunk download failed')
        }
        if (config.url.includes('/createDownloadUrl/')) {
          return { data: 'mock_download_code_123' }
        }
        if (config.url.includes('/getChunkInfo/')) {
          return {
            data: {
              downloadCode: 'mock_download_code_123',
              fileName: 'test.txt',
              fileSize: 1024 * 1024,
              totalChunks: 2,
              chunkSize: 512 * 1024
            }
          }
        }
        return { data: null }
      })

      const fileInfo = {
        fileId: 'test_file_id',
        fileName: 'test.txt',
        fileSize: 1024 * 1024
      }

      const result = await downloadManager.downloadFile(fileInfo)

      expect(result.success).toBe(true)
      expect(result.method).toBe('traditional')
    })
  })

  describe('性能适配测试', () => {
    it('应该根据设备性能选择合适的下载方式', async () => {
      // 模拟低性能设备
      Object.defineProperty(global.navigator, 'hardwareConcurrency', {
        value: 2,
        configurable: true
      })
      
      Object.defineProperty(global.navigator, 'deviceMemory', {
        value: 1, // 1GB 内存
        configurable: true
      })

      const fileInfo = {
        fileId: 'test_file_id',
        fileName: 'test.txt',
        fileSize: 10 * 1024 * 1024, // 10MB 大文件
        downloadCode: 'test_code'
      }

      const result = await downloadManager.downloadFile(fileInfo)

      expect(result.success).toBe(true)
      // 低性能设备可能会选择传统下载以避免内存问题
      expect(['chunked', 'traditional']).toContain(result.method)
    })

    it('应该根据网络状况调整下载策略', async () => {
      // 模拟慢速网络
      Object.defineProperty(global.navigator, 'connection', {
        value: {
          effectiveType: '2g',
          downlink: 0.5
        },
        configurable: true
      })

      const fileInfo = {
        fileId: 'test_file_id',
        fileName: 'test.txt',
        fileSize: 5 * 1024 * 1024, // 5MB 文件
        downloadCode: 'test_code'
      }

      const result = await downloadManager.downloadFile(fileInfo)

      expect(result.success).toBe(true)
      // 慢速网络可能会影响下载方式的选择
      expect(['chunked', 'traditional']).toContain(result.method)
    })
  })

  describe('错误处理兼容性测试', () => {
    it('应该正确处理不同类型的网络错误', async () => {
      const errorTypes = [
        new TypeError('Failed to fetch'),
        new Error('Network request failed'),
        new Error('The request timed out')
      ]

      for (const error of errorTypes) {
        const mockRequest = vi.mocked(await import('../Request.js')).default
        mockRequest.mockRejectedValueOnce(error)

        const fileInfo = {
          fileId: 'test_file_id',
          fileName: 'test.txt',
          fileSize: 1024 * 1024
        }

        try {
          await downloadManager.downloadFile(fileInfo)
        } catch (caughtError) {
          expect(caughtError.message).toContain('Failed to create download code')
        }
      }
    })

    it('应该处理存储限制错误', async () => {
      // 模拟 localStorage 配额超限
      global.localStorage = {
        setItem: vi.fn().mockImplementation(() => {
          throw new Error('QuotaExceededError')
        }),
        getItem: vi.fn(),
        removeItem: vi.fn()
      }

      const fileInfo = {
        fileId: 'test_file_id',
        fileName: 'test.txt',
        fileSize: 1024 * 1024,
        downloadCode: 'test_code'
      }

      // 即使存储有问题，下载仍应该能够进行（只是无法保存进度）
      const result = await downloadManager.downloadFile(fileInfo)

      expect(result.success).toBe(true)
    })
  })
})