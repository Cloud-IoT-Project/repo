import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'web'),
  plugins: [react(), tailwindcss()],
  build: {
    outDir: path.resolve(__dirname, 'public'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // 로컬 개발 중 /api/* 를 클라우드 API Gateway로 전달 (브라우저는 same-origin → CORS 불필요).
      // changeOrigin: execute-api 호스트로 Host 헤더 교체(필수).
      '/api': {
        target: 'https://80lefo87e5.execute-api.ap-northeast-2.amazonaws.com/prod',
        changeOrigin: true,
        secure: true,
      },
    },
  },
});
