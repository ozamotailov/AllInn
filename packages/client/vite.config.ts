import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `server.host` exposes the dev server so an HTTPS tunnel (ngrok/cloudflared)
// can reach it — required to load the Mini App inside Telegram.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
