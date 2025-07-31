/**
 * Mock RetryManager for testing
 */

import { vi } from 'vitest'

class RetryManager {
  async executeWithRetry(operation, options = {}) {
    // Simple mock - just execute the operation once
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

const globalRetryManager = new RetryManager()

export { RetryManager, globalRetryManager }