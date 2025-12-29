import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { join } from 'path';
import { promises as fs } from 'fs';
import { uiConfigStorage } from '../storage/ui-config.js';

const router = Router();

// Configurar multer para upload de imagens
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadsDir = uiConfigStorage.getUploadsDir();
    await fs.mkdir(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Gerar nome único para o arquivo
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, `background-${uniqueSuffix}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use apenas imagens (JPEG, PNG, GIF, WebP).'));
    }
  },
});

// Obter configuração de UI
router.get('/config', async (req: Request, res: Response) => {
  try {
    const config = uiConfigStorage.get();
    res.json({
      loginBackground: config.loginBackground || 'background.png',
      loginBackgroundOpacity: config.loginBackgroundOpacity ?? 0.4,
    });
  } catch (error) {
    console.error('Erro ao obter configuração UI:', error);
    res.status(500).json({ error: 'Erro ao obter configuração' });
  }
});

// Atualizar configuração de UI (opacidade do background)
router.post('/config', async (req: Request, res: Response) => {
  try {
    const { loginBackgroundOpacity } = req.body;
    if (loginBackgroundOpacity !== undefined) {
      if (typeof loginBackgroundOpacity !== 'number' || loginBackgroundOpacity < 0 || loginBackgroundOpacity > 1) {
        return res.status(400).json({ error: 'Opacidade deve ser um número entre 0 e 1' });
      }
      // Preservar configuração existente (especialmente o background)
      const currentConfig = uiConfigStorage.get();
      await uiConfigStorage.set({ 
        ...currentConfig,
        loginBackgroundOpacity 
      });
    }
    res.json({ success: true, message: 'Configuração salva com sucesso' });
  } catch (error: any) {
    console.error('Erro ao salvar configuração UI:', error);
    res.status(500).json({ error: error.message || 'Erro ao salvar configuração' });
  }
});

// Upload de background do login
router.post('/upload-background', upload.single('background'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado' });
    }

    const filename = req.file.filename;
    
    // Salvar configuração mantendo a opacidade existente
    const currentConfig = uiConfigStorage.get();
    await uiConfigStorage.set({ 
      ...currentConfig,
      loginBackground: filename 
    });

    res.json({
      success: true,
      filename,
      message: 'Background atualizado com sucesso',
    });
  } catch (error: any) {
    console.error('Erro ao fazer upload do background:', error);
    res.status(500).json({ 
      error: error.message || 'Erro ao fazer upload do background' 
    });
  }
});

// Servir arquivos de upload
router.get('/uploads/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const uploadsDir = uiConfigStorage.getUploadsDir();
    const filePath = join(uploadsDir, filename);

    // Verificar se arquivo existe
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.sendFile(filePath);
  } catch (error) {
    console.error('Erro ao servir arquivo:', error);
    res.status(500).json({ error: 'Erro ao servir arquivo' });
  }
});

export default router;

