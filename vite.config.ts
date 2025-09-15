/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    }
  },
  define: {
    'import.meta.env.VITE_APP_BUILD_TIME': JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png','icon-512.png'],
      manifest: {
        name: 'Aibrary',
        short_name: 'Aibrary',
        start_url: '/',
        display: 'standalone',
        theme_color: '#3B82F6',
        background_color: '#ffffff',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ],
        share_target: {
          action: '/share',
          method: 'GET',
          
          enctype: 'application/x-www-form-urlencoded',params: { title: 'title', text: 'text', url: 'url' }
        }
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /^\/api\//, // API 요청은 네트워크만 사용
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ],
  build: {
    target: 'es2015',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          router: ['react-router-dom'],
          db: ['dexie'],
          icons: ['lucide-react']
        }
      }
    }
  }
});