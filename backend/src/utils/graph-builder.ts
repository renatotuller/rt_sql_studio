import type { SchemaInfo, GraphData, GraphNode, GraphEdge, Column } from '../types/index.js';

export class GraphBuilder {
  static build(schema: SchemaInfo): GraphData {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Adicionar nós para tabelas
    for (const table of schema.tables) {
      const nodeId = table.schema ? `${table.schema}.${table.name}` : table.name;
      nodes.push({
        id: nodeId,
        label: table.name,
        type: 'table',
        schema: table.schema,
        columns: table.columns || [],
      });
    }

    // Adicionar nós para views
    for (const view of schema.views) {
      const nodeId = view.schema ? `${view.schema}.${view.name}` : view.name;
      nodes.push({
        id: nodeId,
        label: view.name,
        type: 'view',
        schema: view.schema,
        columns: view.columns || [], // Usar colunas extraídas das views
      });
    }

    // Criar um Set com todos os IDs de nós válidos para validação
    const validNodeIds = new Set(nodes.map(n => n.id));
    
    // Adicionar arestas para foreign keys de tabelas
    // IMPORTANTE: Uma foreign key pode ter múltiplas colunas (FK composta)
    // Cada coluna deve gerar uma aresta separada
    for (const fk of schema.foreignKeys) {
      // Normalizar IDs das tabelas (pode incluir schema ou não)
      const fromId = this.normalizeNodeId(fk.fromTable, validNodeIds);
      const toId = this.normalizeNodeId(fk.toTable, validNodeIds);
      
      if (fromId && toId) {
        // Incluir nome da coluna no ID para suportar FKs compostas
        // Isso garante que cada coluna de uma FK composta gere uma aresta única
        const edgeId = `fk_${fk.name}_${fk.fromColumn}_${fk.toColumn}`;
        
        // Verificar se já não existe uma aresta com este ID (evitar duplicatas)
        const existingEdge = edges.find(e => e.id === edgeId);
        if (!existingEdge) {
          edges.push({
            id: edgeId,
            from: fromId,
            to: toId,
            fromColumn: fk.fromColumn,
            toColumn: fk.toColumn,
            label: fk.name,
          });
        }
      } else {
        console.warn(`Foreign key ${fk.name} referencia tabelas não encontradas: ${fk.fromTable} -> ${fk.toTable}`);
      }
    }

    // Extrair relacionamentos de views analisando suas definições SQL
    // IMPORTANTE: Usar apenas relacionamentos explícitos (JOINs) da definição SQL, não heurísticas
    const viewRelationships = this.extractViewRelationships(schema, validNodeIds);
    edges.push(...viewRelationships);

    return { nodes, edges };
  }

  /**
   * Normaliza o ID do nó, tentando encontrar correspondência exata ou parcial
   */
  private static normalizeNodeId(tableName: string, validNodeIds: Set<string>): string | null {
    // Tentar correspondência exata primeiro
    if (validNodeIds.has(tableName)) {
      return tableName;
    }

    // Tentar com schema (se não tiver)
    if (!tableName.includes('.')) {
      for (const id of validNodeIds) {
        if (id.endsWith(`.${tableName}`) || id === tableName) {
          return id;
        }
      }
    }

    // Tentar sem schema (se tiver)
    if (tableName.includes('.')) {
      const nameOnly = tableName.split('.').pop()!;
      for (const id of validNodeIds) {
        if (id.endsWith(`.${nameOnly}`) || id === nameOnly) {
          return id;
        }
      }
    }

    return null;
  }

