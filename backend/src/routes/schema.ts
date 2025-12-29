import { Router, type Request, type Response } from 'express';
import { ConnectionManager } from '../db/connection-manager.js';
import { MySQLIntrospector } from '../db/mysql-introspector.js';
import { SQLServerIntrospector } from '../db/sqlserver-introspector.js';
import { connectionStorage } from '../storage/connections.js';
import { schemaCacheStorage } from '../storage/schema-cache.js';
import { introspectAndCache } from '../utils/schema-introspection.js';

const router = Router();

// Obter schema completo (usa cache se disponível)
router.get('/:connId', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const conn = connectionStorage.get(connId);
    
    if (!conn) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    // Tentar obter do cache
    const cache = await schemaCacheStorage.get(connId);
    if (cache) {
      console.log(`[Schema] Retornando schema do cache para ${connId}`);
      return res.json(cache.schema);
    }

    // Se não há cache, retornar erro pedindo para atualizar
    console.log(`[Schema] Cache não encontrado para ${connId}`);
    return res.status(404).json({ 
      error: 'Estrutura do banco não foi carregada ainda',
      message: 'Por favor, clique no botão "Atualizar" para carregar a estrutura e relacionamentos do banco de dados',
      requiresRefresh: true
    });
  } catch (error: any) {
    console.error('Erro ao obter schema:', error);
    res.status(500).json({ error: error.message || 'Erro ao obter schema' });
  }
});

// Obter grafo (diagrama ER) - usa cache se disponível
router.get('/:connId/graph', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const conn = connectionStorage.get(connId);
    
    if (!conn) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    // Tentar obter do cache
    const cache = await schemaCacheStorage.get(connId);
    if (cache) {
      console.log(`[Schema] Retornando grafo do cache para ${connId}`);
      return res.json(cache.graph);
    }

    // Se não há cache, retornar erro pedindo para atualizar
    console.log(`[Schema] Cache não encontrado para ${connId}`);
    return res.status(404).json({ 
      error: 'Estrutura do banco não foi carregada ainda',
      message: 'Por favor, clique no botão "Atualizar" para carregar a estrutura e relacionamentos do banco de dados',
      requiresRefresh: true
    });
  } catch (error: any) {
    console.error('Erro geral ao obter grafo:', error);
    res.status(500).json({ 
      error: error.message || 'Erro ao obter grafo',
      details: error.stack && process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Atualizar estrutura e relacionamentos (força nova introspecção)
router.post('/:connId/refresh', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const conn = connectionStorage.get(connId);
    
    if (!conn) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    console.log(`[Schema] Iniciando atualização de cache para ${connId}`);
    
    // Fazer introspecção e salvar no cache
    const { schema, graph } = await introspectAndCache(conn);
    
    // Obter metadados atualizados
    const cacheMetadata = await schemaCacheStorage.getMetadata(connId);
    
    res.json({
      success: true,
      message: 'Estrutura e relacionamentos atualizados com sucesso',
      cacheMetadata: cacheMetadata || null,
      metadata: {
        tables: schema.tables.length,
        views: schema.views.length,
        foreignKeys: schema.foreignKeys.length,
        nodes: graph.nodes.length,
        edges: graph.edges.length,
      },
    });
  } catch (error: any) {
    console.error('Erro ao atualizar estrutura:', error);
    res.status(500).json({ 
      error: error.message || 'Erro ao atualizar estrutura',
      details: error.stack && process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Obter metadados do cache (última atualização)
router.get('/:connId/cache-metadata', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const metadata = await schemaCacheStorage.getMetadata(connId);
    
    if (!metadata) {
      return res.status(404).json({ error: 'Cache não encontrado' });
    }
    
    res.json(metadata);
  } catch (error: any) {
    console.error('Erro ao obter metadados do cache:', error);
    res.status(500).json({ error: error.message || 'Erro ao obter metadados' });
  }
});

// Obter estatísticas do schema (tabelas, views, última atualização)
router.get('/:connId/stats', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const cache = await schemaCacheStorage.get(connId);
    
    if (!cache) {
      return res.json({
        hasCache: false,
        lastUpdated: null,
        tables: 0,
        views: 0,
        foreignKeys: 0,
        nodes: 0,
        edges: 0,
      });
    }
    
    res.json({
      hasCache: true,
      lastUpdated: cache.metadata.lastUpdated,
      tables: cache.schema.tables.length,
      views: cache.schema.views.length,
      foreignKeys: cache.schema.foreignKeys.length,
      nodes: cache.graph.nodes.length,
      edges: cache.graph.edges.length,
    });
  } catch (error: any) {
    console.error('Erro ao obter estatísticas do schema:', error);
    res.status(500).json({ error: error.message || 'Erro ao obter estatísticas' });
  }
});

// Gerar DDL
router.get('/:connId/ddl', async (req: Request, res: Response) => {
  try {
    const { connId } = req.params;
    const conn = connectionStorage.get(connId);
    
    if (!conn) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    let ddl: string;
    if (conn.type === 'mysql') {
      const pool = await ConnectionManager.getMySQLPool(conn);
      const introspector = new MySQLIntrospector(pool);
      ddl = await introspector.getDDL(conn.database);
    } else {
      const pool = await ConnectionManager.getSQLServerPool(conn);
      const introspector = new SQLServerIntrospector(pool);
      ddl = await introspector.getDDL(conn.database);
    }

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(ddl);
  } catch (error: any) {
    console.error('Erro ao gerar DDL:', error);
    res.status(500).json({ error: error.message || 'Erro ao gerar DDL' });
  }
});

export default router;

