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
      // 💡 [수정] 서비스 워커 생성 전략을 변경합니다.
      // 'generateSW' 대신 'injectManifest'를 사용하여 우리가 만든 SW 파일을 사용합니다.
      strategies: 'injectManifest',
      srcDir: 'public', // 서비스 워커 파일이 있는 디렉토리
      filename: 'sw.js',  // 우리가 만든 서비스 워커 파일 이름

      registerType: 'autoUpdate',
      
      // 💡 [수정] Manifest 설정을 여기서 명확하게 정의합니다.
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
        // 💡 [수정] 파일 공유를 위한 share_target 설정
        share_target: {
          action: '/share-target', // SW에서 처리할 경로
          method: 'POST',
          enctype: 'multipart/form-data',
          params: {
            files: [{
              name: 'shared_file', // SW에서 formData.get()으로 사용할 키
              accept: ['application/json', '.json'],
            }],
          },
        },
        // 💡 [추가] File Handling API 설정
        file_handlers: [
          {
            action: '/handle-opened-file',
            accept: {
              'application/json': ['.json'],
            },
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