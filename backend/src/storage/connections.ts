import { promises as fs } from 'fs';
import { join } from 'path';
import type { DatabaseConnection } from '../types/index.js';

const STORAGE_FILE = join(process.cwd(), 'data', 'connections.json');

// Garantir que o diretório existe
async function ensureDataDir(): Promise<void> {
  const dataDir = join(process.cwd(), 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Carregar conexões do arquivo
async function loadConnections(): Promise<Map<string, DatabaseConnection>> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(STORAGE_FILE, 'utf-8');
    const connections: DatabaseConnection[] = JSON.parse(data);
    
    // Converter createdAt de string para Date
    const map = new Map<string, DatabaseConnection>();
    for (const conn of connections) {
      map.set(conn.id, {
        ...conn,
        createdAt: new Date(conn.createdAt),
      });
    }
    return map;
  } catch (error: any) {
    // Se o arquivo não existe, retornar Map vazio
    if (error.code === 'ENOENT') {
      return new Map();
    }
    console.error('Erro ao carregar conexões:', error);
    return new Map();
  }
}

// Salvar conexões no arquivo
async function saveConnections(connections: Map<string, DatabaseConnection>): Promise<void> {
  try {
    await ensureDataDir();
    const array = Array.from(connections.values());
    await fs.writeFile(STORAGE_FILE, JSON.stringify(array, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erro ao salvar conexões:', error);
    throw error;
  }
}

// Storage persistente para conexões
class ConnectionStorage {
  private connections: Map<string, DatabaseConnection> = new Map();
  private initialized: boolean = false;

  // Inicializar carregando do arquivo
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.connections = await loadConnections();
    this.initialized = true;
    console.log(`[Storage] Carregadas ${this.connections.size} conexões do arquivo`);
  }

  getAll(): DatabaseConnection[] {
    return Array.from(this.connections.values());
  }

  get(id: string): DatabaseConnection | undefined {
    return this.connections.get(id);
  }

  async set(conn: DatabaseConnection): Promise<void> {
    this.connections.set(conn.id, conn);
    await saveConnections(this.connections);
  }

  async delete(id: string): Promise<boolean> {
    const deleted = this.connections.delete(id);
    if (deleted) {
      await saveConnections(this.connections);
    }
    return deleted;
  }

  has(id: string): boolean {
    return this.connections.has(id);
  }
}

export const connectionStorage = new ConnectionStorage();
