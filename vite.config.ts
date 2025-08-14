import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon-192.png','icon-512.png','favicon.ico','favicon-32.png','apple-touch-icon.png'],
      manifest: {
        name: 'SelfDev Notes',
        short_name: 'SelfDev',
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
          params: { title: 'title', text: 'text', url: 'url' }
        }
      }
    })
  ]
})
