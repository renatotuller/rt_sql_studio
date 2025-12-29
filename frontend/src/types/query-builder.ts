/**
 * Tipos TypeScript para o Query Builder
 * Define a estrutura do AST (Abstract Syntax Tree) e interfaces relacionadas
 */

import type { GraphNode, GraphEdge } from '../api/client';

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';
export type WhereOperator = '=' | '!=' | '<>' | '>' | '>=' | '<' | '<=' | 'LIKE' | 'NOT LIKE' | 'IN' | 'NOT IN' | 'IS NULL' | 'IS NOT NULL' | 'BETWEEN' | 'NOT BETWEEN' | 'EXISTS' | 'NOT EXISTS';
export type WhereLogicalOperator = 'AND' | 'OR';
export type OrderDirection = 'ASC' | 'DESC';

// ===== AST STRUCTURES =====

export interface QueryAST {
  from: FromClause;
  select: SelectClause;
  joins: QueryJoin[];
  where?: WhereClause;
  groupBy?: GroupByClause;
  orderBy?: OrderByClause;
  limit?: LimitClause;
  ctes?: CTEClause[];
}

export interface FromClause {
  table: string;
  alias: string;
  schema?: string;
  subquery?: QueryAST;
}

export interface SelectClause {
  fields: SelectField[];
}

export interface SelectField {
  id: string;
  tableId: string;
  column: string;
  alias?: string;
  order: number;
  expression?: string;
  type?: 'column' | 'expression' | 'subquery' | 'aggregate';
  aggregateFunction?: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX';
  subquery?: QueryAST;
}

export interface QueryJoin {
  id: string;
  type: JoinType;
  sourceTableId: string;
  sourceAlias: string;
  sourceColumn: string;
  targetTableId: string;
  targetAlias: string;
  targetColumn: string;
  customCondition?: string;
  edgeId?: string;
  targetSubquery?: QueryAST;
  targetSubqueryAlias?: string;
}

export interface WhereClause {
  conditions: WhereCondition[];
  logicalOperator?: WhereLogicalOperator;
}

export interface WhereCondition {
  id: string;
  tableId: string;
  column: string;
  operator: WhereOperator;
  value?: string | number | string[] | number[];
  logicalOperator?: WhereLogicalOperator;
  order: number;
  subquery?: QueryAST;
}

export interface GroupByClause {
  fields: GroupByField[];
}

export interface GroupByField {
  id: string;
  tableId: string;
  column: string;
  order: number;
}

export interface OrderByClause {
  fields: OrderByField[];
}

export interface OrderByField {
  id: string;
  tableId: string;
  column: string;
  direction: OrderDirection;
  order: number;
}

export interface LimitClause {
  limit: number;
  offset?: number;
}

export interface CTEClause {
  id: string;
  name: string;
  query: QueryAST;
  columns?: string[];
  recursive?: boolean;
}

// ===== JOIN PATH =====

export interface JoinPath {
  edges: Array<{
    from: string;
    to: string;
    fromColumn: string;
    toColumn: string;
    edgeId: string;
  }>;
  intermediateTables: string[];
  length: number;
}

export interface JoinOption {
  path: JoinPath;
  description: string;
  directRelationships: number;
}

// ===== VALIDATION =====

export interface ValidationError {
  type: 'missing_table' | 'duplicate_column' | 'invalid_join' | 'circular_join' | 'missing_join';
  message: string;
  field?: string;
}

// ===== COMPONENT PROPS (legacy compatibility) =====

export interface TableExplorerProps {
  nodes: GraphNode[];
  expandedTables: Set<string>;
  onToggleExpand: (tableId: string) => void;
  onDragStart: (tableId: string, column: { name: string; type: string }) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export interface SelectListProps {
  fields: SelectField[];
  onReorder: (fields: SelectField[]) => void;
  onRemove: (fieldId: string) => void;
  onEditAlias: (fieldId: string, alias: string) => void;
  tableAliases: Map<string, string>;
}

// Legacy types for backwards compatibility
export interface JoinClause extends QueryJoin {}
export interface JoinCondition {
  leftTable: string;
  leftColumn: string;
  rightTable: string;
  rightColumn: string;
  operator?: string;
}

export interface PathResult {
  path: string[];
  edges: GraphEdge[];
  distance: number;
}

export interface QueryBuilderState {
  ast: QueryAST;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  selectedBaseTable: string | null;
  expandedTables: Set<string>;
  selectedColumns: Map<string, SelectField>;
  joins: Map<string, QueryJoin>;
  errors: ValidationError[];
}

export interface JoinEditorProps {
  joins: QueryJoin[];
  onEdit: (joinId: string, updates: Partial<QueryJoin>) => void;
  onRemove: (joinId: string) => void;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
}

export interface JoinPathSelectorProps {
  isOpen: boolean;
  paths: PathResult[];
  fromTable: string;
  toTable: string;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  onSelect: (path: PathResult, edge: GraphEdge) => void;
  onCancel: () => void;
}

export interface SQLPreviewProps {
  sql: string;
  ast: QueryAST;
  onCopy: () => void;
  onSave: () => void;
  onLoad: (ast: QueryAST) => void;
}
