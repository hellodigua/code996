import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { devReportFixture } from './src/dev/report-fixture'

function serializeDevReport(): string {
  return JSON.stringify(devReportFixture)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function devReportPlugin(): Plugin {
  return {
    name: 'code996-dev-report',
    apply: 'serve',
    transformIndexHtml(_html, context) {
      const requestUrl = new URL(context.originalUrl ?? context.path, 'http://localhost')
      if (requestUrl.searchParams.get('empty') === '1') return

      return [
        {
          tag: 'script',
          attrs: { 'data-code996-dev-report': '' },
          children: `window.__CODE996_REPORT__ = ${serializeDevReport()};`,
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  base: './',
  plugins: [devReportPlugin(), vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 3300,
    strictPort: true,
    open: true,
  },
  build: {
    outDir: fileURLToPath(new URL('../dist/web', import.meta.url)),
    emptyOutDir: true,
  },
})
