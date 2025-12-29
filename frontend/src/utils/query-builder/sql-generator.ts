/**
 * Gerador de SQL a partir do AST do Query Builder
 * Suporta MySQL e SQL Server
 */

import type { QueryAST, QueryJoin, SelectField, WhereCondition, GroupByField, OrderByField, CTEClause } from '../../types/query-builder';

export type DatabaseDialect = 'mysql' | 'sqlserver';

interface GeneratorOptions {
  dialect: DatabaseDialect;
  pretty?: boolean;
}

/**
 * Escapa identificadores SQL (nomes de tabelas, colunas, etc.)
 */
export function escapeIdentifier(name: string, dialect: DatabaseDialect): string {
  if (dialect === 'sqlserver') {
    return `[${name.replace(/\]/g, ']]')}]`;
  }
  return `\`${name.replace(/`/g, '``')}\``;
}

/**
 * Escapa valores string para SQL
 */
export function escapeValue(value: unknown, dialect: DatabaseDialect): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  if (Array.isArray(value)) {
    return `(${value.map(v => escapeValue(v, dialect)).join(', ')})`;
  }
  // String - escapar aspas simples
  const str = String(value);
  return `'${str.replace(/'/g, "''")}'`;
}

/**
 * Consolida JOINs que têm o mesmo destino em um único JOIN com múltiplas condições AND
 */
export function consolidateJoins(joins: QueryJoin[]): QueryJoin[] {
  const consolidated = new Map<string, QueryJoin>();
  
  for (const join of joins) {
    const key = `${join.sourceTableId}->${join.targetTableId}`;
    
    if (consolidated.has(key)) {
      // Já existe um JOIN para este par de tabelas
      // Adicionar a condição ao customCondition existente
      const existing = consolidated.get(key)!;
      const existingCondition = existing.customCondition || 
        `${existing.sourceAlias}.${existing.sourceColumn} = ${existing.targetAlias}.${existing.targetColumn}`;
      const newCondition = `${join.sourceAlias}.${join.sourceColumn} = ${join.targetAlias}.${join.targetColumn}`;
      
      existing.customCondition = `${existingCondition} AND ${newCondition}`;
    } else {
      // Novo JOIN
      consolidated.set(key, { ...join });
    }
  }
  
  return Array.from(consolidated.values());
}

/**
 * Gera SQL a partir do AST
 */
export function generateSQL(ast: QueryAST, options: GeneratorOptions): string {
  const { dialect, pretty = true } = options;
  const parts: string[] = [];
  const indent = pretty ? '  ' : '';
  const newline = pretty ? '\n' : ' ';
  
  // CTEs (WITH clause)
  if (ast.ctes && ast.ctes.length > 0) {
    parts.push(generateCTEs(ast.ctes, options));
  }
  
  // SELECT
  parts.push(generateSelect(ast.select, ast, options));
  
  // FROM
  parts.push(generateFrom(ast.from, options));
  
  // JOINs
  if (ast.joins && ast.joins.length > 0) {
    const consolidatedJoins = consolidateJoins(ast.joins);
    for (const join of consolidatedJoins) {
      parts.push(generateJoin(join, options));
    }
  }
  
  // WHERE
  if (ast.where && ast.where.conditions.length > 0) {
    parts.push(generateWhere(ast.where, options));
  }
  
  // GROUP BY
  if (ast.groupBy && ast.groupBy.fields.length > 0) {
    parts.push(generateGroupBy(ast.groupBy, ast, options));
  }
  
  // ORDER BY
  if (ast.orderBy && ast.orderBy.fields.length > 0) {
    parts.push(generateOrderBy(ast.orderBy, ast, options));
  }
  
  // LIMIT (MySQL) / TOP (SQL Server - handled in SELECT)
  if (ast.limit && dialect === 'mysql') {
    parts.push(generateLimit(ast.limit));
  }
  
  return parts.join(newline);
}

function generateCTEs(ctes: CTEClause[], options: GeneratorOptions): string {
  const { dialect, pretty } = options;
  const newline = pretty ? '\n' : ' ';
  
  const cteParts = ctes.map((cte, index) => {
    const recursive = cte.recursive ? 'RECURSIVE ' : '';
    const columns = cte.columns && cte.columns.length > 0 
      ? ` (${cte.columns.join(', ')})` 
      : '';
    const subquery = generateSQL(cte.query, { ...options, pretty: false });
    const separator = index < ctes.length - 1 ? ',' : '';
    
    return `${cte.name}${columns} AS (${subquery})${separator}`;
  });
  
  return `WITH ${recursive}${cteParts.join(newline)}`;
}

