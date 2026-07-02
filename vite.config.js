import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost',
        // Reescribe /api/xxx.php → /app/api/xxx.php (XAMPP)
        rewrite: (path) => `/app${path}`,
        changeOrigin: true,
      },
      '/app/uploads': {
        target: 'http://localhost',
        changeOrigin: true,
      },
    },
  },
})
