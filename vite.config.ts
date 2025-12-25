import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import monacoEditorPlugin from 'vite-plugin-monaco-editor';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Optimize Monaco Editor - only include essential languages
    monacoEditorPlugin({
      languageWorkers: ['editorWorkerService', 'json', 'typescript'],
      customWorkers: [
        {
          label: 'json',
          entry: 'monaco-editor/esm/vs/language/json/json.worker'
        },
        {
          label: 'typescript',
          entry: 'monaco-editor/esm/vs/language/typescript/ts.worker'
        }
      ]
    })
  ],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Enable advanced optimizations
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
      },
    },
    // Code splitting and chunk optimization
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor libraries
          'react-vendor': ['react', 'react-dom'],
          'monaco-editor': ['@monaco-editor/react'],
          'ui-vendor': ['@headlessui/react', '@heroicons/react'],
          'api-vendor': ['mongodb', 'kafkajs'],
          'crypto-vendor': ['openpgp', 'jwt-decode'],
          'utils-vendor': ['diff', 'jszip']
        },
        // Optimize chunk file names
        chunkFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'index') {
            return 'assets/app-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    },
    // Increase chunk size warning limit (we'll manually optimize)
    chunkSizeWarningLimit: 1000,
    // Enable source maps for debugging but smaller ones
    sourcemap: false, // Disable for smaller builds
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@monaco-editor/react',
      '@headlessui/react'
    ],
    exclude: [
      // Exclude large dependencies that aren't needed immediately
      'mongodb',
      'kafkajs'
    ]
  }
})