  /**
   * Extrai relacionamentos de views analisando suas definições SQL
   */
  private static extractViewRelationships(schema: SchemaInfo, validNodeIds: Set<string>): GraphEdge[] {
    const edges: GraphEdge[] = [];

    for (const view of schema.views) {
      if (!view.definition) continue;

      const viewId = view.schema ? `${view.schema}.${view.name}` : view.name;
      
      // Extrair tabelas mencionadas na definição da view
      const referencedTables = this.extractTablesFromViewDefinition(view.definition, schema);
      
      // Mapear colunas do SELECT da VIEW para colunas das tabelas base
      const columnMapping = this.mapViewColumnsToBaseTables(view.definition, view.columns, referencedTables, schema);
      
      // Para cada tabela referenciada, tentar encontrar relacionamentos baseados em colunas
      for (const refTable of referencedTables) {
        const refTableId = this.normalizeNodeId(refTable, validNodeIds);
        if (!refTableId) continue;

        const refTableObj = schema.tables.find(t => 
          (t.schema ? `${t.schema}.${t.name}` : t.name) === refTableId
        );

        if (!refTableObj) continue;

        // Analisar a definição da view para encontrar APENAS JOINs explícitos
        // NÃO usar heurísticas baseadas em nomes de colunas - apenas relacionamentos reais do schema
        const joinRelationships = this.extractJoinRelationshipsFromView(
          view.definition,
          viewId,
          refTableId,
          refTableObj,
          view.columns,
          columnMapping
        );
        edges.push(...joinRelationships);
      }

      // Analisar funções SQL no SELECT para extrair relacionamentos adicionais
      // Prioridade: JOINs explícitos > Relacionamentos de funções
      // Passar edges já criados para evitar duplicatas
      const functionRelationships = this.extractFunctionBasedRelationships(
        view.definition,
        viewId,
        view.columns,
        referencedTables,
        schema,
        validNodeIds,
        edges // Passar edges existentes para verificar duplicatas
      );
      edges.push(...functionRelationships);
    }

    return edges;
  }

  /**
   * Mapeia colunas do SELECT da VIEW para colunas das tabelas base
   * Retorna um mapa: viewColumnName -> { tableId, columnName }
   */
  private static mapViewColumnsToBaseTables(
    definition: string,
    viewColumns: Column[],
    referencedTables: string[],
    schema: SchemaInfo
  ): Map<string, { tableId: string; columnName: string }> {
    const mapping = new Map<string, { tableId: string; columnName: string }>();
    
    // Extrair a parte SELECT da definição
    const selectMatch = definition.match(/SELECT\s+(.*?)\s+FROM/i);
    if (!selectMatch) return mapping;
    
    const selectClause = selectMatch[1];
    
    // Extrair aliases de tabelas
    const aliasMap = new Map<string, string>(); // alias -> tableId
    const tableAliasRegex = /(?:FROM|JOIN)\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?(?:\s+AS\s+)?(?:\s+\[?(\w+)\]?)?/gi;
    let aliasMatch;
    
    while ((aliasMatch = tableAliasRegex.exec(definition)) !== null) {
      const schemaName = aliasMatch[1] || '';
      const tableName = aliasMatch[2];
      const alias = aliasMatch[3] || tableName; // Se não há alias, usar o nome da tabela
      
      if (tableName) {
        const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;
        // Encontrar o tableId completo
        const table = schema.tables.find(t => {
          const tId = t.schema ? `${t.schema}.${t.name}` : t.name;
          return tId === fullTableName || t.name === tableName;
        });
        
        if (table) {
          const tableId = table.schema ? `${table.schema}.${table.name}` : table.name;
          aliasMap.set(alias.toLowerCase(), tableId);
          // Também adicionar o nome da tabela como alias (caso não tenha alias explícito)
          if (alias.toLowerCase() !== tableName.toLowerCase()) {
            aliasMap.set(tableName.toLowerCase(), tableId);
          }
        }
      }
    }
    
    // Analisar cada coluna no SELECT
    // Formato: tabela.coluna AS alias, ou coluna AS alias, ou apenas coluna
    const columnRegex = /(?:\[?(\w+)\]?\.)?\[?(\w+)\]?(?:\s+AS\s+|\s+)(?:\[?(\w+)\]?)?/gi;
    let colMatch;
    let columnIndex = 0;
    
    while ((colMatch = columnRegex.exec(selectClause)) !== null && columnIndex < viewColumns.length) {
      const tableOrAlias = colMatch[1] || '';
      const columnName = colMatch[2];
      const alias = colMatch[3] || columnName;
      
      const viewColumn = viewColumns[columnIndex];
      const viewColName = viewColumn.name;
      
      // Se há qualificador de tabela, mapear diretamente
      if (tableOrAlias) {
        const normalizedAlias = tableOrAlias.toLowerCase();
        const tableId = aliasMap.get(normalizedAlias);
        
        if (tableId) {
          // Verificar se a coluna existe na tabela
          const table = schema.tables.find(t => {
            const tId = t.schema ? `${t.schema}.${t.name}` : t.name;
            return tId === tableId;
          });
          
          if (table && table.columns.some(c => c.name === columnName)) {
            mapping.set(viewColName, { tableId, columnName });
          }
        }
      } else {
        // Sem qualificador - tentar encontrar em qual tabela esta coluna existe
        for (const refTable of referencedTables) {
          const table = schema.tables.find(t => {
            const tId = t.schema ? `${t.schema}.${t.name}` : t.name;
            return tId === refTable || t.name === refTable;
          });
          
          if (table && table.columns.some(c => c.name === columnName)) {
            const tableId = table.schema ? `${table.schema}.${table.name}` : table.name;
            mapping.set(viewColName, { tableId, columnName });
            break;
          }
        }
      }
      
      columnIndex++;
    }
    
    return mapping;
  }

