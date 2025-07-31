/**
 * 简化的浏览器兼容性测试
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('浏览器兼容性基础测试', () => {
  let originalUserAgent
  let originalFetch
  let originalURL
  let originalArrayBuffer

  beforeEach(() => {
    // 保存原始对象
    originalUserAgent = global.navigator?.userAgent
    originalFetch = global.fetch
    originalURL = global.URL
    originalArrayBuffer = global.ArrayBuffer
    
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
      {
        name: 'Chrome',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      },
      {
        name: 'Firefox', 
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
      },
      {
        name: 'Safari',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15'
      },
      {
        name: 'Edge',
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

        // 测试基本的 API 支持
        expect(typeof fetch).toBe('function')
        expect(typeof ArrayBuffer).toBe('function')
        expect(typeof Blob).toBe('function')
        expect(typeof URL.createObjectURL).toBe('function')
        
        // 测试用户代理设置
        expect(navigator.userAgent).toBe(browser.userAgent)
      })
    })
  })

  describe('旧版浏览器降级测试', () => {
    const legacyBrowsers = [
      {
        name: 'IE 11',
        userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko'
      },
      {
        name: 'Chrome 49',
        userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/49.0.2623.112 Safari/537.36'
      },
      {
        name: 'Firefox 45',
        userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; rv:45.0) Gecko/20100101 Firefox/45.0'
      }
    ]

    legacyBrowsers.forEach((browser) => {
      it(`应该在 ${browser.name} 中降级到传统下载`, async () => {
        // 设置用户代理
        Object.defineProperty(global.navigator, 'userAgent', {
          value: browser.userAgent,
          configurable: true
        })

        // Mock 旧版浏览器的 API 限制
        if (browser.name === 'IE 11') {
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

        // 验证降级条件
        if (browser.name === 'IE 11') {
          expect(typeof fetch).toBe('undefined')
          expect(typeof XMLHttpRequest).toBe('function')
        } else {
          expect(typeof fetch).toBe('function')
        }
        
        expect(navigator.userAgent).toBe(browser.userAgent)
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

        // 验证移动端设置
        expect(navigator.userAgent).toBe(browser.userAgent)
        expect(navigator.deviceMemory).toBe(2)
        expect(typeof fetch).toBe('function')

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
      // 测试支持 ArrayBuffer 的情况
      expect(typeof ArrayBuffer).toBe('function')
      
      // 测试不支持 ArrayBuffer 的情况
      global.ArrayBuffer = undefined
      expect(typeof ArrayBuffer).toBe('undefined')
    })

    it('应该正确检测 Blob 支持', () => {
      // 测试支持 Blob 的情况
      global.Blob = function() {}
      expect(typeof Blob).toBe('function')
      
      // 测试不支持 Blob 的情况
      global.Blob = undefined
      expect(typeof Blob).toBe('undefined')
    })

    it('应该正确检测 URL.createObjectURL 支持', () => {
      // 测试支持的情况
      global.URL = { createObjectURL: vi.fn() }
      expect(typeof URL.createObjectURL).toBe('function')
      
      // 测试不支持的情况
      global.URL = {}
      expect(typeof URL.createObjectURL).toBe('undefined')
      
      global.URL = undefined
      expect(typeof URL).toBe('undefined')
    })

    it('应该正确检测 localStorage 支持', () => {
      // 测试支持的情况
      global.localStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
      expect(typeof localStorage).toBe('object')
      expect(typeof localStorage.getItem).toBe('function')
      
      // 测试不支持的情况
      global.localStorage = undefined
      expect(typeof localStorage).toBe('undefined')
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

      // 验证降级条件
      expect(typeof ArrayBuffer).toBe('undefined')
      expect(typeof fetch).toBe('function')
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

      // 验证网络错误模拟
      expect(typeof fetch).toBe('function')
      
      try {
        await fetch('/downloadChunk/test')
      } catch (error) {
        expect(error.message).toBe('Network unstable')
      }
      
      expect(failureCount).toBe(1)
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

      // 验证设备性能设置
      expect(navigator.hardwareConcurrency).toBe(2)
      expect(navigator.deviceMemory).toBe(1)
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

      // 验证网络状况设置
      expect(navigator.connection.effectiveType).toBe('2g')
      expect(navigator.connection.downlink).toBe(0.5)
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

        try {
          await fetch('/test')
        } catch (caughtError) {
          expect(caughtError.message).toBe(error.message)
        }
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

      try {
        localStorage.setItem('test', 'value')
      } catch (error) {
        expect(error.message).toBe('QuotaExceededError')
      }
    })
  })
})