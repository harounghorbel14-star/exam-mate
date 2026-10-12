import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

const DEMO = !!process.env.VITE_DEMO;

export default defineConfig({
  // Demo build: relative asset paths, no service worker (for static hosting without the API).
  base: DEMO ? './' : '/',
  resolve: {
    dedupe: ['react', 'react-dom'],
    // Consume the shared core from source so the app always matches it.
    alias: [
      { find: /^@exammate\/core$/, replacement: path.resolve(__dirname, '../../packages/core/src/index.ts') },
      { find: /^@exammate\/core\/(.*)$/, replacement: path.resolve(__dirname, '../../packages/core/src/$1') },
    ],
  },
  plugins: [
    react(),
    !DEMO && VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'ExamMate AI',
        short_name: 'ExamMate',
        description: 'Private study companion: solver, documents, practice exams, flashcards and 15 offline games.',
        theme_color: '#0b1220',
        background_color: '#0b1220',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
      workbox: {
        // The whole app shell (including the games, local solver and tools) is precached for offline use.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['ocr/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/],
        runtimeCaching: [
          // Offline OCR assets are large, so they are cached on first use instead of precached.
          { urlPattern: /\/ocr\//, handler: 'CacheFirst', options: { cacheName: 'ocr-assets', expiration: { maxEntries: 20 } } },
          { urlPattern: /\/api\/progress\/packs/, handler: 'StaleWhileRevalidate', options: { cacheName: 'content-packs' } },
        ],
      },
    }),
  ],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000', '/ws': { target: 'ws://localhost:4000', ws: true } } },
  preview: { port: 4173, proxy: { '/api': 'http://localhost:4000', '/ws': { target: 'ws://localhost:4000', ws: true } } },
  build: { target: 'es2022', sourcemap: false, chunkSizeWarningLimit: 1500 },
  test: { environment: 'jsdom', include: ['src/**/*.test.{ts,tsx}'], setupFiles: ['./src/test/setup.ts'] },
} as never);
