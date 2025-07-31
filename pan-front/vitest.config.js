import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/utils/__tests__/setup.js']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      './Request.js': path.resolve(__dirname, './src/utils/__tests__/mocks/Request.js'),
      './FileAssembler.js': path.resolve(__dirname, './src/utils/__tests__/mocks/FileAssembler.js'),
      './DownloadTrigger.js': path.resolve(__dirname, './src/utils/__tests__/mocks/DownloadTrigger.js'),
      './RetryManager.js': path.resolve(__dirname, './src/utils/__tests__/mocks/RetryManager.js')
    }
  }
})