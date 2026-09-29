import { createHash } from 'node:crypto'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const buildCommit = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || 'local'

/**
 * Adds the page's Content-Security-Policy to the production index.html. It is
 * build-only because the dev server injects inline scripts for hot reload.
 * Inline <style> blocks (the no-JavaScript fallback) are allowed by hash, so
 * editing one keeps the policy in step automatically. frame-ancestors cannot
 * be set from a <meta> tag; public/_headers sends it.
 */
function contentSecurityPolicy(): Plugin {
  return {
    name: 'ghesse-content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const styleHashes = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)]
          .map(match => `'sha256-${createHash('sha256').update(match[1]).digest('base64')}'`)
        const policy = [
          "default-src 'self'",
          "script-src 'self'",
          ["style-src 'self'", ...styleHashes].join(' '),
          "img-src 'self' data:",
          "media-src 'self'",
          "connect-src 'self'",
          "font-src 'self'",
          "manifest-src 'self'",
          "worker-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'none'",
        ].join('; ')
        const charset = '<meta charset="UTF-8" />'
        if (!html.includes(charset)) throw new Error('index.html must declare its charset before the security policy')
        return html.replace(charset, `${charset}\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`)
      },
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), contentSecurityPolicy()],
  define: {
    __GHESSE_BUILD_COMMIT__: JSON.stringify(buildCommit),
  },
  server: { port: 3000 },
  build: {
    emptyOutDir: true,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'react-vendor'
          if (id.includes('/src/data/chapters/') || id.endsWith('/src/data/vocabulary.json')) return 'course-data'
          return undefined
        },
      },
    },
  },
})
