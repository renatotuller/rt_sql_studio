import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import connectionsRouter from './routes/connections.js';
import schemaRouter from './routes/schema.js';
import monitoringRouter from './routes/monitoring.js';
import openaiRouter from './routes/openai.js';
import uiRouter from './routes/ui.js';
import queryRouter from './routes/query.js';
import { handleMonitoring, cleanupMonitoring } from './ws/monitoring-handler.js';
import { ConnectionManager } from './db/connection-manager.js';
import { connectionStorage } from './storage/connections.js';
import { openAIConfigStorage } from './storage/openai-config.js';
import { uiConfigStorage } from './storage/ui-config.js';

// Carregar .env da raiz do projeto
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = resolve(__dirname, '../..');

dotenv.config({ path: resolve(rootDir, '.env') });

const app = express();
const port = process.env.BACKEND_PORT || process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Rotas
app.use('/api/connections', connectionsRouter);
app.use('/api/schema', schemaRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/openai', openaiRouter);
app.use('/api/ui', uiRouter);
app.use('/api/query', queryRouter);

// WebSocket Server
const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('Cliente WebSocket conectado');

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'monitoring') {
        handleMonitoring(ws, message.payload);
      }
    } catch (error) {
      console.error('Erro ao processar mensagem WebSocket:', error);
      ws.send(JSON.stringify({ error: 'Mensagem inválida' }));
    }
  });

  ws.on('close', () => {
    console.log('Cliente WebSocket desconectado');
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Encerrando servidor...');
  cleanupMonitoring();
  await ConnectionManager.closeAll();
  server.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Encerrando servidor...');
  cleanupMonitoring();
  await ConnectionManager.closeAll();
  server.close();
  process.exit(0);
});

// Inicializar storage e iniciar servidor
async function startServer() {
  try {
    console.log('\n🔧 [Server] Inicializando servidor...');
    console.log(`📦 [Server] Carregando conexões...`);
    await connectionStorage.initialize();
    const connectionsCount = connectionStorage.getAll().length;
    console.log(`✅ [Server] ${connectionsCount} conexão(ões) carregada(s)`);
    
    console.log(`📦 [Server] Inicializando cache de schemas...`);
    const { schemaCacheStorage } = await import('./storage/schema-cache.js');
    await schemaCacheStorage.initialize();
    console.log(`✅ [Server] Cache de schemas inicializado`);
    
    console.log(`📦 [Server] Carregando configuração OpenAI...`);
    await openAIConfigStorage.initialize();
    const openAIConfig = openAIConfigStorage.get();
    if (openAIConfig) {
      console.log(`✅ [Server] Configuração OpenAI encontrada (Modelo: ${openAIConfig.model || 'gpt-4o-mini'})`);
    } else {
      console.log(`ℹ️  [Server] Configuração OpenAI não encontrada (opcional)`);
    }
    
    console.log(`📦 [Server] Carregando configuração UI...`);
    await uiConfigStorage.initialize();
    console.log(`✅ [Server] Configuração UI inicializada`);
    
    server.listen(port, () => {
      console.log(`\n🚀 [Server] RT SQL Studio Backend iniciado com sucesso!`);
      console.log(`   📍 HTTP: http://localhost:${port}`);
      console.log(`   📡 WebSocket: ws://localhost:${port}`);
      console.log(`   🔌 Endpoints disponíveis:`);
      console.log(`      - GET  /health`);
      console.log(`      - GET  /api/connections`);
      console.log(`      - POST /api/connections`);
      console.log(`      - GET  /api/schema/:connId`);
      console.log(`      - GET  /api/schema/:connId/graph`);
      console.log(`      - POST /api/query/:connId/execute`);
      console.log(`      - GET  /api/openai/config`);
      console.log(`      - POST /api/openai/config`);
      console.log(`      - POST /api/openai/generate-sql`);
      console.log(`      - POST /api/openai/execute-sql`);
      console.log(`\n✨ [Server] Pronto para receber requisições!\n`);
    });
  } catch (error) {
    console.error('❌ [Server] Erro ao inicializar storage:', error);
    process.exit(1);
  }
}

startServer();


