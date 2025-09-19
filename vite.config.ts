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
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
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
        // 💡 [수정] Web Share Target API 설정
        share_target: {
          action: '/handle-shared-note', // 데이터를 처리할 고유 경로
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [
              {
                name: 'shared_file', // 서비스 워커에서 사용할 파일의 키 이름
                accept: ['application/json', '.json'], // JSON 파일만 허용
              },
            ],
          },
        },
      },
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