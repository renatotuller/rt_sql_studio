import { WebSocket } from 'ws';
import { ConnectionManager } from '../db/connection-manager.js';
import { MySQLIntrospector } from '../db/mysql-introspector.js';
import { SQLServerIntrospector } from '../db/sqlserver-introspector.js';
import type { DatabaseConnection } from '../types/index.js';

interface MonitoringMessage {
  type: 'subscribe' | 'unsubscribe';
  connId: string;
}

const activeSubscriptions = new Map<string, Set<WebSocket>>();
const intervals = new Map<string, NodeJS.Timeout>();

export function handleMonitoring(ws: WebSocket, message: MonitoringMessage) {
  if (message.type === 'subscribe') {
    if (!activeSubscriptions.has(message.connId)) {
      activeSubscriptions.set(message.connId, new Set());
    }
    activeSubscriptions.get(message.connId)!.add(ws);

    // Iniciar polling se ainda não estiver ativo
    if (!intervals.has(message.connId)) {
      startPolling(message.connId);
    }

    // Limpar quando cliente desconectar
    ws.on('close', () => {
      const subs = activeSubscriptions.get(message.connId);
      if (subs) {
        subs.delete(ws);
        if (subs.size === 0) {
          stopPolling(message.connId);
        }
      }
    });
  } else if (message.type === 'unsubscribe') {
    const subs = activeSubscriptions.get(message.connId);
    if (subs) {
      subs.delete(ws);
      if (subs.size === 0) {
        stopPolling(message.connId);
      }
    }
  }
}

async function startPolling(connId: string) {
  const { connectionStorage } = await import('../storage/connections.js');
  const conn = connectionStorage.get(connId);
  
  if (!conn) {
    return;
  }

  const interval = setInterval(async () => {
    try {
      let queries;
      if (conn.type === 'mysql') {
        const pool = await ConnectionManager.getMySQLPool(conn);
        const introspector = new MySQLIntrospector(pool);
        queries = await introspector.getActiveQueries();
      } else {
        const pool = await ConnectionManager.getSQLServerPool(conn);
        const introspector = new SQLServerIntrospector(pool);
        queries = await introspector.getActiveQueries();
      }

      const subs = activeSubscriptions.get(connId);
      if (subs) {
        const message = JSON.stringify({
          type: 'active-queries',
          data: queries,
          timestamp: new Date().toISOString(),
        });

        // Enviar para todos os clientes inscritos
        for (const client of subs) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(message);
          }
        }
      }
    } catch (error) {
      console.error(`Erro ao fazer polling para ${connId}:`, error);
    }
  }, 2000); // Polling a cada 2 segundos

  intervals.set(connId, interval);
}

function stopPolling(connId: string) {
  const interval = intervals.get(connId);
  if (interval) {
    clearInterval(interval);
    intervals.delete(connId);
  }
  activeSubscriptions.delete(connId);
}

export function cleanupMonitoring() {
  for (const interval of intervals.values()) {
    clearInterval(interval);
  }
  intervals.clear();
  activeSubscriptions.clear();
}

