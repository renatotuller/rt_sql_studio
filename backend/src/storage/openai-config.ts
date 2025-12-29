import { promises as fs } from 'fs';
import { join } from 'path';

export interface OpenAIConfig {
  apiKey: string;
  model?: string; // Modelo a usar (padrão: gpt-4o-mini ou gpt-3.5-turbo)
  maxTokens?: number; // Máximo de tokens na resposta
  temperature?: number; // Temperatura (0-2, padrão: 0.3 para SQL)
}

const STORAGE_FILE = join(process.cwd(), 'data', 'openai-config.json');

// Garantir que o diretório existe
async function ensureDataDir(): Promise<void> {
  const dataDir = join(process.cwd(), 'data');
  try {
    await fs.access(dataDir);
  } catch {
    await fs.mkdir(dataDir, { recursive: true });
  }
}

// Carregar configuração do arquivo
async function loadConfig(): Promise<OpenAIConfig | null> {
  try {
    await ensureDataDir();
    const data = await fs.readFile(STORAGE_FILE, 'utf-8');
    return JSON.parse(data) as OpenAIConfig;
  } catch (error: any) {
    // Se o arquivo não existe, retornar null
    if (error.code === 'ENOENT') {
      return null;
    }
    console.error('Erro ao carregar configuração OpenAI:', error);
    return null;
  }
}

// Salvar configuração no arquivo
async function saveConfig(config: OpenAIConfig): Promise<void> {
  try {
    await ensureDataDir();
    await fs.writeFile(STORAGE_FILE, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    console.error('Erro ao salvar configuração OpenAI:', error);
    throw error;
  }
}

// Storage persistente para configuração OpenAI
class OpenAIConfigStorage {
  private config: OpenAIConfig | null = null;
  private initialized: boolean = false;

  // Inicializar carregando do arquivo
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.config = await loadConfig();
    this.initialized = true;
    if (this.config) {
      console.log('[Storage] Configuração OpenAI carregada');
    } else {
      console.log('[Storage] Nenhuma configuração OpenAI encontrada');
    }
  }

  get(): OpenAIConfig | null {
    return this.config;
  }

  async set(config: OpenAIConfig): Promise<void> {
    this.config = config;
    await saveConfig(config);
  }

  hasConfig(): boolean {
    return this.config !== null && this.config.apiKey !== '';
  }
}

export const openAIConfigStorage = new OpenAIConfigStorage();








