import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { demoReportFixture } from './src/dev/report-fixture'

function serializeDemoReport(): string {
  return JSON.stringify(demoReportFixture)
    .replace(/&/g, '\\u0026')
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029')
}

function demoReportPlugin(enabled: boolean, allowEmptyState: boolean): Plugin {
  return {
    name: 'code996-demo-report',
    transformIndexHtml(_html, context) {
      if (!enabled) return

      const requestUrl = new URL(context.originalUrl ?? context.path, 'http://localhost')
      if (allowEmptyState && requestUrl.searchParams.get('empty') === '1') return

      return [
        {
          tag: 'script',
          attrs: { 'data-code996-demo-report': '' },
          children: `window.__CODE996_REPORT__ = ${serializeDemoReport()};`,
          injectTo: 'head-prepend',
        },
      ]
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const isDevServer = command === 'serve'
  const isWebsitePreview = command === 'build' && mode === 'preview'

  return {
    root: fileURLToPath(new URL('.', import.meta.url)),
    base: isDevServer ? '/preview/' : './',
    plugins: [demoReportPlugin(isDevServer || isWebsitePreview, isDevServer), vue()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 3300,
      strictPort: true,
      open: true,
      hmr: {
        path: '/preview/hmr',
      },
    },
    build: {
      outDir: fileURLToPath(new URL(isWebsitePreview ? '../dist/website/preview' : '../dist/web', import.meta.url)),
      emptyOutDir: true,
    },
  }
})
