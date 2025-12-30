import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Chip,
  useTheme,
  alpha,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Save as SaveIcon,
  Science as TestTubeIcon,
  Key as KeyIcon,
  Psychology as BrainIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as XCircleIcon,
  Info as AlertCircleIcon,
  Image as ImageIcon,
  Upload as UploadIcon,
  Info as InfoIcon,
} from '@mui/icons-material';
import { openaiApi, uiApi, type OpenAIConfig } from '../api/client';

export default function Settings() {
  const theme = useTheme();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message?: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [uploadingBackground, setUploadingBackground] = useState(false);
  const [backgroundUploaded, setBackgroundUploaded] = useState(false);
  const [currentBackground, setCurrentBackground] = useState<string>('background.png');
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(0.4);
  const [savingOpacity, setSavingOpacity] = useState(false);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [imageKey, setImageKey] = useState(0); // Para forçar re-render da imagem
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [config, setConfig] = useState<OpenAIConfig>({
    apiKey: '',
    model: 'gpt-4o-mini',
    maxTokens: 2000,
    temperature: 0.3,
  });

  useEffect(() => {
    loadConfig();
    loadUIConfig();
  }, []);

  const loadUIConfig = async () => {
    try {
      const response = await uiApi.getConfig();
      if (response.data.loginBackground) {
        setCurrentBackground(response.data.loginBackground);
      }
      if (response.data.loginBackgroundOpacity !== undefined) {
        setBackgroundOpacity(response.data.loginBackgroundOpacity);
      }
    } catch (error) {
      console.error('Erro ao carregar configuração UI:', error);
    }
  };

  const handleOpacityChange = async (_: React.SyntheticEvent | Event, value: number | number[]) => {
    const opacity = Array.isArray(value) ? value[0] : value;
    setBackgroundOpacity(opacity);
    
    // Salvar automaticamente após mudança
    setSavingOpacity(true);
    try {
      await uiApi.saveConfig({ loginBackgroundOpacity: opacity });
    } catch (error) {
      console.error('Erro ao salvar opacidade:', error);
    } finally {
      setSavingOpacity(false);
    }
  };

  const loadConfig = async () => {
    try {
      const response = await openaiApi.getConfig();
      if (response.data.configured && response.data.apiKey) {
        // Se já está configurado, não mostrar a key (por segurança)
        // O usuário precisará re-inserir se quiser alterar
        setConfig({
          apiKey: '', // Não carregar a key por segurança
          model: response.data.model || 'gpt-4o-mini',
          maxTokens: response.data.maxTokens || 2000,
          temperature: response.data.temperature || 0.3,
        });
      }
    } catch (error) {
      console.error('Erro ao carregar configuração:', error);
    }
  };

  const handleTest = async () => {
    if (!config.apiKey.trim()) {
      setTestResult({ valid: false, message: 'Por favor, insira a API Key primeiro' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const response = await openaiApi.testConfig(config);
      if (response.data.valid) {
        setTestResult({ valid: true, message: 'API Key válida!' });
      } else {
        setTestResult({ valid: false, message: response.data.error || 'API Key inválida' });
      }
    } catch (error: any) {
      setTestResult({ 
        valid: false, 
        message: error.response?.data?.error || 'Erro ao testar configuração' 
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!config.apiKey.trim()) {
      setTestResult({ valid: false, message: 'API Key é obrigatória' });
      return;
    }

    setLoading(true);
    setSaved(false);
    try {
      await openaiApi.saveConfig(config);
      setSaved(true);
      setTestResult(null);
      setTimeout(() => setSaved(false), 3000);
    } catch (error: any) {
      setTestResult({ 
        valid: false, 
        message: error.response?.data?.error || 'Erro ao salvar configuração' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setTestResult({ valid: false, message: 'Tipo de arquivo não permitido. Use apenas imagens (JPEG, PNG, GIF, WebP).' });
      return;
    }

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setTestResult({ valid: false, message: 'Arquivo muito grande. Tamanho máximo: 5MB.' });
      return;
    }

    setUploadingBackground(true);
    setBackgroundUploaded(false);
    setTestResult(null);

    try {
      const response = await uiApi.uploadBackground(file);
      setCurrentBackground(response.data.filename);
      setImageKey(prev => prev + 1); // Força re-render da imagem
      setBackgroundUploaded(true);
      setTestResult({ valid: true, message: 'Background atualizado com sucesso! Recarregue a página de login para ver as alterações.' });
      setTimeout(() => {
        setBackgroundUploaded(false);
        setTestResult(null);
      }, 5000);
    } catch (error: any) {
      setTestResult({ 
        valid: false, 
        message: error.response?.data?.error || 'Erro ao fazer upload do background' 
      });
    } finally {
      setUploadingBackground(false);
      // Limpar input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 2 }}>
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        <Box sx={{ mb: 3 }}>
          <Typography variant="body2" color="text.secondary">
            Configure a integração com a API da OpenAI para gerar queries SQL
          </Typography>
        </Box>

        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Configuração OpenAI
            </Typography>
            <IconButton
              size="small"
              onClick={() => setInfoDialogOpen(true)}
              sx={{
                color: theme.palette.info.main,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <InfoIcon fontSize="small" />
            </IconButton>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Para usar o gerador de SQL com IA, você precisa de uma API Key da OpenAI.
            Obtenha sua chave em{' '}
            <Box
              component="a"
              href="https://platform.openai.com/api-keys"
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                color: theme.palette.primary.main,
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline',
                },
              }}
            >
              platform.openai.com/api-keys
            </Box>
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3, mb: 3 }}>
            {/* API Key */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                API Key *
              </Typography>
              <TextField
                type="password"
                fullWidth
                size="small"
                value={config.apiKey}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                placeholder="sk-..."
                sx={{ mb: 0.5 }}
              />
              <Typography variant="caption" color="text.secondary">
                Sua API Key é armazenada de forma segura no servidor
              </Typography>
            </Box>

            {/* Model */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                Modelo
              </Typography>
              <FormControl fullWidth size="small">
                <Select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                >
                  <MenuItem value="gpt-4o-mini">GPT-4o Mini (Recomendado - Mais econômico)</MenuItem>
                  <MenuItem value="gpt-4o">GPT-4o (Mais preciso, mais caro)</MenuItem>
                  <MenuItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Econômico)</MenuItem>
                </Select>
              </FormControl>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Modelo da IA a ser usado para gerar SQL
              </Typography>
            </Box>

            {/* Max Tokens */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                Máximo de Tokens
              </Typography>
              <TextField
                type="number"
                fullWidth
                size="small"
                value={config.maxTokens}
                onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 2000 })}
                inputProps={{ min: 100, max: 4000 }}
                sx={{ mb: 0.5 }}
              />
              <Typography variant="caption" color="text.secondary">
                Limite máximo de tokens na resposta (padrão: 2000)
              </Typography>
            </Box>

            {/* Temperature */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                Temperatura: {config.temperature}
              </Typography>
              <Slider
                value={config.temperature}
                onChange={(_, value) => setConfig({ ...config, temperature: value as number })}
                min={0}
                max={2}
                step={0.1}
                marks={[
                  { value: 0, label: '0' },
                  { value: 1, label: '1' },
                  { value: 2, label: '2' },
                ]}
                sx={{ mb: 1 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Determinístico
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Balanceado
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Criativo
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Valores menores geram SQL mais consistente (recomendado: 0.3)
              </Typography>
            </Box>
          </Box>

          {/* Test Result */}
          {testResult && (
            <Alert
              severity={testResult.valid ? 'success' : 'error'}
              icon={testResult.valid ? <CheckCircleIcon /> : <XCircleIcon />}
            >
              {testResult.message}
            </Alert>
          )}

          {/* Saved Message */}
          {saved && (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              Configuração salva com sucesso!
            </Alert>
          )}

          {/* Actions */}
          <Box
            sx={{
              display: 'flex',
              gap: 1.5,
              pt: 2,
              borderTop: `1px solid ${theme.palette.divider}`,
            }}
          >
            <Button
              variant="outlined"
              startIcon={testing ? <CircularProgress size={16} color="inherit" /> : <TestTubeIcon />}
              onClick={handleTest}
              disabled={testing || !config.apiKey.trim()}
              sx={{ textTransform: 'none' }}
            >
              {testing ? 'Testando...' : 'Testar API Key'}
            </Button>
            <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <SaveIcon />}
              onClick={handleSave}
              disabled={loading || !config.apiKey.trim()}
              sx={{ textTransform: 'none' }}
            >
              {loading ? 'Salvando...' : 'Salvar Configuração'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Configuração de Background */}
      <Card>
        <CardContent sx={{ p: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
            Background da Tela de Login
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Personalize o background da tela de login fazendo upload de uma imagem personalizada.
          </Typography>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 3 }}>
            {/* Coluna 1: Imagem e Upload */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                Imagem Atual
              </Typography>
              <Box
                sx={{
                  width: '100%',
                  minHeight: 200,
                  maxHeight: 500,
                  borderRadius: 0,
                  overflow: 'hidden',
                  border: `1px solid ${theme.palette.divider}`,
                  backgroundColor: theme.palette.background.default,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mb: 2,
                }}
              >
                {currentBackground && (
                  <img
                    key={imageKey}
                    src={currentBackground.startsWith('background-') ? `/api/ui/uploads/${currentBackground}?t=${Date.now()}` : `/${currentBackground}?t=${Date.now()}`}
                    alt="Login Background Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      height: 'auto',
                      width: 'auto',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                    onError={(e) => {
                      console.error('Erro ao carregar imagem:', currentBackground);
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Background atual: {currentBackground}
              </Typography>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                onChange={handleBackgroundUpload}
                style={{ display: 'none' }}
              />
              <Button
                variant="outlined"
                fullWidth
                startIcon={uploadingBackground ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingBackground}
                sx={{ textTransform: 'none', mb: 1 }}
              >
                {uploadingBackground ? 'Enviando...' : 'Selecionar e Enviar Imagem'}
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Formatos: JPEG, PNG, GIF, WebP. Máx: 5MB
              </Typography>
            </Box>

            {/* Coluna 2: Slider de Opacidade */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                Esmaecimento do Background
              </Typography>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: theme.palette.primary.main }}>
                {Math.round(backgroundOpacity * 100)}%
              </Typography>
              <Slider
                value={backgroundOpacity}
                onChange={handleOpacityChange}
                min={0}
                max={1}
                step={0.05}
                marks={[
                  { value: 0, label: '0%' },
                  { value: 0.5, label: '50%' },
                  { value: 1, label: '100%' },
                ]}
                sx={{ mb: 1 }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Transparente
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Opaco
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Ajuste a opacidade do background da tela de login
                {savingOpacity && ' (Salvando...)'}
              </Typography>
            </Box>
          </Box>

          {backgroundUploaded && (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mt: 2 }}>
              Background atualizado! Recarregue a página de login para ver as alterações.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Informações Importantes */}
      <Dialog
        open={infoDialogOpen}
        onClose={() => setInfoDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlertCircleIcon sx={{ color: theme.palette.warning.main }} />
            <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
              Informações Importantes
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box component="ul" sx={{ m: 0, pl: 2, listStyle: 'none' }}>
            <Box component="li" sx={{ mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                • Sua API Key é armazenada apenas no servidor backend
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                • O uso da API da OpenAI é pago por token utilizado
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                • Recomendamos usar GPT-4o Mini para reduzir custos
              </Typography>
            </Box>
            <Box component="li" sx={{ mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary">
                • A temperatura baixa (0.3) garante SQL mais consistente
              </Typography>
            </Box>
            <Box component="li">
              <Typography variant="body2" color="text.secondary">
                • O sistema gera apenas queries SELECT (sem modificações)
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoDialogOpen(false)} color="primary" sx={{ textTransform: 'none' }}>
            Fechar
          </Button>
        </DialogActions>
      </Dialog>
      </Box>
    </Box>
  );
}



