import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/generate-csv': 'http://poa-backend-svc:5000',
      '/generate-excel': 'http://poa-backend-svc:5000',
      '/health': 'http://poa-backend-svc:5000',
    }
  }
})
