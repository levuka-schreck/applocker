import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Include specific polyfills
      include: ['stream', 'buffer', 'process', 'util', 'events', 'crypto'],
      // Whether to polyfill `node:` protocol imports
      protocolImports: true,
      // Whether to polyfill specific globals
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    })
  ],
  define: {
    'process.env': {},
    global: 'globalThis',
  },
  resolve: {
    alias: {
      stream: 'stream-browserify',
      buffer: 'buffer',
      util: 'util',
      process: 'process/browser',
      events: 'events',
      crypto: 'browserify',
    }
  },
  optimizeDeps: {
    include: ['buffer', 'process', 'events', 'stream-browserify', 'util', 'crypto-browserify'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      },
      plugins: []
    }
  },
  build: {
    rollupOptions: {
      plugins: []
    },
    commonjsOptions: {
      transformMixedEsModules: true
    }
  }
})
