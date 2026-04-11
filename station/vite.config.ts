import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/postcss'

// PostCSS is inlined so dev/build always use @tailwindcss/postcss (Tailwind v4),
// even if postcss.config.* resolution fails for the current cwd/toolchain.
export default defineConfig({
  plugins: [react()],
  css: {
    postcss: {
      plugins: [tailwindcss()],
    },
  },
  // Dev port aligns with production nginx station server (deploy/nginx.conf listen 4605).
  server: {
    port: 4605,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  // SPA fallback so /confirm?token=xxx routes to index.html
  appType: 'spa',
})
