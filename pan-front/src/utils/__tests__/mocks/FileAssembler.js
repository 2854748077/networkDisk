/**
 * Mock FileAssembler for testing
 */

import { vi } from 'vitest'

class FileAssembler {
  constructor(fileName, expectedSize, options = {}) {
    this.fileName = fileName
    this.expectedSize = expectedSize
    this.options = options
  }

  async performIntegrityCheck(fileBlob, options = {}) {
    // Mock integrity check - always pass unless specifically configured
    return {
      isValid: true,
      errors: [],
      warnings: []
    }
  }
}

export default FileAssembler