  /**
   * Extrai relacionamentos de JOINs explícitos na definição da view
   * Analisa a estrutura SQL completa para mapear colunas da VIEW para colunas das tabelas base
   */
  private static extractJoinRelationshipsFromView(
    definition: string,
    viewId: string,
    tableId: string,
    table: any,
    viewColumns: any[],
    columnMapping?: Map<string, { tableId: string; columnName: string }>
  ): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const usedRelationships = new Set<string>(); // Para evitar duplicatas
    
    // Normalizar nomes
    const tableName = tableId.includes('.') ? tableId.split('.').pop()! : tableId;
    const viewName = viewId.includes('.') ? viewId.split('.').pop()! : viewId;
    
    // Verificar se a tabela é mencionada na definição
    const tableNameRegex = new RegExp(`\\b${tableName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (!tableNameRegex.test(definition)) {
      return edges;
    }

    // 1. Extrair mapeamento de aliases de tabelas
    // Exemplo: FROM tabela1 AS t1, tabela2 AS t2
    // ou: FROM tabela1 t1 JOIN tabela2 t2
    // ou: FROM [schema].[tabela] AS [alias]
    const aliasMap = new Map<string, string>(); // alias -> tableId completo
    const tableAliasRegex = /(?:FROM|JOIN)\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?(?:\s+AS\s+)?(?:\s+\[?(\w+)\]?)?/gi;
    let aliasMatch;
    
    while ((aliasMatch = tableAliasRegex.exec(definition)) !== null) {
      const schema = aliasMatch[1] || '';
      const tableNameFromDef = aliasMatch[2];
      const alias = aliasMatch[3] || tableNameFromDef; // Se não há alias, usar o nome da tabela
      
      if (tableNameFromDef) {
        const fullTableName = schema ? `${schema}.${tableNameFromDef}` : tableNameFromDef;
        // Verificar se esta tabela corresponde à tabela que estamos procurando
        if (tableNameFromDef.toLowerCase() === tableName.toLowerCase() || 
            fullTableName.toLowerCase() === tableId.toLowerCase()) {
          aliasMap.set(alias.toLowerCase(), tableId);
          // Também adicionar o nome da tabela como alias (caso não tenha alias explícito)
          if (alias.toLowerCase() !== tableNameFromDef.toLowerCase()) {
            aliasMap.set(tableNameFromDef.toLowerCase(), tableId);
          }
        }
      }
    }

    // 2. Analisar JOINs e suas condições ON
    // Suporta: INNER JOIN, LEFT JOIN, RIGHT JOIN, FULL JOIN, JOIN
    const joinRegex = /(?:INNER\s+|LEFT\s+|RIGHT\s+|FULL\s+)?JOIN\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?(?:\s+AS\s+|\s+)(?:\[?(\w+)\]?)?\s+ON\s+((?:\([^)]*\)|\[?\w+\]?\.\[?\w+\]?\s*=\s*\[?\w+\]?\.\[?\w+\]?)(?:\s+(?:AND|OR)\s+(?:\([^)]*\)|\[?\w+\]?\.\[?\w+\]?\s*=\s*\[?\w+\]?\.\[?\w+\]?))*)/gi;
    let joinMatch;
    
    while ((joinMatch = joinRegex.exec(definition)) !== null) {
      const joinSchema = joinMatch[1] || '';
      const joinTableName = joinMatch[2];
      const joinAlias = joinMatch[3] || joinTableName;
      const onClause = joinMatch[4];
      
      // Verificar se este JOIN é com a tabela que estamos procurando
      const fullJoinTableName = joinSchema ? `${joinSchema}.${joinTableName}` : joinTableName;
      const isTargetTable = joinTableName.toLowerCase() === tableName.toLowerCase() || 
                           fullJoinTableName.toLowerCase() === tableId.toLowerCase();
      
      if (!isTargetTable) continue;
      
      // Registrar alias se ainda não foi registrado
      if (joinAlias && !aliasMap.has(joinAlias.toLowerCase())) {
        aliasMap.set(joinAlias.toLowerCase(), tableId);
      }
      
      // 3. Analisar condições ON para extrair relacionamentos
      // Extrair todas as condições de igualdade (suporta colunas com e sem qualificador)
      const conditionRegex = /(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\s*=\s*(?:\[?(\w+)\]?\.)?\[?(\w+)\]?/gi;
      let conditionMatch;
      
      while ((conditionMatch = conditionRegex.exec(onClause)) !== null) {
        const leftTableOrAlias = conditionMatch[1] || '';
        const leftCol = conditionMatch[2];
        const rightTableOrAlias = conditionMatch[3] || '';
        const rightCol = conditionMatch[4];
        
        // Determinar qual lado é da tabela alvo e qual é de outra tabela/view
        const leftIsTarget = this.isTableReference(leftTableOrAlias, joinAlias, tableName, tableId, aliasMap);
        const rightIsTarget = this.isTableReference(rightTableOrAlias, joinAlias, tableName, tableId, aliasMap);
        
        // Determinar qual coluna é da tabela alvo e qual é da outra tabela/view
        let targetColName: string | null = null;
        let otherColName: string | null = null;
        let otherIsView = false;
        
        if (leftIsTarget && !rightIsTarget) {
          // Esquerda é tabela alvo, direita é outra tabela/view
          targetColName = leftCol;
          otherColName = rightCol;
          // Verificar se a direita é a view ou outra tabela
          otherIsView = this.isViewReference(rightTableOrAlias, viewName, viewId, aliasMap);
        } else if (!leftIsTarget && rightIsTarget) {
          // Esquerda é outra tabela/view, direita é tabela alvo
          otherColName = leftCol;
          targetColName = rightCol;
          otherIsView = this.isViewReference(leftTableOrAlias, viewName, viewId, aliasMap);
        }
        
        // Se identificamos as colunas, verificar se existem
        if (targetColName && otherColName) {
          // Verificar se a coluna da tabela existe
          const targetColExists = table.columns.some((c: any) => c.name === targetColName);
          
          // Se a outra coluna é da view, verificar se existe nas colunas da view
          // Se não é da view, pode ser de outra tabela (não processamos aqui)
          if (targetColExists && otherIsView) {
            const viewColExists = viewColumns.some(c => c.name === otherColName);
            
            if (viewColExists) {
              // Criar edge: view -> table
              const relationshipKey = `${otherColName}_${targetColName}`;
              
              if (!usedRelationships.has(relationshipKey)) {
                const edgeId = `view_${viewId}_to_${tableId}_${otherColName}_${targetColName}`;
                edges.push({
                  id: edgeId,
                  from: viewId,
                  to: tableId,
                  fromColumn: otherColName,
                  toColumn: targetColName,
                  label: `view_join`,
                });
                usedRelationships.add(relationshipKey);
                
                console.log(`[GraphBuilder] ✅ Edge criado da view ${viewId} para ${tableId}:`, {
                  fromColumn: otherColName,
                  toColumn: targetColName,
                  edgeId,
                });
              }
            }
          } else if (targetColExists && !otherIsView) {
            // A outra coluna pode ser de outra tabela (não processamos relacionamentos entre tabelas aqui)
            // Mas podemos criar um relacionamento se a coluna da view corresponde à coluna da tabela
            // Usar o mapeamento de colunas se disponível
            let viewColToUse: string | null = null;
            
            if (columnMapping) {
              // Procurar no mapeamento se alguma coluna da view mapeia para a coluna "other"
              for (const [viewColName, mapping] of columnMapping.entries()) {
                if (mapping.tableId === tableId && mapping.columnName === otherColName) {
                  viewColToUse = viewColName;
                  break;
                }
              }
            }
            
            // Se não encontrou no mapeamento, tentar encontrar por nome
            if (!viewColToUse) {
              const viewColMatch = viewColumns.find(c => 
                c.name.toLowerCase() === otherColName.toLowerCase() ||
                c.name.toLowerCase() === leftCol.toLowerCase() ||
                c.name.toLowerCase() === rightCol.toLowerCase()
              );
              viewColToUse = viewColMatch?.name || null;
            }
            
            if (viewColToUse) {
              // Criar edge usando o nome da coluna da view
              const relationshipKey = `${viewColToUse}_${targetColName}`;
              
              if (!usedRelationships.has(relationshipKey)) {
                const edgeId = `view_${viewId}_to_${tableId}_${viewColToUse}_${targetColName}`;
                edges.push({
                  id: edgeId,
                  from: viewId,
                  to: tableId,
                  fromColumn: viewColToUse,
                  toColumn: targetColName,
                  label: `view_join`,
                });
                usedRelationships.add(relationshipKey);
                
                console.log(`[GraphBuilder] ✅ Edge criado da view ${viewId} para ${tableId} (via mapeamento):`, {
                  fromColumn: viewColToUse,
                  toColumn: targetColName,
                  edgeId,
                });
              }
            }
          }
        }
      }
    }

    return edges;
  }

  /**
   * Verifica se uma referência de tabela/alias corresponde à tabela alvo
   */
  private static isTableReference(
    tableOrAlias: string,
    joinAlias: string,
    tableName: string,
    tableId: string,
    aliasMap: Map<string, string>
  ): boolean {
    if (!tableOrAlias) return false;
    
    const normalized = tableOrAlias.toLowerCase();
    const normalizedTableName = tableName.toLowerCase();
    const normalizedTableId = tableId.toLowerCase();
    
    // Verificar se é o alias do JOIN
    if (normalized === joinAlias.toLowerCase()) return true;
    
    // Verificar se é o nome da tabela
    if (normalized === normalizedTableName || normalized === normalizedTableId) return true;
    
    // Verificar no mapa de aliases
    const mappedTable = aliasMap.get(normalized);
    if (mappedTable && mappedTable.toLowerCase() === normalizedTableId) return true;
    
    return false;
  }

  /**
   * Verifica se uma referência de tabela/alias corresponde à view
   */
  private static isViewReference(
    tableOrAlias: string,
    viewName: string,
    viewId: string,
    aliasMap: Map<string, string>
  ): boolean {
    if (!tableOrAlias) return false;
    
    const normalized = tableOrAlias.toLowerCase();
    const normalizedViewName = viewName.toLowerCase();
    const normalizedViewId = viewId.toLowerCase();
    
    // Verificar se é o nome da view
    if (normalized === normalizedViewName || normalized === normalizedViewId) return true;
    
    // Verificar no mapa de aliases (se a view tiver alias)
    const mappedTable = aliasMap.get(normalized);
    if (mappedTable && mappedTable.toLowerCase() === normalizedViewId) return true;
    
    return false;
  }

  /**
   * Encontra relacionamentos baseados em correspondência de nomes de colunas
   * Permite múltiplos relacionamentos entre a mesma view e tabela
   */
  private static findColumnBasedRelationships(
    viewId: string,
    viewColumns: any[],
    tableId: string,
    table: any
  ): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const usedViewColumns = new Set<string>(); // Para evitar relacionamentos duplicados da mesma coluna

    // Priorizar primary keys da tabela - permitir múltiplas colunas da view relacionarem com PKs
    for (const pk of table.primaryKeys || []) {
      const pkLower = pk.toLowerCase();
      
      for (const viewCol of viewColumns) {
        const viewColLower = viewCol.name.toLowerCase();
        const viewColKey = `${viewCol.name}_${pk}`;
        
        // Match exato ou parcial
        if (viewColLower === pkLower || 
            viewColLower.includes(pkLower) ||
            pkLower.includes(viewColLower) ||
            this.isSimilarColumnName(viewColLower, pkLower)) {
          
          // Verificar se já não criamos este relacionamento específico
          if (!usedViewColumns.has(viewColKey)) {
            const edgeId = `view_${viewId}_to_${tableId}_${viewCol.name}_${pk}`;
            edges.push({
              id: edgeId,
              from: viewId,
              to: tableId,
              fromColumn: viewCol.name,
              toColumn: pk,
              label: `view_relationship`,
            });
            usedViewColumns.add(viewColKey);
          }
        }
      }
    }

    // Se não encontrou relacionamento com PK, tentar com outras colunas importantes
    // Mas também permitir relacionamentos adicionais mesmo se já encontrou com PK
    for (const viewCol of viewColumns) {
      const viewColLower = viewCol.name.toLowerCase();
      
      // Procurar colunas que podem ser relacionadas (ex: codigo_interno, cdProduto)
      for (const tableCol of table.columns || []) {
        const tableColLower = tableCol.name.toLowerCase();
        const relationshipKey = `${viewCol.name}_${tableCol.name}`;
        
        // Verificar se já não criamos este relacionamento específico
        if (usedViewColumns.has(relationshipKey)) continue;
        
        // Verificar se é uma PK que já foi processada
        const isPK = table.primaryKeys?.includes(tableCol.name);
        if (isPK && usedViewColumns.has(`${viewCol.name}_${tableCol.name}`)) continue;
        
        if (this.isSimilarColumnName(viewColLower, tableColLower)) {
          const edgeId = `view_${viewId}_to_${tableId}_${viewCol.name}_${tableCol.name}`;
          edges.push({
            id: edgeId,
            from: viewId,
            to: tableId,
            fromColumn: viewCol.name,
            toColumn: tableCol.name,
            label: `view_relationship`,
          });
          usedViewColumns.add(relationshipKey);
        }
      }
    }

    return edges;
  }

  /**
   * Verifica se dois nomes de colunas são similares (podem indicar relacionamento)
   */
  private static isSimilarColumnName(col1: string, col2: string): boolean {
    // Match exato
    if (col1 === col2) return true;
    
    // Padrões comuns de relacionamento
    const patterns = [
      { test: (c1: string, c2: string) => c1.includes('codigo') && c2.includes('codigo') },
      { test: (c1: string, c2: string) => c1.includes('id') && c2.includes('id') && c1.length > 2 && c2.length > 2 },
      { test: (c1: string, c2: string) => c1.includes('cd') && c2.includes('cd') },
      { test: (c1: string, c2: string) => c1.includes('produto') && c2.includes('produto') },
      { test: (c1: string, c2: string) => c1.includes('interno') && c2.includes('interno') },
    ];

    for (const pattern of patterns) {
      if (pattern.test(col1, col2)) return true;
    }

    return false;
  }

  /**
   * Extrai relacionamentos baseados em parâmetros de funções SQL
   * Analisa funções no SELECT da VIEW para identificar tabelas referenciadas nos parâmetros
   */
  private static extractFunctionBasedRelationships(
    definition: string,
    viewId: string,
    viewColumns: any[],
    referencedTables: string[],
    schema: SchemaInfo,
    validNodeIds: Set<string>,
    existingEdges: GraphEdge[] = [] // Edges já criados (JOINs explícitos) para evitar duplicatas
  ): GraphEdge[] {
    const edges: GraphEdge[] = [];
    const usedRelationships = new Set<string>(); // Para evitar duplicatas

    // Criar um Set com relacionamentos já existentes (JOINs explícitos)
    // Formato: viewId_tableId_fromColumn_toColumn
    const existingRelationshipKeys = new Set<string>();
    for (const edge of existingEdges) {
      if (edge.from === viewId) {
        const key = `${edge.from}_${edge.to}_${edge.fromColumn}_${edge.toColumn}`;
        existingRelationshipKeys.add(key);
      }
    }

    // Extrair a parte SELECT da definição
    const selectMatch = definition.match(/SELECT\s+(.*?)\s+FROM/i);
    if (!selectMatch) return edges;

    const selectClause = selectMatch[1];

    // Extrair mapeamento de aliases de tabelas (reutilizar lógica similar)
    const aliasMap = new Map<string, string>(); // alias -> tableId
    const tableAliasRegex = /(?:FROM|JOIN)\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?(?:\s+AS\s+)?(?:\s+\[?(\w+)\]?)?/gi;
    let aliasMatch;

    while ((aliasMatch = tableAliasRegex.exec(definition)) !== null) {
      const schemaName = aliasMatch[1] || '';
      const tableName = aliasMatch[2];
      const alias = aliasMatch[3] || tableName;

      if (tableName) {
        const fullTableName = schemaName ? `${schemaName}.${tableName}` : tableName;
        const table = schema.tables.find(t => {
          const tId = t.schema ? `${t.schema}.${t.name}` : t.name;
          return tId === fullTableName || t.name === tableName;
        });

        if (table) {
          const tableId = table.schema ? `${table.schema}.${table.name}` : table.name;
          aliasMap.set(alias.toLowerCase(), tableId);
          if (alias.toLowerCase() !== tableName.toLowerCase()) {
            aliasMap.set(tableName.toLowerCase(), tableId);
          }
        }
      }
    }

    // Regex para identificar funções SQL: schema.funcao(...) ou funcao(...)
    // Captura: schema (opcional), nome da função, e parâmetros
    const functionRegex = /(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\s*\(([^)]*)\)/gi;
    let functionMatch;

    while ((functionMatch = functionRegex.exec(selectClause)) !== null) {
      const functionSchema = functionMatch[1] || '';
      const functionName = functionMatch[2];
      const parameters = functionMatch[3];

      if (!parameters) continue;

      console.log(`[GraphBuilder] 🔍 Função analisada: ${functionSchema ? `${functionSchema}.` : ''}${functionName}(${parameters})`);

      // Extrair referências a tabelas nos parâmetros
      // Padrões: tabela.coluna, alias.coluna, schema.tabela.coluna
      const tableColumnRegex = /(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\.\[?(\w+)\]?/g;
      let paramMatch;

      while ((paramMatch = tableColumnRegex.exec(parameters)) !== null) {
        const tableOrAliasOrSchema = paramMatch[1] || '';
        const tableOrColumn = paramMatch[2];
        const columnName = paramMatch[3];

        // Determinar se é schema.tabela.coluna ou alias.coluna
        let tableId: string | null = null;
        let actualColumnName: string = columnName; // Inicializar com valor padrão

        if (tableOrAliasOrSchema && paramMatch[0].split('.').length === 3) {
          // Formato: schema.tabela.coluna
          const schemaName = tableOrAliasOrSchema;
          const tableName = tableOrColumn;
          const fullTableName = `${schemaName}.${tableName}`;
          
          const table = schema.tables.find(t => {
            const tId = t.schema ? `${t.schema}.${t.name}` : t.name;
            return tId === fullTableName || (t.schema === schemaName && t.name === tableName);
          });

          if (table) {
            tableId = table.schema ? `${table.schema}.${table.name}` : table.name;
            actualColumnName = columnName;
          }
        } else if (tableOrAliasOrSchema || tableOrColumn) {
          // Formato: alias.coluna ou tabela.coluna
          const aliasOrTable = tableOrAliasOrSchema || tableOrColumn;
          actualColumnName = tableOrAliasOrSchema ? tableOrColumn : columnName;

          // Verificar se é um alias conhecido
          const normalizedAlias = aliasOrTable.toLowerCase();
          const mappedTableId = aliasMap.get(normalizedAlias);

          if (mappedTableId) {
            tableId = mappedTableId;
          } else {
            // Tentar encontrar a tabela diretamente
            const table = schema.tables.find(t => {
              const tId = t.schema ? `${t.schema}.${t.name}` : t.name;
              const tName = t.name.toLowerCase();
              return tId.toLowerCase() === normalizedAlias || tName === normalizedAlias;
            });

            if (table) {
              tableId = table.schema ? `${table.schema}.${table.name}` : table.name;
            }
          }
        }

        // Se encontramos uma tabela válida, criar relacionamento
        if (tableId && validNodeIds.has(tableId)) {
          const table = schema.tables.find(t => {
            const tId = t.schema ? `${t.schema}.${t.name}` : t.name;
            return tId === tableId;
          });

          if (table && actualColumnName && table.columns.some((c: any) => c.name === actualColumnName)) {
            // Verificar se já existe um relacionamento explícito (JOIN) para evitar duplicatas
            const relationshipKey = `${viewId}_${tableId}_${actualColumnName || columnName}`;
            
            if (!usedRelationships.has(relationshipKey)) {
              // Tentar encontrar uma coluna da VIEW que corresponda a este relacionamento
              // Usar a coluna da VIEW que contém esta função, se possível
              let viewColumnToUse: string | null = null;

              // Procurar por uma coluna da VIEW que tenha um nome similar ou que seja o resultado desta função
              // Como não temos mapeamento direto, vamos usar a primeira coluna disponível ou criar um relacionamento genérico
              // Na prática, o relacionamento será útil mesmo sem uma coluna específica da VIEW
              
              // Tentar encontrar uma coluna da VIEW que corresponda ao nome da coluna da tabela
              const matchingViewCol = viewColumns.find(c => 
                actualColumnName && (
                  c.name.toLowerCase() === actualColumnName.toLowerCase() ||
                  c.name.toLowerCase().includes(actualColumnName.toLowerCase()) ||
                  actualColumnName.toLowerCase().includes(c.name.toLowerCase())
                )
              );

              if (matchingViewCol) {
                viewColumnToUse = matchingViewCol.name;
              } else {
                // Se não encontrou correspondência, usar a primeira coluna da VIEW como fallback
                // Isso permite que o relacionamento seja criado mesmo sem correspondência exata
                viewColumnToUse = viewColumns.length > 0 ? viewColumns[0].name : null;
              }

              if (viewColumnToUse) {
                // Verificar se já existe um relacionamento explícito (JOIN) para evitar duplicatas
                const relationshipKey = `${viewId}_${tableId}_${viewColumnToUse}_${actualColumnName || columnName}`;
                
                if (existingRelationshipKeys.has(relationshipKey)) {
                  console.log(`[GraphBuilder] ⏭️ Relacionamento já existe (JOIN explícito), ignorando função:`, {
                    viewId,
                    tableId,
                    fromColumn: viewColumnToUse,
                    toColumn: actualColumnName || columnName,
                  });
                  continue;
                }

                if (!usedRelationships.has(relationshipKey)) {
                  const edgeId = `view_function_${viewId}_to_${tableId}_${viewColumnToUse}_${actualColumnName || columnName}`;
                  edges.push({
                    id: edgeId,
                    from: viewId,
                    to: tableId,
                    fromColumn: viewColumnToUse,
                    toColumn: actualColumnName || columnName,
                    label: `view_function`,
                  });
                  usedRelationships.add(relationshipKey);

                  console.log(`[GraphBuilder] ✅ Edge criado da view ${viewId} para ${tableId} (via função):`, {
                    function: `${functionSchema ? `${functionSchema}.` : ''}${functionName}`,
                    fromColumn: viewColumnToUse,
                    toColumn: actualColumnName || columnName,
                    edgeId,
                  });
                }
              }
            }
          }
        }
      }
    }

    return edges;
  }

  /**
   * Extrai nomes de tabelas mencionadas na definição SQL da view
   */
  private static extractTablesFromViewDefinition(definition: string, schema: SchemaInfo): string[] {
    const tables: Set<string> = new Set();
    const upperDef = definition.toUpperCase();

    // Extrair tabelas de FROM e JOIN
    const fromJoinRegex = /(?:FROM|JOIN)\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?/gi;
    let match;
    
    while ((match = fromJoinRegex.exec(definition)) !== null) {
      const schemaName = match[1];
      const tableName = match[2];
      
      if (tableName) {
        // Verificar se a tabela existe no schema
        const fullName = schemaName ? `${schemaName}.${tableName}` : tableName;
        const exists = schema.tables.some(t => {
          const tId = t.schema ? `${t.schema}.${t.name}` : t.name;
          return tId === fullName || t.name === tableName;
        });
        
        if (exists) {
          tables.add(fullName);
        } else {
          // Tentar sem schema
          tables.add(tableName);
        }
      }
    }

    return Array.from(tables);
  }

  static getRelatedNodes(nodeId: string, graph: GraphData): string[] {
    const related: Set<string> = new Set();

    // Encontrar todas as arestas conectadas a este nó
    for (const edge of graph.edges) {
      if (edge.from === nodeId) {
        related.add(edge.to);
      }
      if (edge.to === nodeId) {
        related.add(edge.from);
      }
    }

    return Array.from(related);
  }
}

