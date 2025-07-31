/**
 * Vitest 测试环境设置
 */

import { vi } from 'vitest'

// Mock global objects that might not be available in test environment
global.navigator = global.navigator || {}
global.window = global.window || {}
global.document = global.document || {}

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = localStorageMock

// Mock fetch if not available
if (!global.fetch) {
  global.fetch = vi.fn()
}

// Mock URL if not available
if (!global.URL) {
  global.URL = {
    createObjectURL: vi.fn(),
    revokeObjectURL: vi.fn()
  }
}

// Mock Blob if not available
if (!global.Blob) {
  global.Blob = vi.fn()
}

// Mock ArrayBuffer if not available
if (!global.ArrayBuffer) {
  global.ArrayBuffer = vi.fn()
}

// Setup default navigator properties
Object.defineProperty(global.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  configurable: true
})

Object.defineProperty(global.navigator, 'onLine', {
  value: true,
  configurable: true
})

Object.defineProperty(global.navigator, 'hardwareConcurrency', {
  value: 4,
  configurable: true
})

Object.defineProperty(global.navigator, 'deviceMemory', {
  value: 4,
  configurable: true
})

// Mock XMLHttpRequest for IE compatibility tests
global.XMLHttpRequest = vi.fn(() => ({
  open: vi.fn(),
  send: vi.fn(),
  setRequestHeader: vi.fn(),
  addEventListener: vi.fn()
}))