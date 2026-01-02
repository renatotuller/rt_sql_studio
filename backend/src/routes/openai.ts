import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { openAIConfigStorage } from '../storage/openai-config.js';
import { ConnectionManager } from '../db/connection-manager.js';
import { MySQLIntrospector } from '../db/mysql-introspector.js';
import { SQLServerIntrospector } from '../db/sqlserver-introspector.js';
import { connectionStorage } from '../storage/connections.js';

const router = Router();

const configSchema = z.object({
  apiKey: z.string().min(1, 'API Key é obrigatória'),
  model: z.string().optional().default('gpt-4o-mini'),
  maxTokens: z.number().int().positive().optional().default(2000),
  temperature: z.number().min(0).max(2).optional().default(0.3),
});

// Obter configuração atual
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = openAIConfigStorage.get();
    if (!config) {
      return res.json({ configured: false });
    }
    
    // Não retornar a API key completa por segurança (mostrar apenas últimos 4 caracteres)
    const maskedKey = config.apiKey.length > 4 
      ? `sk-...${config.apiKey.slice(-4)}`
      : '***';
    
    res.json({
      configured: true,
      apiKey: maskedKey,
      model: config.model || 'gpt-4o-mini',
      maxTokens: config.maxTokens || 2000,
      temperature: config.temperature || 0.3,
    });
  } catch (error) {
    console.error('Erro ao obter configuração OpenAI:', error);
    res.status(500).json({ error: 'Erro ao obter configuração' });
  }
});

