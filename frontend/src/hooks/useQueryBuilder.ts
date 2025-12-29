/**
 * Hook principal do Query Builder
 * Gerencia o estado do AST e todas as operações de construção de queries
 */

import { useState, useCallback, useMemo } from 'react';
import type { 
  QueryAST, 
  SelectField, 
  QueryJoin, 
  WhereCondition, 
  GroupByField, 
  OrderByField,
  JoinType,
  CTEClause,
} from '../types/query-builder';
import type { GraphNode, GraphEdge } from '../api/client';
import { generateSQL, generateAlias, createEmptyAST, type DatabaseDialect } from '../utils/query-builder/sql-generator';
import { findBestPath, findAllDirectRelationships } from '../utils/query-builder/graph-path-finder';

interface UseQueryBuilderOptions {
  nodes: GraphNode[];
  edges: GraphEdge[];
  dbType: DatabaseDialect;
  onJoinCreated?: (targetTableId: string) => void;
}

interface UseQueryBuilderReturn {
  ast: QueryAST;
  sql: string;
  tableAliases: Map<string, string>;
  includedTables: Set<string>;
  
  // Ações de tabela base
  setBaseTable: (tableId: string) => void;
  setFromSubquery: (subqueryAST: QueryAST, alias: string) => void;
  clearFromSubquery: () => void;
  
  // Ações de SELECT
  addColumn: (tableId: string, column: string) => void;
  removeColumn: (fieldId: string) => void;
  updateColumnAlias: (fieldId: string, alias: string) => void;
  reorderColumns: (fields: SelectField[]) => void;
  addExpression: (expression: string, alias?: string) => void;
  
  // Ações de JOIN
  addJoin: (targetTableId: string, sourceTableId?: string) => void;
  addManualJoin: (
    targetTableId: string,
    sourceTableId: string,
    conditions: Array<{ sourceColumn: string; targetColumn: string }>,
    joinType: JoinType,
    targetSubquery?: QueryAST,
    targetSubqueryAlias?: string
  ) => void;
  updateJoin: (joinId: string, updates: Partial<QueryJoin>) => void;
  removeJoin: (joinId: string) => void;
  
  // Ações de WHERE
  addWhereCondition: (condition: WhereCondition) => void;
  updateWhereCondition: (conditionId: string, updates: Partial<WhereCondition>) => void;
  removeWhereCondition: (conditionId: string) => void;
  reorderWhereConditions: (conditions: WhereCondition[]) => void;
  
  // Ações de GROUP BY
  addGroupBy: (tableId: string, column: string) => void;
  removeGroupBy: (fieldId: string) => void;
  reorderGroupBy: (fields: GroupByField[]) => void;
  
  // Ações de ORDER BY
  addOrderBy: (tableId: string, column: string, direction?: 'ASC' | 'DESC') => void;
  removeOrderBy: (fieldId: string) => void;
  updateOrderBy: (fieldId: string, updates: Partial<OrderByField>) => void;
  reorderOrderBy: (fields: OrderByField[]) => void;
  
  // Ações de CTE
  addCTE: (cte: CTEClause) => void;
  updateCTE: (cteId: string, updates: Partial<CTEClause>) => void;
  removeCTE: (cteId: string) => void;
  
  // Ações de LIMIT
  setLimit: (limit: number | null, offset?: number) => void;
  
  // Utilidades
  reset: () => void;
  loadAST: (ast: QueryAST) => void;
  getTableAlias: (tableId: string) => string;
}

