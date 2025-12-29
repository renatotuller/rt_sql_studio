import { promises as fs } from 'fs';
import { join } from 'path';
import type { SchemaInfo, GraphData } from '../types/index.js';

const CACHE_DIR = join(process.cwd(), 'data', 'schema-cache');

// Garantir que o diretório existe
async function ensureCacheDir(): Promise<void> {
  try {
    await fs.access(CACHE_DIR);
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  }
}

// Caminho do arquivo de cache para uma conexão
function getCachePath(connId: string): string {
  return join(CACHE_DIR, `${connId}.json`);
}

// Metadados do cache
export interface SchemaCacheMetadata {
  lastUpdated: string; // ISO string
  version: number; // Para futuras migrações
}

// Estrutura completa do cache
export interface SchemaCache {
  metadata: SchemaCacheMetadata;
  schema: SchemaInfo;
  graph: GraphData;
}

// Storage persistente para cache de schema
class SchemaCacheStorage {
  private initialized: boolean = false;

  // Inicializar criando diretório
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await ensureCacheDir();
    this.initialized = true;
  }

  // Obter cache de uma conexão
  async get(connId: string): Promise<SchemaCache | null> {
    try {
      await ensureCacheDir();
      const cachePath = getCachePath(connId);
      const data = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // Cache não existe
      }
      console.error(`[SchemaCache] Erro ao carregar cache para ${connId}:`, error);
      return null;
    }
  }

  // Salvar cache de uma conexão
  async set(connId: string, schema: SchemaInfo, graph: GraphData): Promise<void> {
    try {
      await ensureCacheDir();
      const cachePath = getCachePath(connId);
      
      const cache: SchemaCache = {
        metadata: {
          lastUpdated: new Date().toISOString(),
          version: 1,
        },
        schema,
        graph,
      };

      await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), 'utf-8');
      console.log(`[SchemaCache] Cache salvo para ${connId}`);
    } catch (error) {
      console.error(`[SchemaCache] Erro ao salvar cache para ${connId}:`, error);
      throw error;
    }
  }

  // Verificar se cache existe
  async has(connId: string): Promise<boolean> {
    try {
      await ensureCacheDir();
      const cachePath = getCachePath(connId);
      await fs.access(cachePath);
      return true;
    } catch {
      return false;
    }
  }

  // Deletar cache de uma conexão
  async delete(connId: string): Promise<boolean> {
    try {
      await ensureCacheDir();
      const cachePath = getCachePath(connId);
      await fs.unlink(cachePath);
      console.log(`[SchemaCache] Cache deletado para ${connId}`);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return false; // Já não existe
      }
      console.error(`[SchemaCache] Erro ao deletar cache para ${connId}:`, error);
      return false;
    }
  }

  // Obter apenas metadados (sem carregar tudo)
  async getMetadata(connId: string): Promise<SchemaCacheMetadata | null> {
    const cache = await this.get(connId);
    return cache?.metadata || null;
  }
}

export const schemaCacheStorage = new SchemaCacheStorage();