// Salvar configuração
router.post('/config', async (req: Request, res: Response) => {
  try {
    const data = configSchema.parse(req.body);
    await openAIConfigStorage.set(data);
    res.json({ success: true, message: 'Configuração salva com sucesso' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao salvar configuração OpenAI:', error);
    res.status(500).json({ error: 'Erro ao salvar configuração' });
  }
});

// Testar configuração (validar API key)
router.post('/config/test', async (req: Request, res: Response) => {
  try {
    const data = configSchema.parse(req.body);
    
    // Fazer uma chamada simples à API para validar a key
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${data.apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
      return res.status(400).json({
        valid: false,
        error: errorData.error?.message || 'API Key inválida ou sem permissão',
      });
    }

    res.json({ valid: true, message: 'API Key válida' });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error('Erro ao testar configuração OpenAI:', error);
    res.status(500).json({ 
      valid: false,
      error: error instanceof Error ? error.message : 'Erro ao testar configuração' 
    });
  }
});

// Gerar SQL a partir de prompt
router.post('/generate-sql', async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log('\n🤖 [OpenAI] Iniciando geração de SQL...');
  console.log(`📝 [OpenAI] Prompt recebido: "${req.body.prompt?.substring(0, 100)}${req.body.prompt?.length > 100 ? '...' : ''}"`);
  console.log(`🔗 [OpenAI] Connection ID: ${req.body.connId}`);
  
  try {
    const { prompt, connId } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim() === '') {
      console.log('❌ [OpenAI] Erro: Prompt vazio ou inválido');
      return res.status(400).json({ error: 'Prompt é obrigatório' });
    }

    if (!connId || typeof connId !== 'string') {
      console.log('❌ [OpenAI] Erro: Connection ID inválido');
      return res.status(400).json({ error: 'ID da conexão é obrigatório' });
    }

    // Verificar se a configuração OpenAI existe
    console.log('🔍 [OpenAI] Verificando configuração...');
    const config = openAIConfigStorage.get();
    if (!config || !config.apiKey) {
      console.log('❌ [OpenAI] Erro: Configuração OpenAI não encontrada');
      return res.status(400).json({ 
        error: 'Configuração OpenAI não encontrada',
        details: 'Configure a API Key da OpenAI nas configurações primeiro'
      });
    }
    console.log(`✅ [OpenAI] Configuração encontrada - Modelo: ${config.model || 'gpt-4o-mini'}, MaxTokens: ${config.maxTokens || 2000}, Temperature: ${config.temperature || 0.3}`);

    // Obter conexão do storage
    console.log(`🔍 [OpenAI] Buscando conexão ${connId}...`);
    const connection = connectionStorage.get(connId);
    if (!connection) {
      console.log(`❌ [OpenAI] Erro: Conexão ${connId} não encontrada`);
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }
    console.log(`✅ [OpenAI] Conexão encontrada: ${connection.name} (${connection.type}) - Database: ${connection.database}`);

    // Obter schema do banco (usar cache)
    console.log(`📊 [OpenAI] Obtendo schema do banco de dados...`);
    let schemaInfo;
    try {
      const { schemaCacheStorage } = await import('../storage/schema-cache.js');
      const cache = await schemaCacheStorage.get(connId);
      
      if (cache) {
        console.log(`✅ [OpenAI] Schema obtido do cache: ${cache.schema.tables.length} tabelas, ${cache.schema.foreignKeys.length} foreign keys, ${cache.schema.views.length} views`);
        schemaInfo = cache.schema;
      } else {
        console.error(`❌ [OpenAI] Cache não encontrado para ${connId}`);
        return res.status(404).json({ 
          error: 'Estrutura do banco não foi carregada ainda',
          message: 'Por favor, atualize a estrutura do banco de dados antes de usar a consulta IA',
          requiresRefresh: true
        });
      }
    } catch (error: any) {
      console.error(`❌ [OpenAI] Erro ao obter schema: ${error.message}`);
      return res.status(500).json({ 
        error: 'Erro ao obter schema do banco',
        details: error.message 
      });
    }

    // Montar contexto do schema para a IA (otimizado para reduzir tokens)
    // Estratégia: Enviar apenas informações essenciais, priorizando PKs e FKs
    // Redução agressiva: máximo 10 colunas por tabela, formato ultra-compacto
    const schemaContext = {
      db: connection.type, // Abreviado
      name: connection.database, // Abreviado
      // Reduzir informações das tabelas: apenas nome, colunas principais e tipos
      tables: schemaInfo.tables.map(table => {
        // Priorizar: PKs primeiro, depois FKs, depois outras colunas (máx 10 por tabela)
        const pkColumns = table.columns.filter(col => col.isPrimaryKey);
        const fkColumns = table.columns.filter(col => col.isForeignKey && !col.isPrimaryKey);
        const otherColumns = table.columns.filter(col => !col.isPrimaryKey && !col.isForeignKey).slice(0, 5);
        const selectedColumns = [...pkColumns, ...fkColumns, ...otherColumns].slice(0, 10);
        
        return {
          n: table.name, // Abreviado
          // Apenas colunas essenciais: nome, tipo, se é PK (formato compacto)
          cols: selectedColumns.map(col => {
            const colObj: any = { n: col.name, t: col.type }; // Abreviado
            if (col.isPrimaryKey) colObj.pk = true;
            return colObj;
          }),
        };
      }),
      // Foreign keys são essenciais para JOINs - formato ultra-compacto
      fks: schemaInfo.foreignKeys.map(fk => ({
        f: `${fk.fromTable}.${fk.fromColumn}`, // from
        t: `${fk.toTable}.${fk.toColumn}`, // to
      })),
    };
    
    // Estimar tamanho do contexto (aproximado: ~4 chars por token)
    const contextString = JSON.stringify(schemaContext);
    const estimatedTokens = Math.ceil(contextString.length / 4);
    console.log(`📊 [OpenAI] Schema otimizado: ${schemaInfo.tables.length} tabelas, ${schemaInfo.foreignKeys.length} FKs`);
    console.log(`📏 [OpenAI] Tamanho estimado: ~${estimatedTokens.toLocaleString()} tokens (${(contextString.length / 1024).toFixed(2)} KB)`);
    
    if (estimatedTokens > 150000) {
      console.warn(`⚠️  [OpenAI] Schema muito grande (${estimatedTokens.toLocaleString()} tokens). Pode exceder limites do modelo.`);
      console.warn(`   💡 Considere usar gpt-4o que tem limite maior (500k tokens/min)`);
    }

    // Preparar prompt para OpenAI (compacto)
    const systemPrompt = `Você é um especialista em SQL para ${connection.type === 'mysql' ? 'MySQL' : 'SQL Server'}.

Gere queries SELECT baseadas em descrições em linguagem natural e no schema fornecido.

REGRAS:
1. APENAS SELECT (nunca INSERT, UPDATE, DELETE, DROP)
2. Use nomes exatos de tabelas/colunas do schema
3. Respeite relacionamentos (fks)
4. Use JOINs quando necessário
5. SQL válido e otimizado
6. Filtros → WHERE, agrupamento → GROUP BY, ordenação → ORDER BY
7. Retorne APENAS SQL, sem explicações
8. Aspas simples para strings

Schema (formato compacto):
- db: tipo do banco
- name: nome do banco
- tables: array de tabelas (n=nome, cols=colunas onde n=nome, t=tipo, pk=primary key)
- fks: foreign keys (f=from, t=to)

${JSON.stringify(schemaContext)}`;

    const userPrompt = `Gere uma query SQL SELECT para: ${prompt}`;
    const schemaContextSize = JSON.stringify(schemaContext).length;
    console.log(`📦 [OpenAI] Contexto do schema preparado (${(schemaContextSize / 1024).toFixed(2)} KB)`);
    console.log(`🚀 [OpenAI] Enviando requisição para OpenAI API...`);
    console.log(`   - Modelo: ${config.model || 'gpt-4o-mini'}`);
    console.log(`   - Max Tokens: ${config.maxTokens || 2000}`);
    console.log(`   - Temperature: ${config.temperature || 0.3}`);

    // Chamar API da OpenAI
    try {
      const apiStartTime = Date.now();
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: config.maxTokens || 2000,
          temperature: config.temperature || 0.3,
        }),
      });

      const apiElapsedTime = Date.now() - apiStartTime;
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { type?: string; message?: string } };
        const errorType = errorData.error?.type || 'unknown';
        const errorMessage = errorData.error?.message || 'Erro desconhecido';
        
        console.error(`❌ [OpenAI] Erro na API: Status ${response.status}`);
        console.error(`   - Mensagem: ${errorMessage}`);
        console.error(`   - Tipo: ${errorType}`);
        
        // Tratamento específico para diferentes tipos de erro 429
        if (response.status === 429) {
          if (errorType === 'insufficient_quota' || errorMessage.includes('quota')) {
            console.error(`   ⚠️  QUOTA INSUFICIENTE: Você não tem créditos suficientes na sua conta OpenAI.`);
            console.error(`   💡 Solução: Adicione créditos em https://platform.openai.com/account/billing`);
            return res.status(response.status).json({
              error: 'Quota insuficiente na OpenAI',
              details: 'Você não tem créditos suficientes na sua conta OpenAI. Adicione créditos em https://platform.openai.com/account/billing',
              errorType: 'insufficient_quota',
              helpUrl: 'https://platform.openai.com/account/billing',
            });
          } else if (errorType === 'tokens' || errorMessage.includes('tokens per min') || errorMessage.includes('TPM')) {
            // Extrair informações do erro
            const limitMatch = errorMessage.match(/Limit (\d+)/);
            const requestedMatch = errorMessage.match(/Requested (\d+)/);
            const limit = limitMatch ? parseInt(limitMatch[1]) : null;
            const requested = requestedMatch ? parseInt(requestedMatch[1]) : null;
            
            console.error(`   ⚠️  LIMITE DE TOKENS POR MINUTO EXCEDIDO (TPM)`);
            if (limit && requested) {
              console.error(`   📊 Limite: ${limit.toLocaleString()} tokens/min | Requisitado: ${requested.toLocaleString()} tokens`);
              console.error(`   📉 Excesso: ${(requested - limit).toLocaleString()} tokens (${((requested / limit - 1) * 100).toFixed(1)}% acima do limite)`);
            }
            console.error(`   💡 Solução: O schema do banco é muito grande. Aguarde 1 minuto ou use um modelo com maior limite.`);
            console.error(`   🔗 Ver limites: https://platform.openai.com/account/rate-limits`);
            
            return res.status(response.status).json({
              error: 'Limite de tokens por minuto excedido',
              details: `O schema do banco de dados é muito grande (${requested?.toLocaleString() || 'muitos'} tokens). ` +
                       `O limite do modelo é ${limit?.toLocaleString() || '200.000'} tokens por minuto. ` +
                       `Aguarde 1 minuto e tente novamente, ou use um modelo com maior limite (ex: gpt-4o).`,
              errorType: 'tokens_per_minute',
              limit: limit,
              requested: requested,
              helpUrl: 'https://platform.openai.com/account/rate-limits',
            });
          } else if (errorType === 'rate_limit_exceeded' || errorMessage.includes('rate limit')) {
            console.error(`   ⚠️  RATE LIMIT EXCEDIDO: Muitas requisições em pouco tempo.`);
            console.error(`   💡 Solução: Aguarde alguns minutos antes de tentar novamente.`);
            return res.status(response.status).json({
              error: 'Rate limit excedido',
              details: 'Você atingiu o limite de requisições por minuto/hora. Aguarde alguns minutos e tente novamente.',
              errorType: 'rate_limit_exceeded',
            });
          } else {
            console.error(`   ⚠️  Limite excedido (tipo: ${errorType}). Verifique sua conta OpenAI.`);
            return res.status(response.status).json({
              error: 'Limite excedido na OpenAI',
              details: errorMessage,
              errorType: errorType,
            });
          }
        }
        
        return res.status(response.status).json({
          error: 'Erro ao chamar API da OpenAI',
          details: errorMessage,
          errorType: errorType,
        });
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
      };
      const generatedSQL = data.choices?.[0]?.message?.content?.trim() || '';

      if (!generatedSQL) {
        console.error(`❌ [OpenAI] Resposta vazia da API`);
        return res.status(500).json({ error: 'Nenhuma resposta da IA' });
      }

      // Limpar SQL (remover markdown code blocks se houver)
      let cleanSQL = generatedSQL;
      if (cleanSQL.startsWith('```sql')) {
        cleanSQL = cleanSQL.replace(/^```sql\s*/i, '').replace(/\s*```$/i, '');
      } else if (cleanSQL.startsWith('```')) {
        cleanSQL = cleanSQL.replace(/^```\s*/i, '').replace(/\s*```$/i, '');
      }

      const totalTime = Date.now() - startTime;
      const tokensUsed = data.usage?.total_tokens || 0;
      const promptTokens = data.usage?.prompt_tokens || 0;
      const completionTokens = data.usage?.completion_tokens || 0;

      console.log(`✅ [OpenAI] SQL gerado com sucesso!`);
      console.log(`   - Tempo total: ${totalTime}ms (API: ${apiElapsedTime}ms)`);
      console.log(`   - Tokens usados: ${tokensUsed} (Prompt: ${promptTokens}, Completion: ${completionTokens})`);
      console.log(`   - SQL gerado (${cleanSQL.length} caracteres): ${cleanSQL.substring(0, 100)}${cleanSQL.length > 100 ? '...' : ''}`);
      console.log(`✨ [OpenAI] Processo concluído com sucesso!\n`);

      res.json({
        sql: cleanSQL.trim(),
        model: config.model || 'gpt-4o-mini',
        tokensUsed: tokensUsed,
      });
    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ [OpenAI] Erro ao chamar OpenAI API após ${totalTime}ms:`);
      console.error(`   - Tipo: ${error.name || 'Unknown'}`);
      console.error(`   - Mensagem: ${error.message || 'Erro desconhecido'}`);
      if (error.stack) {
        console.error(`   - Stack: ${error.stack.split('\n')[0]}`);
      }
      console.log(`\n`);
      return res.status(500).json({
        error: 'Erro ao gerar SQL',
        details: error.message || 'Erro desconhecido',
      });
    }
  } catch (error: unknown) {
    const totalTime = Date.now() - startTime;
    if (error instanceof z.ZodError) {
      console.error(`❌ [OpenAI] Erro de validação após ${totalTime}ms:`, error.errors);
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error(`❌ [OpenAI] Erro geral após ${totalTime}ms:`, error);
    res.status(500).json({ 
      error: 'Erro ao gerar SQL',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Executar SQL gerado (apenas SELECT por segurança)
router.post('/execute-sql', async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log('\n⚡ [SQL Execute] Iniciando execução de query...');
  console.log(`🔗 [SQL Execute] Connection ID: ${req.body.connId}`);
  console.log(`📝 [SQL Execute] SQL: ${req.body.sql?.substring(0, 150)}${req.body.sql?.length > 150 ? '...' : ''}`);
  
  try {
    const { sql, connId } = req.body;

    if (!sql || typeof sql !== 'string' || sql.trim() === '') {
      return res.status(400).json({ error: 'SQL é obrigatório' });
    }

    if (!connId || typeof connId !== 'string') {
      return res.status(400).json({ error: 'ID da conexão é obrigatório' });
    }

    // Validar que é apenas SELECT (segurança)
    console.log(`🔒 [SQL Execute] Validando segurança da query...`);
    const sqlUpper = sql.trim().toUpperCase();
    
    // Remover comentários do início para validar
    const sqlWithoutComments = sql.trim().replace(/^--.*$/gm, '').trim();
    const sqlUpperNoComments = sqlWithoutComments.toUpperCase();
    
    const dangerousKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'TRUNCATE', 'ALTER', 'CREATE', 'EXEC', 'EXECUTE'];
    const hasDangerousKeyword = dangerousKeywords.some(keyword => sqlUpper.includes(keyword));
    
    // Verificar se começa com SELECT (ignorando comentários)
    const startsWithSelect = sqlUpperNoComments.startsWith('SELECT');
    
    if (hasDangerousKeyword || !startsWithSelect) {
      console.error(`❌ [SQL Execute] Query bloqueada por segurança!`);
      console.error(`   - Contém palavras perigosas: ${hasDangerousKeyword}`);
      console.error(`   - Começa com SELECT: ${startsWithSelect}`);
      console.error(`   - SQL (primeiros 200 chars): ${sql.substring(0, 200)}`);
      return res.status(400).json({ 
        error: 'Apenas queries SELECT são permitidas',
        details: sqlWithoutComments.length === 0 
          ? 'Query contém apenas comentários ou está vazia. Corrija os erros antes de executar.'
          : 'Por segurança, apenas queries SELECT podem ser executadas'
      });
    }
    console.log(`✅ [SQL Execute] Query validada como SELECT seguro`);

    // Obter conexão
    console.log(`🔍 [SQL Execute] Buscando conexão...`);
    const connection = connectionStorage.get(connId);
    if (!connection) {
      console.error(`❌ [SQL Execute] Conexão ${connId} não encontrada`);
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }
    console.log(`✅ [SQL Execute] Conexão encontrada: ${connection.name} (${connection.type})`);

    // Executar query
    try {
      console.log(`🚀 [SQL Execute] Executando query no banco de dados...`);
      const queryStartTime = Date.now();
      let result;
      if (connection.type === 'mysql') {
        console.log(`🔌 [SQL Execute] Usando pool MySQL...`);
        const pool = await ConnectionManager.getMySQLPool(connection);
        const [rows] = await pool.query(sql);
        result = rows;
      } else {
        console.log(`🔌 [SQL Execute] Usando pool SQL Server...`);
        const pool = await ConnectionManager.getSQLServerPool(connection);
        // Configurar timeout de 60 segundos para a query
        const request = pool.request();
        request.timeout = 60000; // 60 segundos
        const queryResult = await request.query(sql);
        result = queryResult.recordset;
      }
      const queryTime = Date.now() - queryStartTime;
      console.log(`✅ [SQL Execute] Query executada em ${queryTime}ms`);

      // Limitar resultados para evitar sobrecarga (máximo 1000 linhas)
      const limitedResult = Array.isArray(result) ? result.slice(0, 1000) : [];
      const totalRows = Array.isArray(result) ? result.length : 0;
      const hasMore = totalRows > 1000;

      const totalTime = Date.now() - startTime;
      console.log(`📊 [SQL Execute] Resultados: ${totalRows} linhas total, ${limitedResult.length} exibidas${hasMore ? ' (limitado a 1000)' : ''}`);
      console.log(`✨ [SQL Execute] Processo concluído em ${totalTime}ms!\n`);

      res.json({
        rows: limitedResult,
        columns: limitedResult.length > 0 ? Object.keys(limitedResult[0]) : [],
        totalRows,
        displayedRows: limitedResult.length,
        hasMore,
      });
    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ [SQL Execute] Erro ao executar query após ${totalTime}ms:`);
      console.error(`   - Tipo: ${error.name || 'Unknown'}`);
      console.error(`   - Mensagem: ${error.message || 'Erro desconhecido'}`);
      if (error.code) {
        console.error(`   - Código: ${error.code}`);
      }
      console.log(`\n`);
      return res.status(500).json({
        error: 'Erro ao executar query',
        details: error.message || 'Erro desconhecido',
      });
    }
  } catch (error: unknown) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [SQL Execute] Erro geral após ${totalTime}ms:`, error);
    res.status(500).json({ 
      error: 'Erro ao executar SQL',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

// Analisar SQL e sugerir melhorias
router.post('/analyze-sql', async (req: Request, res: Response) => {
  const startTime = Date.now();
  console.log('\n🔍 [OpenAI] Iniciando análise de SQL...');
  console.log(`📝 [OpenAI] SQL recebido: ${req.body.sql?.substring(0, 100)}${req.body.sql?.length > 100 ? '...' : ''}`);
  console.log(`🔗 [OpenAI] Connection ID: ${req.body.connId}`);
  
  try {
    const { sql, connId, complementaryPrompt } = req.body;

    if (!sql || typeof sql !== 'string' || sql.trim() === '') {
      return res.status(400).json({ error: 'SQL é obrigatório' });
    }

    if (!connId || typeof connId !== 'string') {
      return res.status(400).json({ error: 'ID da conexão é obrigatório' });
    }

    // Obter configuração OpenAI
    const config = openAIConfigStorage.get();
    if (!config || !config.apiKey) {
      console.error(`❌ [OpenAI] Configuração OpenAI não encontrada`);
      return res.status(400).json({ 
        error: 'Configuração OpenAI não encontrada',
        details: 'Configure a API Key da OpenAI nas configurações primeiro'
      });
    }

    // Obter conexão para identificar tipo de banco
    const connection = connectionStorage.get(connId);
    if (!connection) {
      console.error(`❌ [OpenAI] Conexão ${connId} não encontrada`);
      return res.status(404).json({ error: 'Conexão não encontrada' });
    }

    // Preparar prompt para análise
    const systemPrompt = `Você é um especialista em otimização de SQL para ${connection.type === 'mysql' ? 'MySQL' : 'SQL Server'}.

