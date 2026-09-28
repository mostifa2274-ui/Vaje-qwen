import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const buildCommit = process.env.WORKERS_CI_COMMIT_SHA || process.env.GITHUB_SHA || 'local'

export default defineConfig({
  base: './',
  plugins: [react()],
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
