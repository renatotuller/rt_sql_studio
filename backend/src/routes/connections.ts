import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { ConnectionManager } from '../db/connection-manager.js';
import { connectionStorage } from '../storage/connections.js';
import { introspectAndCache } from '../utils/schema-introspection.js';
import type { DatabaseConnection } from '../types/index.js';

const router = Router();

const connectionSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['mysql', 'sqlserver']),
  host: z.string().min(1),
  port: z.number().int().positive(),
  user: z.string().min(1),
  password: z.string(),
  database: z.string().min(1),
  ssl: z.boolean().optional(),
});

// Listar conexões
router.get('/', (req: Request, res: Response) => {
  const conns = connectionStorage.getAll().map(conn => ({
    ...conn,
    password: undefined, // Não retornar senha
  }));
  res.json(conns);
});

// Criar conexão
router.post('/', async (req: Request, res: Response) => {
  try {
    const data = connectionSchema.parse(req.body);
    const conn: DatabaseConnection = {
      ...data,
      id: `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    // Testar conexão
    try {
      await ConnectionManager.testConnection(conn);
    } catch (testError: any) {
      return res.status(400).json({ 
        error: 'Falha ao conectar ao banco de dados',
        details: testError.message 
      });
    }

    // Salvar conexão
    await connectionStorage.set(conn);

    // Fazer introspecção e salvar no cache (em background, não bloquear resposta)
    introspectAndCache(conn).catch((error: any) => {
      console.error(`[Connections] Erro ao fazer introspecção inicial para ${conn.id}:`, error);
      // Não falhar a criação da conexão se a introspecção falhar
      // O usuário pode atualizar manualmente depois
    });

    res.status(201).json({ ...conn, password: undefined });
    } catch (error: unknown) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
      }
      res.status(500).json({ error: 'Erro ao criar conexão' });
    }
});

// Testar conexão
router.post('/test', async (req: Request, res: Response) => {
  try {
    const data = connectionSchema.parse(req.body);
    const conn: DatabaseConnection = {
      ...data,
      id: 'test',
      createdAt: new Date(),
    };

    try {
      await ConnectionManager.testConnection(conn);
      res.json({ valid: true });
    } catch (testError: any) {
      res.status(400).json({ 
        valid: false,
        error: testError.message || 'Falha ao conectar ao banco de dados'
      });
    }
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro ao testar conexão', details: error instanceof Error ? error.message : 'Erro desconhecido' });
  }
});

// Obter conexão específica
router.get('/:id', (req: Request, res: Response) => {
  const conn = connectionStorage.get(req.params.id);
  if (!conn) {
    return res.status(404).json({ error: 'Conexão não encontrada' });
  }
  res.json({ ...conn, password: undefined });
});

// Atualizar conexão
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const existingConn = connectionStorage.get(req.params.id);
    if (!existingConn) {
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    const data = connectionSchema.parse(req.body);
    
    // Se a senha não foi fornecida, manter a senha existente
    const updatedConn: DatabaseConnection = {
      ...existingConn,
      ...data,
      password: data.password || existingConn.password, // Manter senha existente se não fornecida
    };

    // Testar conexão
    try {
      await ConnectionManager.testConnection(updatedConn);
    } catch (testError: any) {
      return res.status(400).json({ 
        error: 'Falha ao conectar ao banco de dados',
        details: testError.message 
      });
    }

    // Fechar conexão antiga se necessário
    await ConnectionManager.closeConnection(existingConn.id, existingConn.type);

    // Salvar conexão atualizada
    await connectionStorage.set(updatedConn);

    // Fazer introspecção e salvar no cache (em background)
    introspectAndCache(updatedConn).catch((error: any) => {
      console.error(`[Connections] Erro ao fazer introspecção após atualização para ${updatedConn.id}:`, error);
    });

    res.json({ ...updatedConn, password: undefined });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    res.status(500).json({ error: 'Erro ao atualizar conexão' });
  }
});

// Deletar conexão
router.delete('/:id', async (req: Request, res: Response) => {
  const conn = connectionStorage.get(req.params.id);
  if (!conn) {
    return res.status(404).json({ error: 'Conexão não encontrada' });
  }

  await ConnectionManager.closeConnection(conn.id, conn.type);
  await connectionStorage.delete(conn.id);
  
  // Deletar cache também
  const { schemaCacheStorage } = await import('../storage/schema-cache.js');
  await schemaCacheStorage.delete(conn.id);
  
  res.json({ success: true });
});

export default router;

