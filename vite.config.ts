import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // tailscale serve proxies the tailnet hostname to 127.0.0.1; Vite otherwise rejects the host header
    allowedHosts: ['.jackal-betta.ts.net'],
  },
})
