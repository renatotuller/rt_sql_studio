import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  // Carregar variáveis de ambiente da raiz do projeto
  const rootEnv = loadEnv(mode, resolve(__dirname, '../..'), '');
  
  const frontendPort = parseInt(rootEnv.FRONTEND_PORT || process.env.FRONTEND_PORT || '3000', 10);
  const backendPort = parseInt(rootEnv.BACKEND_PORT || process.env.BACKEND_PORT || '3001', 10);
  const backendUrl = rootEnv.VITE_API_URL || process.env.VITE_API_URL || `http://localhost:${backendPort}`;
  
  // Extrair apenas a URL base (sem /api)
  const backendBaseUrl = backendUrl.replace(/\/api$/, '');
  
  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      proxy: {
        '/api': {
          target: backendBaseUrl,
          changeOrigin: true,
        },
        '/ws': {
          target: backendBaseUrl.replace('http://', 'ws://').replace('https://', 'wss://'),
          ws: true,
        },
      },
    },
    build: {
      rollupOptions: {
        onwarn(warning, warn) {
          // Suprimir avisos de extensões do Chrome
          if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
          if (warning.message?.includes('chrome-extension')) return;
          warn(warning);
        },
      },
    },
  };
});

