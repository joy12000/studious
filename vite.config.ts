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
      // 서비스 워커는 public/sw.js 파일을 직접 사용하도록 하고,
      // VitePWA 플러그인은 아래 manifest 생성만 담당하도록 합니다.
      strategies: 'copy', // 단순 복사 모드
      srcDir: 'public',
      
      manifest: {
        name: 'Aibrary',
        short_name: 'Aibrary',
        description: 'Your personal AI-powered note-taking app.',
        start_url: '/',
        display: 'standalone',
        theme_color: '#3B82F6',
        background_color: '#ffffff',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
        share_target: {
          action: '/share-target',
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [{
              name: 'shared_file',
              accept: ['application/json', '.json'],
            }],
          },
        },
        file_handlers: [
          {
            action: '/handle-opened-file',
            accept: {
              'application/json': ['.json'],
            },
            launch_type: 'single-client',
          },
        ],
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