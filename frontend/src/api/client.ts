import axios from 'axios';

// Obter URL da API da configuração, removendo /api se já estiver presente
const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  // Remover /api do final se existir, pois vamos adicionar depois
  const baseUrl = envUrl.replace(/\/api\/?$/, '');
  return `${baseUrl}/api`;
};

export const api = axios.create({
  baseURL: getApiUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 65000, // 65 segundos (um pouco mais que o backend para evitar cortes)
});

export type DatabaseType = 'mysql' | 'sqlserver';

export interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  host: string;
  port: number;
  user: string;
  database: string;
  ssl?: boolean;
  createdAt: string;
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

export interface GraphNode {
  id: string;
  label: string;
  type: 'table' | 'view';
  schema?: string;
  columns: Column[];
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
  startTime: string;
  elapsedTime: number;
  sqlText: string;
  blocking?: number[];
}

export const connectionsApi = {
  getAll: () => api.get<DatabaseConnection[]>('/connections'),
  get: (id: string) => api.get<DatabaseConnection>(`/connections/${id}`),
  create: (data: Omit<DatabaseConnection, 'id' | 'createdAt'>) =>
    api.post<DatabaseConnection>('/connections', data),
  update: (id: string, data: Omit<DatabaseConnection, 'id' | 'createdAt'>) =>
    api.put<DatabaseConnection>(`/connections/${id}`, data),
  test: (data: Omit<DatabaseConnection, 'id' | 'createdAt'>) =>
    api.post<{ valid: boolean }>('/connections/test', data),
  delete: (id: string) => api.delete(`/connections/${id}`),
};

export interface SchemaCacheMetadata {
  lastUpdated: string;
  version: number;
}

export interface SchemaStats {
  hasCache: boolean;
  lastUpdated: string | null;
  tables: number;
  views: number;
  foreignKeys: number;
  nodes: number;
  edges: number;
}

export interface RefreshSchemaResponse {
  success: boolean;
  message: string;
  cacheMetadata: SchemaCacheMetadata | null;
  metadata: {
    tables: number;
    views: number;
    foreignKeys: number;
    nodes: number;
    edges: number;
  };
}

export const schemaApi = {
  get: (connId: string) => api.get(`/schema/${connId}`),
  getGraph: (connId: string) => api.get<GraphData>(`/schema/${connId}/graph`),
  getDDL: (connId: string) => api.get<string>(`/schema/${connId}/ddl`, {
    responseType: 'text',
  }),
  refresh: (connId: string) => api.post<RefreshSchemaResponse>(`/schema/${connId}/refresh`),
  getCacheMetadata: (connId: string) => api.get<SchemaCacheMetadata>(`/schema/${connId}/cache-metadata`),
  getStats: (connId: string) => api.get<SchemaStats>(`/schema/${connId}/stats`),
};

export const monitoringApi = {
  getActiveQueries: (connId: string) =>
    api.get<ActiveQuery[]>(`/monitoring/${connId}/active-queries`),
  getQueryStats: (connId: string) =>
    api.get(`/monitoring/${connId}/query-stats`),
};

export interface OpenAIConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface OpenAIConfigResponse {
  configured: boolean;
  apiKey?: string; // Mascarada
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateSQLRequest {
  prompt: string;
  connId: string;
}

export interface GenerateSQLResponse {
  sql: string;
  model: string;
  tokensUsed: number;
}

export interface ExecuteSQLRequest {
  sql: string;
  connId: string;
}

export interface ExecuteSQLResponse {
  rows: any[];
  columns: string[];
  totalRows: number;
  displayedRows: number;
  hasMore: boolean;
}

export interface AnalyzeSQLRequest {
  sql: string;
  connId: string;
  complementaryPrompt?: string;
}

export interface AnalyzeSQLResponse {
  analysis: string;
  model: string;
  tokensUsed: number;
}

export const openaiApi = {
  getConfig: () => api.get<OpenAIConfigResponse>('/openai/config'),
  saveConfig: (config: OpenAIConfig) => api.post('/openai/config', config),
  testConfig: (config: OpenAIConfig) => api.post<{ valid: boolean; error?: string }>('/openai/config/test', config),
  generateSQL: (data: GenerateSQLRequest) => api.post<GenerateSQLResponse>('/openai/generate-sql', data),
  executeSQL: (data: ExecuteSQLRequest) => api.post<ExecuteSQLResponse>('/openai/execute-sql', data),
  analyzeSQL: (data: AnalyzeSQLRequest) => api.post<AnalyzeSQLResponse>('/openai/analyze-sql', data),
};

export const queryApi = {
  execute: (connId: string, sql: string) => api.post<ExecuteSQLResponse>(`/query/${connId}/execute`, { sql }),
};

export interface UIConfig {
  loginBackground?: string;
  loginBackgroundOpacity?: number;
}

export const uiApi = {
  getConfig: () => api.get<UIConfig>('/ui/config'),
  saveConfig: (config: Partial<UIConfig>) => api.post<{ success: boolean; message: string }>('/ui/config', config),
  uploadBackground: (file: File) => {
    const formData = new FormData();
    formData.append('background', file);
    return api.post<{ success: boolean; filename: string; message: string }>('/ui/upload-background', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};


