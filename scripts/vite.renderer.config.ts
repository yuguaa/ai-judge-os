import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/** 仅渲染层 dev server：浏览器里调试 UI（不启动 Electron） */
export default defineConfig({
  root: resolve(__dirname, '../src/renderer'),
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src/renderer/src'),
      '@shared': resolve(__dirname, '../src/shared')
    }
  },
  server: { port: 5199 }
})
