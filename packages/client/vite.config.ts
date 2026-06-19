import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Backend to proxy API + WebSocket to (so the Mini App uses a single origin and
// needs only ONE https tunnel in front of Vite). Override with VITE_PROXY_TARGET.
const target = process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    // Allow arbitrary tunnel hostnames (ngrok/cloudflared) to reach the dev server.
    allowedHosts: true,
    proxy: {
      '/auth': target,
      '/me': target,
      '/rooms': target,
      '/health': target,
      '/clienterror': target,
      '/ws': { target, ws: true },
    },
  },
});
