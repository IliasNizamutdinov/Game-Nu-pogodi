/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const phoneFile = mode === 'phone';
  return {
  base: phoneFile ? './' : '/Game-Nu-pogodi/',
  plugins: phoneFile
    ? []
    : [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: [
        'icons/favicon.png',
        'icons/icon-192.png',
        'icons/icon-512.png',
        'icons/icon-maskable-512.png',
      ],
      manifest: {
        name: 'Nu, Pogodi! — Wolf and Eggs',
        short_name: 'Wolf & Eggs',
        description: 'Catch eggs in a pocket game inspired by the classic Nu, Pogodi! electronic toy.',
        theme_color: '#4a1c14',
        background_color: '#140e0b',
        display: 'standalone',
        display_override: ['fullscreen', 'standalone'],
        start_url: './',
        scope: './',
        lang: 'en',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,ico}'],
        navigateFallback: 'index.html',
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  build: phoneFile ? { outDir: 'dist-phone', emptyOutDir: true } : undefined,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
};
});
