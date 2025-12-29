/**
 * Tipos TypeScript para o Query Builder
 * Define a estrutura do AST (Abstract Syntax Tree) e interfaces relacionadas
 */

import { GraphNode, GraphEdge } from './index';

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

export interface QueryAST {
  from: FromClause;
  select: SelectClause;
  joins: JoinClause[];
  where?: WhereClause;
  groupBy?: GroupByClause;
  orderBy?: OrderByClause;
  limit?: LimitClause;
}

export interface FromClause {
  table: string;              // ID da tabela (ex: "dbo.Users")
  alias?: string;              // Alias opcional (ex: "u")
  schema?: string;             // Schema (ex: "dbo")
}

export interface SelectClause {
  fields: SelectField[];
}

export interface SelectField {
  id: string;                  // ID único do campo
  table: string;               // ID da tabela
  column: string;              // Nome da coluna
  alias?: string;              // Alias (AS)
  order: number;               // Ordem na lista (para reordenar)
}

export interface JoinClause {
  id: string;                  // ID único do JOIN
  type: JoinType;              // INNER, LEFT, RIGHT, FULL
  targetTable: string;         // ID da tabela alvo
  targetAlias?: string;        // Alias da tabela alvo
  condition: JoinCondition;     // Condição ON
  relationshipId?: string;      // ID do relacionamento usado (opcional)
  path?: string[];             // Caminho no grafo (ex: ["A", "B", "C"])
}

export interface JoinCondition {
  leftTable: string;           // ID da tabela esquerda
  leftColumn: string;          // Coluna esquerda
  rightTable: string;          // ID da tabela direita
  rightColumn: string;         // Coluna direita
  operator?: string;           // "=" (padrão), "!=", ">", etc.
}

export interface WhereClause {
  conditions: WhereCondition[];
  operator?: 'AND' | 'OR';
}

export interface WhereCondition {
  table: string;
  column: string;
  operator: string;            // "=", ">", "<", "LIKE", etc.
  value: any;
}

export interface GroupByClause {
  fields: Array<{ table: string; column: string }>;
}

export interface OrderByClause {
  fields: Array<{
    table: string;
    column: string;
    direction: 'ASC' | 'DESC';
  }>;
}

export interface LimitClause {
  limit: number;
  offset?: number;
}

// Resultado da busca de caminho no grafo
export interface PathResult {
  path: string[];              // ["A", "B", "C"]
  edges: GraphEdge[];          // Arestas usadas no caminho
  distance: number;            // Número de hops
}

// Estado do Query Builder
export interface QueryBuilderState {
  ast: QueryAST;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  selectedBaseTable: string | null;
  expandedTables: Set<string>;
  selectedColumns: Map<string, SelectField>;
  joins: Map<string, JoinClause>;
  errors: ValidationError[];
}

// Erros de validação
export interface ValidationError {
  type: 'missing_table' | 'duplicate_column' | 'invalid_join' | 'circular_join' | 'missing_join';
  message: string;
  field?: string;
}

// Props para componentes
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
  onDrop: (tableId: string, column: string) => void;
}

export interface JoinEditorProps {
  joins: JoinClause[];
  onEdit: (joinId: string, updates: Partial<JoinClause>) => void;
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

