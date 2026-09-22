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
  build: { emptyOutDir: true },
})