function generateSelect(select: SelectField[] | { fields: SelectField[] }, ast: QueryAST, options: GeneratorOptions): string {
  const { dialect, pretty } = options;
  const fields = Array.isArray(select) ? select : select.fields;
  const indent = pretty ? '  ' : '';
  const newline = pretty ? '\n' : ' ';
  
  if (fields.length === 0) {
    return 'SELECT *';
  }
  
  // SQL Server TOP clause
  const topClause = dialect === 'sqlserver' && ast.limit 
    ? `TOP ${ast.limit.limit} ` 
    : '';
  
  // Get table aliases from AST
  const tableAliases = getTableAliases(ast);
  
  const fieldStrings = fields
    .sort((a, b) => a.order - b.order)
    .map(field => {
      if (field.expression) {
        // Campo com expressão customizada
        return field.alias 
          ? `${field.expression} AS ${escapeIdentifier(field.alias, dialect)}`
          : field.expression;
      }
      
      const alias = tableAliases.get(field.tableId) || field.tableId;
      const columnRef = `${alias}.${escapeIdentifier(field.column, dialect)}`;
      
      if (field.aggregateFunction) {
        const aggregated = `${field.aggregateFunction}(${columnRef})`;
        return field.alias 
          ? `${aggregated} AS ${escapeIdentifier(field.alias, dialect)}`
          : aggregated;
      }
      
      return field.alias 
        ? `${columnRef} AS ${escapeIdentifier(field.alias, dialect)}`
        : columnRef;
    });
  
  if (pretty && fieldStrings.length > 1) {
    return `SELECT ${topClause}${newline}${indent}${fieldStrings.join(`,${newline}${indent}`)}`;
  }
  
  return `SELECT ${topClause}${fieldStrings.join(', ')}`;
}

function generateFrom(from: QueryAST['from'], options: GeneratorOptions): string {
  const { dialect } = options;
  
  if (from.subquery) {
    const subquery = generateSQL(from.subquery, { ...options, pretty: false });
    return `FROM (${subquery}) AS ${from.alias}`;
  }
  
  // Se from.table contém um ponto, separar em schema e tabela
  let tableName: string;
  if (from.schema) {
    // Já tem schema separado
    tableName = `${escapeIdentifier(from.schema, dialect)}.${escapeIdentifier(from.table, dialect)}`;
  } else if (from.table && from.table.includes('.')) {
    // tableId contém schema.tabela (ex: dbo.tbProduto)
    const parts = from.table.split('.');
    if (parts.length >= 2) {
      // Pegar o primeiro como schema e o resto como nome da tabela
      const schema = parts[0];
      const table = parts.slice(1).join('.'); // Caso tenha mais pontos no nome da tabela
      tableName = `${escapeIdentifier(schema, dialect)}.${escapeIdentifier(table, dialect)}`;
    } else {
      // Mais de um ponto, tratar como nome completo
      tableName = escapeIdentifier(from.table, dialect);
    }
  } else {
    // Sem schema
    tableName = escapeIdentifier(from.table, dialect);
  }
  
  return `FROM ${tableName} AS ${from.alias}`;
}

function generateJoin(join: QueryJoin, options: GeneratorOptions): string {
  const { dialect, pretty } = options;
  const indent = pretty ? '  ' : '';
  
  let targetTable: string;
  
  if (join.targetSubquery) {
    const subquery = generateSQL(join.targetSubquery, { ...options, pretty: false });
    targetTable = `(${subquery}) AS ${join.targetSubqueryAlias || join.targetAlias}`;
  } else {
    // Extrair schema e nome da tabela
    const parts = join.targetTableId.split('.');
    if (parts.length === 2) {
      targetTable = `${escapeIdentifier(parts[0], dialect)}.${escapeIdentifier(parts[1], dialect)} AS ${join.targetAlias}`;
    } else {
      targetTable = `${escapeIdentifier(join.targetTableId, dialect)} AS ${join.targetAlias}`;
    }
  }
  
  // Condição ON
  let onCondition: string;
  if (join.customCondition) {
    onCondition = join.customCondition;
  } else {
    const sourceCol = escapeIdentifier(join.sourceColumn, dialect);
    const targetCol = escapeIdentifier(join.targetColumn, dialect);
    onCondition = `${join.sourceAlias}.${sourceCol} = ${join.targetAlias}.${targetCol}`;
  }
  
  return `${indent}${join.type} JOIN ${targetTable}${pretty ? '\n    ' : ' '}ON ${onCondition}`;
}

function generateWhere(where: QueryAST['where'], options: GeneratorOptions): string {
  const { dialect, pretty } = options;
  
  if (!where || where.conditions.length === 0) {
    return '';
  }
  
  const indent = pretty ? '  ' : '';
  const newline = pretty ? '\n' : ' ';
  
  const conditionStrings = where.conditions
    .sort((a, b) => a.order - b.order)
    .map((cond, index) => {
      const condStr = generateWhereCondition(cond, options);
      
      if (index === 0) {
        return condStr;
      }
      
      const logicalOp = cond.logicalOperator || 'AND';
      return `${indent}${logicalOp} ${condStr}`;
    });
  
  return `WHERE ${conditionStrings.join(newline)}`;
}

