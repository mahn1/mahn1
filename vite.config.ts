import { defineConfig } from 'vite';

/**
 * Мини-плеер Remotion для живого просмотра в браузере.
 * `npm run dev` → открыть http://localhost:5173 (или preview-URL песочницы).
 */
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // preview-домены вида *.e2b.app должны иметь доступ
    allowedHosts: true,
    fs: { strict: false },
  },
  build: { outDir: 'dist' },
});
