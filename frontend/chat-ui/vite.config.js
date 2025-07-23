import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',  // Use loopback IP for consistency
    port: 5174,          // Match your frontend port
    strictPort: true,    // Fail if port 5174 is taken (avoid surprises)
    proxy: {
      '/chat': 'http://127.0.0.1:8000',
      '/reindex': 'http://127.0.0.1:8000'
    }
  }
})
