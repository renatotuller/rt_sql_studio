import { useState, useCallback } from 'react';

interface SQLAnalysisResult {
  tables: string[];
  joins: Array<{ from: string; to: string; condition?: string }>;
  aliases: Map<string, string>; // alias -> table name
}

// Função auxiliar para extrair tabelas de uma query
function extractTablesFromQuery(
  query: string,
  tables: string[],
  aliases: Map<string, string>,
  cteAliases: Set<string>
) {
  // Normalizar espaços
  const normalized = query.replace(/\s+/g, ' ').trim();

  // Extrair tabelas de FROM (suporta schema.table, aliases, etc)
  // Padrão: FROM schema.table AS alias ou FROM table alias
  const fromRegex = /FROM\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?(?:\s+(?:AS\s+)?(\w+))?(?=\s|$|,|JOIN)/gi;
  let fromMatch;
  while ((fromMatch = fromRegex.exec(normalized)) !== null) {
    const schema = fromMatch[1];
    const table = fromMatch[2];
    const alias = fromMatch[3];
    
    // Ignorar se for um CTE
    if (!cteAliases.has(table.toLowerCase())) {
      const fullTableName = schema ? `${schema}.${table}` : table;
      tables.push(fullTableName);
      if (alias) {
        aliases.set(alias.toLowerCase(), fullTableName);
      }
      // Também mapear o nome da tabela como alias de si mesma (caso seja usado sem alias)
      aliases.set(table.toLowerCase(), fullTableName);
    }
  }

  // Extrair tabelas de JOINs (INNER JOIN, LEFT JOIN, RIGHT JOIN, etc)
  // Padrão: INNER JOIN schema.table AS alias ou LEFT JOIN table alias
  const joinRegex = /(?:INNER|LEFT|RIGHT|FULL|CROSS)?\s+JOIN\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?(?:\s+(?:AS\s+)?(\w+))?(?=\s|$|ON)/gi;
  let joinMatch;
  while ((joinMatch = joinRegex.exec(normalized)) !== null) {
    const schema = joinMatch[1];
    const table = joinMatch[2];
    const alias = joinMatch[3];
    
    // Ignorar se for um CTE
    if (!cteAliases.has(table.toLowerCase())) {
      const fullTableName = schema ? `${schema}.${table}` : table;
      tables.push(fullTableName);
      if (alias) {
        aliases.set(alias.toLowerCase(), fullTableName);
      }
      // Também mapear o nome da tabela como alias de si mesma
      aliases.set(table.toLowerCase(), fullTableName);
    }
  }
}

