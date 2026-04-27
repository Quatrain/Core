import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true // Force Vite à détecter mes modifications instantanément !
    }
  },
  resolve: {
    alias: [
      { find: /^@quatrain\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/$1/src') }
    ]
  }
})
