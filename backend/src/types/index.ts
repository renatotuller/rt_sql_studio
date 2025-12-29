export type DatabaseType = 'mysql' | 'sqlserver';

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  ssl?: boolean;
  createdAt: Date;
}

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string;
  comment?: string;
}

export interface Table {
  name: string;
  schema?: string;
  columns: Column[];
  primaryKeys: string[];
  indexes: Index[];
}

export interface Index {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface ForeignKey {
  name: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
}

export interface View {
  name: string;
  schema?: string;
  definition: string;
  columns: Column[];
}

export interface Trigger {
  name: string;
  table: string;
  event: string;
  timing: string;
  definition: string;
}

export interface SchemaInfo {
  tables: Table[];
  views: View[];
  triggers: Trigger[];
  foreignKeys: ForeignKey[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: 'table' | 'view';
  schema?: string;
  columns: Column[];
  position?: { x: number; y: number };
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  fromColumn: string;
  toColumn: string;
  label?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ActiveQuery {
  id: string;
  sessionId: number;
  user: string;
  host: string;
  database?: string;
  status: string;
  command: string;
  startTime: Date;
  elapsedTime: number;
  sqlText: string;
  blocking?: number[];
}

export interface QueryStats {
  sqlText: string;
  executionCount: number;
  totalElapsedTime: number;
  avgElapsedTime: number;
  minElapsedTime: number;
  maxElapsedTime: number;
}