export function useQueryBuilder(options: UseQueryBuilderOptions): UseQueryBuilderReturn {
  const { nodes, edges, dbType, onJoinCreated } = options;
  
  const [ast, setAST] = useState<QueryAST>(createEmptyAST());
  
  // Mapa de tableId -> alias
  const tableAliases = useMemo(() => {
    const aliases = new Map<string, string>();
    
    if (ast.from.table) {
      aliases.set(ast.from.table, ast.from.alias);
    }
    
    for (const join of ast.joins) {
      aliases.set(join.targetTableId, join.targetAlias);
    }
    
    return aliases;
  }, [ast.from, ast.joins]);
  
  // Set de tabelas incluídas na query
  const includedTables = useMemo(() => {
    const tables = new Set<string>();
    
    if (ast.from.table) {
      tables.add(ast.from.table);
    }
    
    for (const join of ast.joins) {
      tables.add(join.targetTableId);
    }
    
    return tables;
  }, [ast.from.table, ast.joins]);
  
  // Gerar SQL
  const sql = useMemo(() => {
    if (!ast.from.table && !ast.from.subquery) {
      return '';
    }
    
    return generateSQL(ast, { dialect: dbType, pretty: true });
  }, [ast, dbType]);
  
  // Helper para gerar alias único
  const getUniqueAlias = useCallback((tableId: string): string => {
    const existingAliases = new Set(tableAliases.values());
    return generateAlias(tableId, existingAliases);
  }, [tableAliases]);
  
  // Helper para obter alias de uma tabela
  const getTableAlias = useCallback((tableId: string): string => {
    return tableAliases.get(tableId) || tableId;
  }, [tableAliases]);
  
  // ===== AÇÕES DE TABELA BASE =====
  
  const setBaseTable = useCallback((tableId: string) => {
    const alias = generateAlias(tableId, new Set());
    
    setAST({
      ...createEmptyAST(),
      from: {
        table: tableId,
        alias,
      },
    });
  }, []);
  
  const setFromSubquery = useCallback((subqueryAST: QueryAST, alias: string) => {
    setAST(prev => ({
      ...prev,
      from: {
        ...prev.from,
        subquery: subqueryAST,
        alias,
      },
    }));
  }, []);
  
  const clearFromSubquery = useCallback(() => {
    setAST(prev => {
      const { subquery, ...fromWithoutSubquery } = prev.from;
      return {
        ...prev,
        from: fromWithoutSubquery,
      };
    });
  }, []);
  
  // ===== AÇÕES DE SELECT =====
  
  const addColumn = useCallback((tableId: string, column: string) => {
    // Verificar se coluna já existe
    const exists = ast.select.fields.some(
      f => f.tableId === tableId && f.column === column
    );
    
    if (exists) return;
    
    // Verificar se precisa criar JOIN
    if (!includedTables.has(tableId) && ast.from.table) {
      // Tentar encontrar caminho
      const path = findBestPath(nodes, edges, ast.from.table, tableId);
      
      if (path && path.edges.length > 0) {
        // Criar JOINs necessários
        let currentSourceId = ast.from.table;
        let currentSourceAlias = ast.from.alias;
        
        for (const edge of path.edges) {
          const targetTableId = edge.to;
          
          // Verificar se já existe JOIN para esta tabela
          if (!ast.joins.some(j => j.targetTableId === targetTableId)) {
            const targetAlias = getUniqueAlias(targetTableId);
            
            const newJoin: QueryJoin = {
              id: `join-${Date.now()}-${Math.random()}`,
              type: 'LEFT',
              sourceTableId: currentSourceId,
              sourceAlias: currentSourceAlias,
              sourceColumn: edge.fromColumn,
              targetTableId,
              targetAlias,
              targetColumn: edge.toColumn,
              edgeId: edge.edgeId,
            };
            
            setAST(prev => ({
              ...prev,
              joins: [...prev.joins, newJoin],
            }));
            
            currentSourceId = targetTableId;
            currentSourceAlias = targetAlias;
          }
        }
      }
    }
    
    // Adicionar coluna
    const alias = getTableAlias(tableId) || getUniqueAlias(tableId);
    const newField: SelectField = {
      id: `field-${Date.now()}-${Math.random()}`,
      tableId,
      column,
      order: ast.select.fields.length,
    };
    
    setAST(prev => ({
      ...prev,
      select: {
        fields: [...prev.select.fields, newField],
      },
    }));
  }, [ast, includedTables, nodes, edges, getTableAlias, getUniqueAlias]);
  
  const removeColumn = useCallback((fieldId: string) => {
    setAST(prev => ({
      ...prev,
      select: {
        fields: prev.select.fields.filter(f => f.id !== fieldId),
      },
    }));
  }, []);
  
  const updateColumnAlias = useCallback((fieldId: string, alias: string) => {
    setAST(prev => ({
      ...prev,
      select: {
        fields: prev.select.fields.map(f =>
          f.id === fieldId ? { ...f, alias: alias || undefined } : f
        ),
      },
    }));
  }, []);
  
  const reorderColumns = useCallback((fields: SelectField[]) => {
    setAST(prev => ({
      ...prev,
      select: {
        fields: fields.map((f, idx) => ({ ...f, order: idx })),
      },
    }));
  }, []);
  
  const addExpression = useCallback((expression: string, alias?: string) => {
    const newField: SelectField = {
      id: `expr-${Date.now()}-${Math.random()}`,
      tableId: '',
      column: '',
      expression,
      alias,
      order: ast.select.fields.length,
      type: 'expression',
    };
    
    setAST(prev => ({
      ...prev,
      select: {
        fields: [...prev.select.fields, newField],
      },
    }));
  }, [ast.select.fields.length]);
  
  // ===== AÇÕES DE JOIN =====
  
  const addJoin = useCallback((targetTableId: string, sourceTableId?: string) => {
    const source = sourceTableId || ast.from.table;
    if (!source) return;
    
    // Verificar se já existe JOIN para esta tabela
    if (ast.joins.some(j => j.targetTableId === targetTableId)) return;
    
    // Encontrar relacionamento
    const relationships = findAllDirectRelationships(edges, source, targetTableId);
    
    if (relationships.length === 0) {
      // Sem relacionamento direto - tentar encontrar caminho
      const path = findBestPath(nodes, edges, source, targetTableId);
      if (!path || path.edges.length === 0) {
        console.warn(`Nenhum relacionamento encontrado entre ${source} e ${targetTableId}`);
        return;
      }
      
      // Criar JOINs intermediários se necessário
      let currentSourceId = source;
      let currentSourceAlias = getTableAlias(source);
      
      for (const edge of path.edges) {
        const intermediate = edge.to;
        
        if (!ast.joins.some(j => j.targetTableId === intermediate)) {
          const targetAlias = getUniqueAlias(intermediate);
          
          const newJoin: QueryJoin = {
            id: `join-${Date.now()}-${Math.random()}`,
            type: 'LEFT',
            sourceTableId: currentSourceId,
            sourceAlias: currentSourceAlias,
            sourceColumn: edge.fromColumn,
            targetTableId: intermediate,
            targetAlias,
            targetColumn: edge.toColumn,
            edgeId: edge.edgeId,
          };
          
          setAST(prev => ({
            ...prev,
            joins: [...prev.joins, newJoin],
          }));
          
          currentSourceId = intermediate;
          currentSourceAlias = targetAlias;
        }
      }
      
      return;
    }
    
    // Usar primeiro relacionamento encontrado
    const rel = relationships[0];
    const sourceAlias = getTableAlias(source);
    const targetAlias = getUniqueAlias(targetTableId);
    
    // Determinar direção do relacionamento
    const isFromSource = rel.from === source;
    
    const newJoin: QueryJoin = {
      id: `join-${Date.now()}-${Math.random()}`,
      type: 'LEFT',
      sourceTableId: source,
      sourceAlias,
      sourceColumn: isFromSource ? rel.fromColumn : rel.toColumn,
      targetTableId,
      targetAlias,
      targetColumn: isFromSource ? rel.toColumn : rel.fromColumn,
      edgeId: rel.id,
    };
    
    setAST(prev => ({
      ...prev,
      joins: [...prev.joins, newJoin],
    }));
    
    if (onJoinCreated) {
      onJoinCreated(targetTableId);
    }
  }, [ast.from.table, ast.joins, edges, nodes, getTableAlias, getUniqueAlias, onJoinCreated]);
  
  const addManualJoin = useCallback((
    targetTableId: string,
    sourceTableId: string,
    conditions: Array<{ sourceColumn: string; targetColumn: string }>,
    joinType: JoinType,
    targetSubquery?: QueryAST,
    targetSubqueryAlias?: string
  ) => {
    if (conditions.length === 0) return;
    
    // Determinar alias da origem
    let sourceAlias: string;
    if (sourceTableId === ast.from.table) {
      sourceAlias = ast.from.alias;
    } else {
      const existingJoin = ast.joins.find(j => j.targetTableId === sourceTableId);
      sourceAlias = existingJoin?.targetAlias || getUniqueAlias(sourceTableId);
    }
    
    const targetAlias = targetSubqueryAlias || getUniqueAlias(targetTableId);
    
    // Criar condição customizada se múltiplas condições
    let customCondition: string | undefined;
    if (conditions.length > 1) {
      const escapeCol = (col: string) => {
        if (dbType === 'sqlserver') {
          return `[${col.replace(/\]/g, ']]')}]`;
        }
        return `\`${col.replace(/`/g, '``')}\``;
      };
      
      customCondition = conditions.map(c => {
        return `${sourceAlias}.${escapeCol(c.sourceColumn)} = ${targetAlias}.${escapeCol(c.targetColumn)}`;
      }).join(' AND ');
    }
    
    const newJoin: QueryJoin = {
      id: `join-${Date.now()}-${Math.random()}`,
      type: joinType,
      sourceTableId,
      sourceAlias,
      sourceColumn: conditions[0].sourceColumn,
      targetTableId,
      targetAlias,
      targetColumn: conditions[0].targetColumn,
      customCondition,
      targetSubquery,
      targetSubqueryAlias,
    };
    
    setAST(prev => ({
      ...prev,
      joins: [...prev.joins, newJoin],
    }));
    
    if (onJoinCreated) {
      onJoinCreated(targetSubqueryAlias || targetTableId);
    }
  }, [ast.from.table, ast.from.alias, ast.joins, dbType, getUniqueAlias, onJoinCreated]);
  
  const updateJoin = useCallback((joinId: string, updates: Partial<QueryJoin>) => {
    setAST(prev => ({
      ...prev,
      joins: prev.joins.map(j =>
        j.id === joinId ? { ...j, ...updates } : j
      ),
    }));
  }, []);
  
  const removeJoin = useCallback((joinId: string) => {
    setAST(prev => ({
      ...prev,
      joins: prev.joins.filter(j => j.id !== joinId),
    }));
  }, []);
  
  // ===== AÇÕES DE WHERE =====
  
  const addWhereCondition = useCallback((condition: WhereCondition) => {
    setAST(prev => ({
      ...prev,
      where: {
        conditions: [...(prev.where?.conditions || []), condition],
      },
    }));
  }, []);
  
  const updateWhereCondition = useCallback((conditionId: string, updates: Partial<WhereCondition>) => {
    setAST(prev => ({
      ...prev,
      where: {
        conditions: (prev.where?.conditions || []).map(c =>
          c.id === conditionId ? { ...c, ...updates } : c
        ),
      },
    }));
  }, []);
  
  const removeWhereCondition = useCallback((conditionId: string) => {
    setAST(prev => ({
      ...prev,
      where: {
        conditions: (prev.where?.conditions || []).filter(c => c.id !== conditionId),
      },
    }));
  }, []);
  
  const reorderWhereConditions = useCallback((conditions: WhereCondition[]) => {
    setAST(prev => ({
      ...prev,
      where: {
        conditions: conditions.map((c, idx) => ({ ...c, order: idx })),
      },
    }));
  }, []);
  
  // ===== AÇÕES DE GROUP BY =====
  
  const addGroupBy = useCallback((tableId: string, column: string) => {
    const exists = ast.groupBy?.fields.some(
      f => f.tableId === tableId && f.column === column
    );
    
    if (exists) return;
    
    const newField: GroupByField = {
      id: `groupby-${Date.now()}-${Math.random()}`,
      tableId,
      column,
      order: ast.groupBy?.fields.length || 0,
    };
    
    setAST(prev => ({
      ...prev,
      groupBy: {
        fields: [...(prev.groupBy?.fields || []), newField],
      },
    }));
  }, [ast.groupBy]);
  
  const removeGroupBy = useCallback((fieldId: string) => {
    setAST(prev => ({
      ...prev,
      groupBy: {
        fields: (prev.groupBy?.fields || []).filter(f => f.id !== fieldId),
      },
    }));
  }, []);
  
  const reorderGroupBy = useCallback((fields: GroupByField[]) => {
    setAST(prev => ({
      ...prev,
      groupBy: {
        fields: fields.map((f, idx) => ({ ...f, order: idx })),
      },
    }));
  }, []);
  
  // ===== AÇÕES DE ORDER BY =====
  
  const addOrderBy = useCallback((tableId: string, column: string, direction: 'ASC' | 'DESC' = 'ASC') => {
    const exists = ast.orderBy?.fields.some(
      f => f.tableId === tableId && f.column === column
    );
    
    if (exists) return;
    
    const newField: OrderByField = {
      id: `orderby-${Date.now()}-${Math.random()}`,
      tableId,
      column,
      direction,
      order: ast.orderBy?.fields.length || 0,
    };
    
    setAST(prev => ({
      ...prev,
      orderBy: {
        fields: [...(prev.orderBy?.fields || []), newField],
      },
    }));
  }, [ast.orderBy]);
  
  const removeOrderBy = useCallback((fieldId: string) => {
    setAST(prev => ({
      ...prev,
      orderBy: {
        fields: (prev.orderBy?.fields || []).filter(f => f.id !== fieldId),
      },
    }));
  }, []);
  
  const updateOrderBy = useCallback((fieldId: string, updates: Partial<OrderByField>) => {
    setAST(prev => ({
      ...prev,
      orderBy: {
        fields: (prev.orderBy?.fields || []).map(f =>
          f.id === fieldId ? { ...f, ...updates } : f
        ),
      },
    }));
  }, []);
  
  const reorderOrderBy = useCallback((fields: OrderByField[]) => {
    setAST(prev => ({
      ...prev,
      orderBy: {
        fields: fields.map((f, idx) => ({ ...f, order: idx })),
      },
    }));
  }, []);
  
  // ===== AÇÕES DE CTE =====
  
  const addCTE = useCallback((cte: CTEClause) => {
    setAST(prev => ({
      ...prev,
      ctes: [...(prev.ctes || []), cte],
    }));
  }, []);
  
  const updateCTE = useCallback((cteId: string, updates: Partial<CTEClause>) => {
    setAST(prev => ({
      ...prev,
      ctes: (prev.ctes || []).map(c =>
        c.id === cteId ? { ...c, ...updates } : c
      ),
    }));
  }, []);
  
  const removeCTE = useCallback((cteId: string) => {
    setAST(prev => ({
      ...prev,
      ctes: (prev.ctes || []).filter(c => c.id !== cteId),
    }));
  }, []);
  
  // ===== AÇÕES DE LIMIT =====
  
  const setLimit = useCallback((limit: number | null, offset?: number) => {
    setAST(prev => ({
      ...prev,
      limit: limit ? { limit, offset } : undefined,
    }));
  }, []);
  
  // ===== UTILIDADES =====
  
  const reset = useCallback(() => {
    setAST(createEmptyAST());
  }, []);
  
  const loadAST = useCallback((newAST: QueryAST) => {
    setAST(newAST);
  }, []);
  
  return {
    ast,
    sql,
    tableAliases,
    includedTables,
    
    setBaseTable,
    setFromSubquery,
    clearFromSubquery,
    
    addColumn,
    removeColumn,
    updateColumnAlias,
    reorderColumns,
    addExpression,
    
    addJoin,
    addManualJoin,
    updateJoin,
    removeJoin,
    
    addWhereCondition,
    updateWhereCondition,
    removeWhereCondition,
    reorderWhereConditions,
    
    addGroupBy,
    removeGroupBy,
    reorderGroupBy,
    
    addOrderBy,
    removeOrderBy,
    updateOrderBy,
    reorderOrderBy,
    
    addCTE,
    updateCTE,
    removeCTE,
    
    setLimit,
    
    reset,
    loadAST,
    getTableAlias,
  };
}