Analise a query SQL fornecida e sugira melhorias de:
1. Performance (índices, JOINs otimizados, subqueries)
2. Legibilidade (formatação, aliases, organização)
3. Boas práticas (evitar SELECT *, usar WHERE apropriado, etc)
4. Segurança (prevenção de SQL injection, validações)

Forneça sugestões práticas e específicas, explicando o motivo de cada melhoria.
Se a query já estiver bem otimizada, reconheça isso e sugira apenas pequenos ajustes.

Formato da resposta:
- Comece com um resumo geral (1-2 linhas)
- Liste as melhorias sugeridas de forma clara e objetiva
- Para cada melhoria, explique o benefício
- Se possível, forneça exemplos de código melhorado`;

    let userPrompt = `Analise esta query SQL e sugira melhorias:

\`\`\`sql
${sql}
\`\`\`

Tipo de banco: ${connection.type === 'mysql' ? 'MySQL' : 'SQL Server'}`;

    // Adicionar prompt complementar se fornecido
    if (complementaryPrompt && typeof complementaryPrompt === 'string' && complementaryPrompt.trim()) {
      userPrompt += `\n\nSolicitação específica do usuário: ${complementaryPrompt.trim()}`;
    }

    console.log(`🚀 [OpenAI] Enviando requisição para OpenAI API...`);
    console.log(`   - Modelo: ${config.model || 'gpt-4o-mini'}`);
    console.log(`   - Max Tokens: ${config.maxTokens || 2000}`);

    // Chamar API da OpenAI
    try {
      const apiStartTime = Date.now();
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: config.maxTokens || 2000,
          temperature: 0.3, // Baixa temperatura para análise mais consistente
        }),
      });

      const apiElapsedTime = Date.now() - apiStartTime;
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: { message?: string } };
        const errorMessage = errorData.error?.message || 'Erro desconhecido';
        
        console.error(`❌ [OpenAI] Erro na API: Status ${response.status}`);
        console.error(`   - Mensagem: ${errorMessage}`);
        
        return res.status(response.status).json({
          error: 'Erro ao chamar API da OpenAI',
          details: errorMessage,
        });
      }

      const data = await response.json() as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: { total_tokens?: number };
      };
      const analysis = data.choices?.[0]?.message?.content?.trim() || '';

      if (!analysis) {
        console.error(`❌ [OpenAI] Resposta vazia da API`);
        return res.status(500).json({ error: 'Nenhuma resposta da IA' });
      }

      const totalTime = Date.now() - startTime;
      const tokensUsed = data.usage?.total_tokens || 0;

      console.log(`✅ [OpenAI] Análise concluída com sucesso!`);
      console.log(`   - Tempo total: ${totalTime}ms (API: ${apiElapsedTime}ms)`);
      console.log(`   - Tokens usados: ${tokensUsed}`);
      console.log(`✨ [OpenAI] Processo concluído com sucesso!\n`);

      res.json({
        analysis: analysis,
        model: config.model || 'gpt-4o-mini',
        tokensUsed: tokensUsed,
      });
    } catch (error: any) {
      const totalTime = Date.now() - startTime;
      console.error(`❌ [OpenAI] Erro ao chamar OpenAI API após ${totalTime}ms:`);
      console.error(`   - Mensagem: ${error.message || 'Erro desconhecido'}`);
      console.log(`\n`);
      return res.status(500).json({
        error: 'Erro ao analisar SQL',
        details: error.message || 'Erro desconhecido',
      });
    }
  } catch (error: unknown) {
    const totalTime = Date.now() - startTime;
    if (error instanceof z.ZodError) {
      console.error(`❌ [OpenAI] Erro de validação após ${totalTime}ms:`, error.errors);
      return res.status(400).json({ error: 'Dados inválidos', details: error.errors });
    }
    console.error(`❌ [OpenAI] Erro geral após ${totalTime}ms:`, error);
    res.status(500).json({ 
      error: 'Erro ao analisar SQL',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    });
  }
});

export default router;