export function useSQLAnalysis() {
  const [highlightedTables, setHighlightedTables] = useState<Set<string>>(new Set());
  const [highlightedEdges, setHighlightedEdges] = useState<Set<string>>(new Set());
  const [analysisResult, setAnalysisResult] = useState<SQLAnalysisResult | null>(null);

  const analyzeSQL = useCallback((sqlQuery: string): SQLAnalysisResult => {
    const tables: string[] = [];
    const joins: Array<{ from: string; to: string; condition?: string }> = [];
    const aliases = new Map<string, string>();
    const cteAliases = new Set<string>(); // Para rastrear CTEs (não são tabelas reais)

    // Normalizar query: remover comentários mas manter estrutura
    let cleaned = sqlQuery
      .replace(/--.*$/gm, '') // Remove comentários de linha
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comentários de bloco
      .trim();

    // Extrair CTEs (Common Table Expressions) - WITH ... AS (...)
    // Padrão: WITH CTE_NAME AS (SELECT ...), CTE_NAME2 AS (SELECT ...)
    let finalQuery = cleaned;
    
    if (cleaned.toUpperCase().startsWith('WITH')) {
      // Encontrar o final dos CTEs (último parêntese antes do SELECT final)
      let depth = 0;
      let inCTE = false;
      let cteStart = 0;
      let lastCTEEnd = 0;
      
      for (let i = 0; i < cleaned.length; i++) {
        const char = cleaned[i];
        const upperChar = char.toUpperCase();
        const nextChars = cleaned.substring(i, Math.min(i + 6, cleaned.length)).toUpperCase();
        
        // Detectar início de CTE
        if (nextChars.startsWith('WITH') && !inCTE) {
          inCTE = true;
          cteStart = i;
          i += 3; // Pular "WITH"
          continue;
        }
        
        if (inCTE) {
          if (char === '(') {
            depth++;
          } else if (char === ')') {
            depth--;
            if (depth === 0) {
              // Fim de um CTE
              lastCTEEnd = i;
              // Verificar se há mais CTEs (vírgula seguida de outro CTE)
              const afterCTE = cleaned.substring(i + 1).trim();
              if (!afterCTE.toUpperCase().startsWith('SELECT')) {
                // Ainda há mais CTEs, continuar
                continue;
              } else {
                // Fim de todos os CTEs
                break;
              }
            }
          }
        }
      }
      
      // Extrair nomes dos CTEs e processar conteúdo
      const cteSection = cleaned.substring(cteStart, lastCTEEnd + 1);
      const cteNameRegex = /(\w+)\s+AS\s*\(/gi;
      let cteNameMatch;
      
      while ((cteNameMatch = cteNameRegex.exec(cteSection)) !== null) {
        const cteName = cteNameMatch[1];
        cteAliases.add(cteName.toLowerCase());
        
        // Extrair conteúdo do CTE (entre parênteses)
        const cteNameIndex = cteSection.indexOf(cteNameMatch[0]);
        let cteDepth = 0;
        let cteContentStart = cteNameIndex + cteNameMatch[0].length;
        let cteContentEnd = cteContentStart;
        
        for (let j = cteContentStart; j < cteSection.length; j++) {
          if (cteSection[j] === '(') cteDepth++;
          if (cteSection[j] === ')') {
            if (cteDepth === 0) {
              cteContentEnd = j;
              break;
            }
            cteDepth--;
          }
        }
        
        const cteContent = cteSection.substring(cteContentStart, cteContentEnd);
        extractTablesFromQuery(cteContent, tables, aliases, cteAliases);
      }
      
      // Extrair o SELECT final (após todos os CTEs)
      finalQuery = cleaned.substring(lastCTEEnd + 1).trim();
    }

    // Extrair tabelas do SELECT final
    extractTablesFromQuery(finalQuery, tables, aliases, cteAliases);

    // Extrair relacionamentos de ON de toda a query
    // Padrão melhorado: ON alias1.col1 = alias2.col2 ou ON table1.col1 = table2.col2
    // Suporta: [schema].table.col, alias.col, table.col, múltiplas condições com AND/OR
    // Também suporta: ON t1.col1 = t2.col2 AND t1.col3 = t2.col4 (múltiplas condições)
    const onRegex = /ON\s+((?:\[?(\w+)\]?\.)?\[?(\w+)\]?\.\[?(\w+)\]?\s*=\s*(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\.\[?(\w+)\]?(?:\s+(?:AND|OR)\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\.\[?(\w+)\]?\s*=\s*(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\.\[?(\w+)\]?)*)/gi;
    // Extrair todas as condições ON (suporta múltiplas condições por JOIN)
    const onBlockRegex = /ON\s+([^WHERE|GROUP|ORDER|HAVING]+?)(?=\s+(?:INNER|LEFT|RIGHT|FULL|CROSS|WHERE|GROUP|ORDER|HAVING|$))/gi;
    let onBlockMatch;
    
    while ((onBlockMatch = onBlockRegex.exec(cleaned)) !== null) {
      const onBlock = onBlockMatch[1];
      
      // Extrair cada condição individual (separadas por AND/OR)
      const conditionRegex = /(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\.\[?(\w+)\]?\s*=\s*(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\.\[?(\w+)\]?/gi;
      let conditionMatch;
      
      while ((conditionMatch = conditionRegex.exec(onBlock)) !== null) {
        const schema1 = conditionMatch[1];
        const tableOrAlias1 = conditionMatch[2];
        const col1 = conditionMatch[3];
        const schema2 = conditionMatch[4];
        const tableOrAlias2 = conditionMatch[5];
        const col2 = conditionMatch[6];

        // Ignorar se for um CTE
        if (cteAliases.has(tableOrAlias1.toLowerCase()) || cteAliases.has(tableOrAlias2.toLowerCase())) {
          continue;
        }

        // Resolver aliases - primeiro tentar encontrar no mapa de aliases
        let table1: string;
        const alias1Lower = tableOrAlias1.toLowerCase();
        if (aliases.has(alias1Lower)) {
          table1 = aliases.get(alias1Lower)!;
        } else if (schema1) {
          table1 = `${schema1}.${tableOrAlias1}`;
        } else {
          table1 = tableOrAlias1;
        }

        let table2: string;
        const alias2Lower = tableOrAlias2.toLowerCase();
        if (aliases.has(alias2Lower)) {
          table2 = aliases.get(alias2Lower)!;
        } else if (schema2) {
          table2 = `${schema2}.${tableOrAlias2}`;
        } else {
          table2 = tableOrAlias2;
        }

        // Ignorar se ambas forem CTEs ou se forem a mesma tabela
        if (cteAliases.has(table1.toLowerCase()) || cteAliases.has(table2.toLowerCase())) {
          continue;
        }

        if (table1.toLowerCase() !== table2.toLowerCase()) {
          // Verificar se já existe este relacionamento (evitar duplicatas)
          const exists = joins.some(j => 
            (j.from.toLowerCase() === table1.toLowerCase() && j.to.toLowerCase() === table2.toLowerCase()) ||
            (j.from.toLowerCase() === table2.toLowerCase() && j.to.toLowerCase() === table1.toLowerCase())
          );
          
          if (!exists) {
            joins.push({
              from: table1,
              to: table2,
              condition: `${table1}.${col1} = ${table2}.${col2}`,
            });
          }
        }
      }
    }
    
    // Extrair subqueries em FROM e JOIN (para linhagem mais profunda)
    // Padrão melhorado: FROM (SELECT ... FROM ...) AS alias ou JOIN (SELECT ... FROM ...) AS alias
    // Suporta subqueries aninhadas e múltiplas condições
    const subqueryRegex = /(?:FROM|JOIN)\s*\(\s*(SELECT[\s\S]+?)\s*\)(?:\s+AS\s+(\w+))?/gi;
    let subqueryMatch;
    while ((subqueryMatch = subqueryRegex.exec(cleaned)) !== null) {
      const subqueryContent = subqueryMatch[1]; // Conteúdo do SELECT dentro da subquery
      const subqueryAlias = subqueryMatch[2]; // Alias da subquery (se houver)
      
      // Extrair tabelas da subquery recursivamente
      extractTablesFromQuery(subqueryContent, tables, aliases, cteAliases);
      
      // Se a subquery tem alias, mapear para evitar confusão (não é uma tabela real)
      if (subqueryAlias) {
        cteAliases.add(subqueryAlias.toLowerCase());
      }
    }
    
    // Extrair tabelas de subqueries em WHERE (EXISTS, IN, NOT IN, etc)
    // Padrão: WHERE col IN (SELECT ... FROM ...) ou WHERE EXISTS (SELECT ... FROM ...)
    const whereSubqueryRegex = /(?:IN|EXISTS|NOT\s+IN|NOT\s+EXISTS)\s*\(\s*(SELECT[\s\S]+?)\s*\)/gi;
    let whereSubqueryMatch;
    while ((whereSubqueryMatch = whereSubqueryRegex.exec(cleaned)) !== null) {
      const subqueryContent = whereSubqueryMatch[1];
      extractTablesFromQuery(subqueryContent, tables, aliases, cteAliases);
    }
    
    // Extrair tabelas de subqueries em SELECT (subqueries correlacionadas)
    // Padrão: SELECT (SELECT ... FROM ...) AS col
    const selectSubqueryRegex = /SELECT\s+[^,]*?\(\s*(SELECT[\s\S]+?)\s*\)/gi;
    let selectSubqueryMatch;
    while ((selectSubqueryMatch = selectSubqueryRegex.exec(cleaned)) !== null) {
      const subqueryContent = selectSubqueryMatch[1];
      extractTablesFromQuery(subqueryContent, tables, aliases, cteAliases);
    }

    // Remover duplicatas e CTEs
    const uniqueTables = Array.from(new Set(tables)).filter(
      table => !cteAliases.has(table.toLowerCase())
    );

    return { tables: uniqueTables, joins, aliases };
  }, []);

  const highlightQuery = useCallback((sqlQuery: string, allTableIds: string[], allEdges: any[]) => {
    const analysis = analyzeSQL(sqlQuery);
    setAnalysisResult(analysis);
    
    // Debug: Log da análise
    console.log('🔍 Análise SQL:', {
      tables: analysis.tables,
      joins: analysis.joins,
      aliases: Array.from(analysis.aliases.entries()),
    });

    // Criar um mapa de nomes de tabelas para IDs completos
    const tableNameToId = new Map<string, string>();
    
    allTableIds.forEach((tableId) => {
      // Extrair nome da tabela (pode ser schema.table ou apenas table)
      const parts = tableId.split('.');
      const tableName = parts.length > 1 ? parts[1] : parts[0];
      const schema = parts.length > 1 ? parts[0] : undefined;
      
      // Mapear por nome completo
      tableNameToId.set(tableId.toLowerCase(), tableId);
      
      // Mapear por nome da tabela apenas (sem schema)
      tableNameToId.set(tableName.toLowerCase(), tableId);
      
      // Mapear por schema.table
      if (schema) {
        tableNameToId.set(`${schema}.${tableName}`.toLowerCase(), tableId);
      }
    });

    // Encontrar IDs das tabelas mencionadas na query (correspondência mais precisa)
    const highlightedTableIds = new Set<string>();
    
    analysis.tables.forEach((tableName) => {
      const normalized = tableName.toLowerCase().trim();
      
      // Tentar encontrar correspondência exata primeiro (schema.table ou table)
      if (tableNameToId.has(normalized)) {
        highlightedTableIds.add(tableNameToId.get(normalized)!);
        return;
      }
      
      // Extrair nome da tabela (sem schema)
      const tableOnly = normalized.includes('.') 
        ? normalized.split('.').pop()! 
        : normalized;
      
      // Tentar encontrar por nome da tabela apenas (sem schema)
      // Mas apenas se não houver ambiguidade (múltiplas tabelas com mesmo nome em schemas diferentes)
      if (tableOnly) {
        const matches: string[] = [];
        for (const [key, id] of tableNameToId.entries()) {
          const keyTableOnly = key.includes('.') ? key.split('.').pop()! : key;
          if (keyTableOnly === tableOnly) {
            matches.push(id);
          }
        }
        
        // Se encontrou exatamente uma correspondência, usar ela
        if (matches.length === 1) {
          highlightedTableIds.add(matches[0]);
        } else if (matches.length > 1) {
          // Múltiplas correspondências - tentar usar a que tem schema correspondente
          const withSchema = matches.find(id => {
            const idLower = id.toLowerCase();
            return idLower === normalized || idLower.endsWith(`.${tableOnly}`);
          });
          if (withSchema) {
            highlightedTableIds.add(withSchema);
          } else {
            // Se não encontrou correspondência exata com schema, usar a primeira
            // (melhor do que não mostrar nada)
            highlightedTableIds.add(matches[0]);
          }
        }
      }
    });

    // Encontrar arestas relacionadas baseadas nos JOINs explícitos da query
    const highlightedEdgeIds = new Set<string>();
    
    // Função auxiliar para normalizar nomes de tabelas para comparação
    const normalizeTableName = (tableName: string): string => {
      const normalized = tableName.toLowerCase().trim();
      // Remover colchetes e espaços
      return normalized.replace(/[\[\]]/g, '').replace(/\s+/g, '');
    };
    
    // Função auxiliar para extrair nome da tabela (sem schema)
    const getTableNameOnly = (tableName: string): string => {
      const normalized = normalizeTableName(tableName);
      const parts = normalized.split('.');
      return parts.length > 1 ? parts[parts.length - 1] : normalized;
    };
    
    // Função auxiliar para verificar se duas tabelas correspondem
    const tablesMatch = (table1: string, table2: string): boolean => {
      const t1Norm = normalizeTableName(table1);
      const t2Norm = normalizeTableName(table2);
      
      // Correspondência exata
      if (t1Norm === t2Norm) return true;
      
      // Correspondência por nome apenas (sem schema)
      const t1Only = getTableNameOnly(table1);
      const t2Only = getTableNameOnly(table2);
      if (t1Only === t2Only) return true;
      
      return false;
    };
    
    // Primeiro, tentar encontrar arestas que correspondem exatamente aos JOINs da query
    if (analysis.joins.length > 0) {
      // Para cada JOIN, encontrar arestas que correspondem
      analysis.joins.forEach(join => {
        const joinFrom = join.from;
        const joinTo = join.to;
        const joinCondition = join.condition || '';
        
        // Extrair colunas da condição ON (se disponível)
        let joinFromColumn: string | null = null;
        let joinToColumn: string | null = null;
        
        if (joinCondition) {
          // Padrão: table1.col1 = table2.col2 ou alias1.col1 = alias2.col2
          // Suporta também: [schema].[table].[col] = [schema].[table].[col]
          const columnMatch = joinCondition.match(/(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\.\[?(\w+)\]?\s*=\s*(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\.\[?(\w+)\]?/i);
          if (columnMatch) {
            const leftSchema = columnMatch[1] || '';
            const leftTable = columnMatch[2].toLowerCase();
            const leftCol = columnMatch[3].toLowerCase();
            const rightSchema = columnMatch[4] || '';
            const rightTable = columnMatch[5].toLowerCase();
            const rightCol = columnMatch[6].toLowerCase();
            
            // Determinar qual coluna pertence a qual tabela
            const joinFromLower = normalizeTableName(joinFrom);
            const joinToLower = normalizeTableName(joinTo);
            
            // Construir nomes completos das tabelas (com schema se disponível)
            const leftTableFull = leftSchema ? `${leftSchema}.${leftTable}` : leftTable;
            const rightTableFull = rightSchema ? `${rightSchema}.${rightTable}` : rightTable;
            
            // Verificar correspondência com joinFrom
            if (tablesMatch(leftTableFull, joinFromLower) || 
                tablesMatch(leftTable, joinFromLower) ||
                getTableNameOnly(leftTable) === getTableNameOnly(joinFromLower)) {
              joinFromColumn = leftCol;
            }
            if (tablesMatch(rightTableFull, joinFromLower) || 
                tablesMatch(rightTable, joinFromLower) ||
                getTableNameOnly(rightTable) === getTableNameOnly(joinFromLower)) {
              joinFromColumn = rightCol;
            }
            
            // Verificar correspondência com joinTo
            if (tablesMatch(leftTableFull, joinToLower) || 
                tablesMatch(leftTable, joinToLower) ||
                getTableNameOnly(leftTable) === getTableNameOnly(joinToLower)) {
              joinToColumn = leftCol;
            }
            if (tablesMatch(rightTableFull, joinToLower) || 
                tablesMatch(rightTable, joinToLower) ||
                getTableNameOnly(rightTable) === getTableNameOnly(joinToLower)) {
              joinToColumn = rightCol;
            }
          }
        }

        // Procurar arestas que correspondem a este JOIN
        allEdges.forEach((edge) => {
          const edgeFrom = edge.from || edge.source;
          const edgeTo = edge.to || edge.target;
          const edgeFromColumn = (edge.fromColumn || '').toLowerCase();
          const edgeToColumn = (edge.toColumn || '').toLowerCase();
          
          // Verificar se as tabelas correspondem (em qualquer direção)
          const forwardMatch = tablesMatch(edgeFrom, joinFrom) && tablesMatch(edgeTo, joinTo);
          const reverseMatch = tablesMatch(edgeFrom, joinTo) && tablesMatch(edgeTo, joinFrom);
          
          if (forwardMatch || reverseMatch) {
            // Se temos informações de colunas, verificar correspondência exata
            if (joinFromColumn && joinToColumn) {
              let columnMatch = false;
              
              if (forwardMatch) {
                // Direção normal: joinFrom -> joinTo corresponde a edgeFrom -> edgeTo
                columnMatch = 
                  (edgeFromColumn === joinFromColumn && edgeToColumn === joinToColumn) ||
                  (edgeFromColumn === joinToColumn && edgeToColumn === joinFromColumn);
              } else if (reverseMatch) {
                // Direção reversa: joinFrom -> joinTo corresponde a edgeTo -> edgeFrom
                columnMatch = 
                  (edgeToColumn === joinFromColumn && edgeFromColumn === joinToColumn) ||
                  (edgeToColumn === joinToColumn && edgeFromColumn === joinFromColumn);
              }
              
              if (columnMatch) {
                highlightedEdgeIds.add(edge.id);
                console.log('✅ Aresta correspondente encontrada:', {
                  edge: `${edgeFrom}.${edgeFromColumn} -> ${edgeTo}.${edgeToColumn}`,
                  join: `${joinFrom}.${joinFromColumn} -> ${joinTo}.${joinToColumn}`,
                  direction: forwardMatch ? 'forward' : 'reverse',
                });
              } else {
                console.log('❌ Aresta não corresponde (colunas diferentes):', {
                  edge: `${edgeFrom}.${edgeFromColumn} -> ${edgeTo}.${edgeToColumn}`,
                  join: `${joinFrom}.${joinFromColumn} -> ${joinTo}.${joinToColumn}`,
                });
              }
            } else {
              // Se não temos informações de colunas, aceitar qualquer aresta entre essas tabelas
              // Mas apenas se ambas as tabelas estão destacadas
              if (highlightedTableIds.has(edgeFrom) && highlightedTableIds.has(edgeTo)) {
                highlightedEdgeIds.add(edge.id);
                console.log('✅ Aresta correspondente (sem verificação de colunas):', {
                  edge: `${edgeFrom} -> ${edgeTo}`,
                  join: `${joinFrom} -> ${joinTo}`,
                });
              }
            }
          }
        });
      });
    } else {
      // Se não há JOINs explícitos, mostrar todas as arestas entre tabelas destacadas
      // (pode ser uma query simples sem JOINs explícitos)
      allEdges.forEach((edge) => {
        const fromId = edge.from || edge.source;
        const toId = edge.to || edge.target;
        
        if (highlightedTableIds.has(fromId) && highlightedTableIds.has(toId)) {
          highlightedEdgeIds.add(edge.id);
        }
      });
    }

    // Filtrar para mostrar apenas tabelas que estão conectadas (têm pelo menos uma aresta)
    // Isso remove nós isolados que não têm relacionamentos
    const connectedTableIds = new Set<string>();
    
    // Adicionar tabelas que têm arestas conectando-as
    highlightedEdgeIds.forEach((edgeId) => {
      const edge = allEdges.find(e => e.id === edgeId);
      if (edge) {
        const fromId = edge.from || edge.source;
        const toId = edge.to || edge.target;
        if (highlightedTableIds.has(fromId) && highlightedTableIds.has(toId)) {
          connectedTableIds.add(fromId);
          connectedTableIds.add(toId);
        }
      }
    });

    // Lógica para determinar quais tabelas mostrar:
    // Se há JOINs explícitos na query, mostrar apenas tabelas conectadas por esses JOINs
    // Se não há JOINs, mostrar todas as tabelas mencionadas (pode ser uma query simples)
    let finalTableIds: Set<string>;
    let finalEdgeIds: Set<string>;
    
    if (analysis.joins.length > 0) {
      // Há JOINs explícitos: usar as arestas já identificadas acima
      // Adicionar todas as tabelas que participam dos JOINs
      finalTableIds = new Set<string>();
      analysis.joins.forEach(join => {
        // Encontrar IDs correspondentes para as tabelas do JOIN
        const joinFromNorm = normalizeTableName(join.from);
        const joinToNorm = normalizeTableName(join.to);
        
        for (const [key, id] of tableNameToId.entries()) {
          const keyNorm = normalizeTableName(key);
          if (tablesMatch(keyNorm, joinFromNorm) || tablesMatch(keyNorm, joinToNorm)) {
            finalTableIds.add(id);
          }
        }
      });
      
      // Usar as arestas já identificadas na primeira passagem
      finalEdgeIds = highlightedEdgeIds;
      
      // Se não encontrou arestas correspondentes, mas há tabelas, mostrar todas as arestas entre elas
      if (finalEdgeIds.size === 0 && finalTableIds.size > 0) {
        allEdges.forEach((edge) => {
          const fromId = edge.from || edge.source;
          const toId = edge.to || edge.target;
          if (finalTableIds.has(fromId) && finalTableIds.has(toId)) {
            finalEdgeIds.add(edge.id);
          }
        });
      }
    } else {
      // Não há JOINs explícitos: mostrar todas as tabelas e suas conexões
      if (highlightedTableIds.size === 1) {
        finalTableIds = highlightedTableIds;
      } else if (connectedTableIds.size > 0) {
        finalTableIds = connectedTableIds;
      } else {
        finalTableIds = highlightedTableIds;
      }
      
      // Filtrar arestas para incluir apenas as que conectam tabelas no conjunto final
      finalEdgeIds = new Set<string>();
      allEdges.forEach((edge) => {
        const fromId = edge.from || edge.source;
        const toId = edge.to || edge.target;
        if (finalTableIds.has(fromId) && finalTableIds.has(toId)) {
          finalEdgeIds.add(edge.id);
        }
      });
    }

    setHighlightedTables(finalTableIds);
    setHighlightedEdges(finalEdgeIds);
  }, [analyzeSQL]);

  const clearHighlight = useCallback(() => {
    setHighlightedTables(new Set());
    setHighlightedEdges(new Set());
    setAnalysisResult(null);
  }, []);

  return {
    analyzeSQL,
    highlightQuery,
    clearHighlight,
    highlightedTables,
    highlightedEdges,
    analysisResult,
  };
}
