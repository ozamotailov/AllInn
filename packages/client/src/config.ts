// Backend base URL. In dev, point VITE_API_URL at your server (or its tunnel).
export const API_URL: string =
  import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
