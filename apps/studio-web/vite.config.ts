import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ['../..', '../../packages']
    },
    watch: {
      usePolling: true
    }
  },
  optimizeDeps: {
    exclude: [
      '@quatrain/log',
      '@quatrain/core',
      '@quatrain/api',
      '@quatrain/api-client',
      '@quatrain/backend',
      '@quatrain/studio'
    ]
  },
  build: {
    commonjsOptions: {
      include: [/packages/, /node_modules/],
      transformMixedEsModules: true
    }
  },
  resolve: {
    preserveSymlinks: true,
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
    alias: [
       { find: /^@quatrain\/log\/src\/index\.ts$/, replacement: path.resolve(__dirname, '../../packages/log/src/index.ts') },
       { find: /^@quatrain\/log$/, replacement: path.resolve(__dirname, '../../packages/log/src/index.ts') },
       { find: /^@quatrain\/core$/, replacement: path.resolve(__dirname, '../../packages/core/src/index.ts') },
       { find: /^@quatrain\/api$/, replacement: path.resolve(__dirname, '../../packages/api/src/index.ts') },
       { find: /^@quatrain\/api-client$/, replacement: path.resolve(__dirname, '../../packages/api-client/src/index.ts') },
       { find: /^@quatrain\/backend$/, replacement: path.resolve(__dirname, '../../packages/backend/src/index.ts') },
       { find: /^@quatrain\/studio$/, replacement: path.resolve(__dirname, '../../packages/studio/src/index.ts') }
    ]
  }
})
