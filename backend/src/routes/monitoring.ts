import { Router, type Request, type Response } from 'express';
import { ConnectionManager } from '../db/connection-manager.js';
import { MySQLIntrospector } from '../db/mysql-introspector.js';
import { SQLServerIntrospector } from '../db/sqlserver-introspector.js';
import { connectionStorage } from '../storage/connections.js';

const router = Router();

// Queries ativas
router.get('/:connId/active-queries', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const conn = connectionStorage.get(connId);
    
    if (!conn) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

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

    res.json(queries);
  } catch (error: any) {
    console.error('Erro ao obter queries ativas:', error);
    res.status(500).json({ error: error.message || 'Erro ao obter queries ativas' });
  }
});

// Estatísticas de queries (apenas SQL Server por enquanto)
router.get('/:connId/query-stats', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const conn = connectionStorage.get(connId);
    
    if (!conn) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    if (conn.type !== 'sqlserver') {
      return res.status(400).json({ error: 'Estatísticas de queries disponíveis apenas para SQL Server' });
    }

    const pool = await ConnectionManager.getSQLServerPool(conn);
    const introspector = new SQLServerIntrospector(pool);
    const stats = await introspector.getQueryStats();

    res.json(stats);
  } catch (error: any) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: error.message || 'Erro ao obter estatísticas' });
  }
});

export default router;

