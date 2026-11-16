import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5174,
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
    proxy: { '/api': { target: 'http://127.0.0.1:5080', changeOrigin: false } },
  },
});
