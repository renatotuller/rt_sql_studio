import { Router, Request, Response } from 'express';
import { ConnectionManager } from '../db/connection-manager.js';
import { connectionStorage } from '../storage/connections.js';

const router = Router();

/**
 * POST /api/query/:connId/execute
 * Executa uma query SQL e retorna os resultados
 */
router.post('/:connId/execute', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const { connId } = req.params;
  const { sql, limit } = req.body;

  console.log('\n⚡ [Query Execute] Iniciando execução de query...');
  console.log(`🔗 [Query Execute] Connection ID: ${connId}`);
  console.log(`📝 [Query Execute] SQL: ${sql?.substring(0, 150)}${sql?.length > 150 ? '...' : ''}`);
  console.log(`📊 [Query Execute] Limit: ${limit || 'não especificado'}`);

  try {
    // Validações básicas
    if (!sql || typeof sql !== 'string' || sql.trim().length === 0) {
      return res.status(400).json({
        error: 'Query SQL é obrigatória e não pode estar vazia',
      });
    }

    // Validar segurança da query (apenas SELECT)
    // Remover comentários do início para validar
    const sqlWithoutComments = sql.trim().replace(/^--.*$/gm, '').trim();
    const sqlUpper = sqlWithoutComments.toUpperCase();
    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE'];
    const hasDangerousKeyword = dangerousKeywords.some(keyword => sqlUpper.includes(keyword));
    
    // Verificar se começa com SELECT ou WITH (ignorando comentários)
    const startsWithSelect = sqlUpper.startsWith('SELECT');
    const startsWithWith = sqlUpper.startsWith('WITH');
    
    if (hasDangerousKeyword && !startsWithSelect && !startsWithWith) {
      console.error(`❌ [Query Execute] Query bloqueada por segurança!`);
      console.error(`   - Contém palavras perigosas: ${hasDangerousKeyword}`);
      console.error(`   - Começa com SELECT: ${startsWithSelect}`);
      console.error(`   - Começa com WITH: ${startsWithWith}`);
      console.error(`   - SQL (primeiros 200 chars): ${sql.substring(0, 200)}`);
      return res.status(400).json({
        error: 'Apenas queries SELECT são permitidas por segurança',
        details: sqlWithoutComments.length === 0 
          ? 'Query contém apenas comentários ou está vazia. Corrija os erros antes de executar.'
          : 'Por segurança, apenas queries SELECT podem ser executadas'
      });
    }
    
    if (sqlWithoutComments.length === 0) {
      return res.status(400).json({
        error: 'Query contém apenas comentários ou está vazia',
      });
    }
    
    console.log(`✅ [Query Execute] Query validada como SELECT seguro`);

    // Buscar conexão
    const connection = connectionStorage.get(connId);
    if (!connection) {
      console.error(`❌ [Query Execute] Conexão ${connId} não encontrada`);
      return res.status(404).json({
        error: 'Conexão não encontrada',
      });
    }

    console.log(`✅ [Query Execute] Conexão encontrada: ${connection.name} (${connection.type})`);

    // Executar query
    let result: any[] = [];
    const queryStartTime = Date.now();

    try {
      if (connection.type === 'mysql') {
        console.log(`🔌 [Query Execute] Usando pool MySQL...`);
        try {
          const pool = await ConnectionManager.getMySQLPool(connection);
          console.log(`✅ [Query Execute] Pool MySQL obtido com sucesso`);
          const [rows] = await pool.query(sql);
          result = Array.isArray(rows) ? rows : [];
        } catch (poolError: any) {
          console.error(`❌ [Query Execute] Erro ao obter pool MySQL:`, poolError);
          throw poolError;
        }
      } else if (connection.type === 'sqlserver') {
        console.log(`🔌 [Query Execute] Usando pool SQL Server...`);
        try {
          const pool = await ConnectionManager.getSQLServerPool(connection);
          console.log(`✅ [Query Execute] Pool SQL Server obtido com sucesso`);
          const request = pool.request();
          
          // Configurar timeout de 60 segundos para a query
          request.timeout = 60000;
          const queryResult = await request.query(sql);
          result = queryResult.recordset || [];
        } catch (poolError: any) {
          console.error(`❌ [Query Execute] Erro ao obter pool SQL Server:`, poolError);
          throw poolError;
        }
      } else {
        console.error(`❌ [Query Execute] Tipo de banco não suportado: ${connection.type}`);
        return res.status(400).json({
          error: 'Tipo de banco de dados não suportado',
        });
      }

      const queryTime = Date.now() - queryStartTime;
      console.log(`✅ [Query Execute] Query executada em ${queryTime}ms`);

      // Aplicar limite se especificado
      const maxLimit = limit && typeof limit === 'number' && limit > 0 ? Math.min(limit, 10000) : 1000;
      const totalRows = result.length;
      const limitedResult = result.slice(0, maxLimit);
      const hasMore = totalRows > maxLimit;

      const totalTime = Date.now() - startTime;
      console.log(`📊 [Query Execute] Resultados: ${totalRows} linhas total, ${limitedResult.length} exibidas${hasMore ? ` (limitado a ${maxLimit})` : ''}`);
      console.log(`✨ [Query Execute] Processo concluído em ${totalTime}ms!\n`);

      res.json({
        rows: limitedResult,
        columns: limitedResult.length > 0 ? Object.keys(limitedResult[0]) : [],
        totalRows,
        hasMore,
        executionTime: queryTime,
        totalTime,
      });
    } catch (dbError: any) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ [Query Execute] Erro ao executar query após ${totalTime}ms:`);
      console.error(`   - Tipo: ${dbError.name || 'Unknown'}`);
      console.error(`   - Mensagem: ${dbError.message || 'Erro desconhecido'}`);
      if (dbError.code) {
        console.error(`   - Código: ${dbError.code}`);
      }
      if (dbError.number) {
        console.error(`   - Número SQL: ${dbError.number}`);
      }
      if (dbError.stack) {
        console.error(`   - Stack: ${dbError.stack}`);
      }
      console.log(`\n`);

      // Extrair mensagem de erro mais amigável
      let errorMessage = 'Erro ao executar query';
      if (dbError.message) {
        errorMessage = dbError.message;
      } else if (typeof dbError === 'string') {
        errorMessage = dbError;
      }

      res.status(500).json({
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? dbError.stack : undefined,
      });
    }
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [Query Execute] Erro geral após ${totalTime}ms:`, error);
    res.status(500).json({
      error: 'Erro ao processar requisição',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

export default router;

