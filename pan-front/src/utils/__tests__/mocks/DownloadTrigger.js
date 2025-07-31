/**
 * Mock DownloadTrigger for testing
 */

import { vi } from 'vitest'

class DownloadTrigger {
  constructor(options = {}) {
    this.options = options
  }

  async triggerDownload(blob, fileName) {
    // Mock download trigger - just resolve successfully
    return Promise.resolve(true)
  }

  destroy() {
    // Mock cleanup
  }
}

export default DownloadTrigger