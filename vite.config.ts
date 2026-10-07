import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves the build under /<repo>/; the Pages workflow sets BASE_PATH
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  // tailscale serve proxies the tailnet hostname to 127.0.0.1; Vite otherwise rejects the host header
  server: { allowedHosts: ['.jackal-betta.ts.net'] },
  preview: { allowedHosts: ['.jackal-betta.ts.net'] },
})