function generateWhereCondition(cond: WhereCondition, options: GeneratorOptions): string {
  const { dialect } = options;
  
  // EXISTS / NOT EXISTS - não precisa de coluna
  if (cond.operator === 'EXISTS' || cond.operator === 'NOT EXISTS') {
    if (cond.subquery) {
      const subquery = generateSQL(cond.subquery, { ...options, pretty: false });
      return `${cond.operator} (${subquery})`;
    }
    return `${cond.operator} (${cond.value || 'SELECT 1'})`;
  }
  
  // Referência à coluna
  const alias = cond.tableId; // Assume que tableId é o alias
  const columnRef = `${alias}.${escapeIdentifier(cond.column, dialect)}`;
  
  // IS NULL / IS NOT NULL
  if (cond.operator === 'IS NULL' || cond.operator === 'IS NOT NULL') {
    return `${columnRef} ${cond.operator}`;
  }
  
  // IN / NOT IN com subquery
  if ((cond.operator === 'IN' || cond.operator === 'NOT IN') && cond.subquery) {
    const subquery = generateSQL(cond.subquery, { ...options, pretty: false });
    return `${columnRef} ${cond.operator} (${subquery})`;
  }
  
  // BETWEEN / NOT BETWEEN
  if (cond.operator === 'BETWEEN' || cond.operator === 'NOT BETWEEN') {
    if (Array.isArray(cond.value) && cond.value.length >= 2) {
      return `${columnRef} ${cond.operator} ${escapeValue(cond.value[0], dialect)} AND ${escapeValue(cond.value[1], dialect)}`;
    }
    return `${columnRef} ${cond.operator} ${escapeValue(cond.value, dialect)}`;
  }
  
  // IN / NOT IN com lista de valores
  if (cond.operator === 'IN' || cond.operator === 'NOT IN') {
    const values = Array.isArray(cond.value) ? cond.value : [cond.value];
    const valueList = values.map(v => escapeValue(v, dialect)).join(', ');
    return `${columnRef} ${cond.operator} (${valueList})`;
  }
  
  // Operadores padrão
  return `${columnRef} ${cond.operator} ${escapeValue(cond.value, dialect)}`;
}

function generateGroupBy(groupBy: QueryAST['groupBy'], ast: QueryAST, options: GeneratorOptions): string {
  const { dialect, pretty } = options;
  
  if (!groupBy || groupBy.fields.length === 0) {
    return '';
  }
  
  const tableAliases = getTableAliases(ast);
  
  const fieldStrings = groupBy.fields
    .sort((a, b) => a.order - b.order)
    .map(field => {
      const alias = tableAliases.get(field.tableId) || field.tableId;
      return `${alias}.${escapeIdentifier(field.column, dialect)}`;
    });
  
  return `GROUP BY ${fieldStrings.join(', ')}`;
}

function generateOrderBy(orderBy: QueryAST['orderBy'], ast: QueryAST, options: GeneratorOptions): string {
  const { dialect, pretty } = options;
  
  if (!orderBy || orderBy.fields.length === 0) {
    return '';
  }
  
  const tableAliases = getTableAliases(ast);
  
  const fieldStrings = orderBy.fields
    .sort((a, b) => a.order - b.order)
    .map(field => {
      const alias = tableAliases.get(field.tableId) || field.tableId;
      return `${alias}.${escapeIdentifier(field.column, dialect)} ${field.direction}`;
    });
  
  return `ORDER BY ${fieldStrings.join(', ')}`;
}

function generateLimit(limit: QueryAST['limit']): string {
  if (!limit) return '';
  
  if (limit.offset) {
    return `LIMIT ${limit.limit} OFFSET ${limit.offset}`;
  }
  
  return `LIMIT ${limit.limit}`;
}

/**
 * Constrói mapa de tableId -> alias a partir do AST
 */
function getTableAliases(ast: QueryAST): Map<string, string> {
  const aliases = new Map<string, string>();
  
  // Tabela base
  if (ast.from) {
    aliases.set(ast.from.table, ast.from.alias);
  }
  
  // Tabelas de JOINs
  if (ast.joins) {
    for (const join of ast.joins) {
      aliases.set(join.targetTableId, join.targetAlias);
    }
  }
  
  return aliases;
}

/**
 * Gera um alias único baseado no nome da tabela
 */
export function generateAlias(tableId: string, existingAliases: Set<string>): string {
  // Extrair nome base da tabela (sem schema)
  const baseName = tableId.includes('.') 
    ? tableId.split('.').pop()! 
    : tableId;
  
  // Criar alias a partir das primeiras letras
  let alias = baseName
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .substring(0, 3) || 't';
  
  // Se já existe, adicionar número
  let counter = 1;
  let candidateAlias = alias;
  while (existingAliases.has(candidateAlias)) {
    candidateAlias = `${alias}${counter}`;
    counter++;
  }
  
  return candidateAlias;
}

/**
 * Cria um AST vazio
 */
export function createEmptyAST(): QueryAST {
  return {
    from: {
      table: '',
      alias: '',
    },
    select: {
      fields: [],
    },
    joins: [],
  };
}
