import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Dev port aligns with production nginx staff server (deploy/nginx.conf listen 4603).
  server: {
    port: 4603,
    proxy: {
      '/api': {
        target: 'http://localhost:4601',
        changeOrigin: true,
      },
    },
  },
});
