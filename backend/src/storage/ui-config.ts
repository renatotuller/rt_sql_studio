import { promises as fs } from 'fs';
import { join } from 'path';

const CONFIG_FILE = join(process.cwd(), 'data', 'ui-config.json');
const UPLOADS_DIR = join(process.cwd(), 'data', 'uploads');

interface UIConfig {
  loginBackground?: string; // Nome do arquivo ou URL
  loginBackgroundOpacity?: number; // Opacidade do background (0-1)
}

class UIConfigStorage {
  private config: UIConfig | null = null;

  async initialize() {
    try {
      // Criar diretório de uploads se não existir
      await fs.mkdir(UPLOADS_DIR, { recursive: true });
      
      // Criar diretório data se não existir
      await fs.mkdir(join(process.cwd(), 'data'), { recursive: true });

      // Carregar configuração
      try {
        const data = await fs.readFile(CONFIG_FILE, 'utf-8');
        this.config = JSON.parse(data);
      } catch {
        // Arquivo não existe, usar padrão
        this.config = { loginBackground: 'background.png', loginBackgroundOpacity: 0.4 };
        await this.save();
      }
    } catch (error) {
      console.error('[UIConfig] Erro ao inicializar:', error);
      this.config = { loginBackground: 'background.png' };
    }
  }

  get(): UIConfig {
    return this.config || { loginBackground: 'background.png' };
  }

  async set(config: Partial<UIConfig>) {
    this.config = { ...this.get(), ...config };
    await this.save();
  }

  private async save() {
    try {
      await fs.writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('[UIConfig] Erro ao salvar:', error);
      throw error;
    }
  }

  getUploadsDir(): string {
    return UPLOADS_DIR;
  }
}

export const uiConfigStorage = new UIConfigStorage();

