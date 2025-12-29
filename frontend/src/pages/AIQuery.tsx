import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  AutoAwesome as SparklesIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  PlayArrow as PlayIcon,
  ErrorOutline as AlertCircleIcon,
  Settings as SettingsIcon,
  Storage as DatabaseIcon,
} from '@mui/icons-material';
import { openaiApi, connectionsApi, type ExecuteSQLResponse } from '../api/client';
import ViewSwitcher from '../components/ViewSwitcher';

export default function AIQuery() {
  const theme = useTheme();
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const [connectionName, setConnectionName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [queryResults, setQueryResults] = useState<ExecuteSQLResponse | null>(null);
  const [configStatus, setConfigStatus] = useState<{ configured: boolean } | null>(null);

  useEffect(() => {
    if (connId) {
      loadConnection();
      checkConfig();
    }
  }, [connId]);

  const loadConnection = async () => {
    try {
      const response = await connectionsApi.get(connId!);
      setConnectionName(response.data.name);
    } catch (error) {
      console.error('Erro ao carregar conexão:', error);
    }
  };

  const checkConfig = async () => {
    try {
      const response = await openaiApi.getConfig();
      setConfigStatus({ configured: response.data.configured });
    } catch (error) {
      console.error('Erro ao verificar configuração:', error);
      setConfigStatus({ configured: false });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Por favor, descreva o que você quer buscar');
      return;
    }

    if (!configStatus?.configured) {
      setError('Configure a API da OpenAI nas configurações primeiro');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedSQL('');
    setQueryResults(null);
    setExecutionError(null);

    try {
      const response = await openaiApi.generateSQL({
        prompt: prompt.trim(),
        connId: connId!,
      });
      setGeneratedSQL(response.data.sql);
    } catch (error: any) {
      console.error('Erro ao gerar SQL:', error);
      
      // Tratamento específico para diferentes tipos de erro
      if (error.code === 'ERR_NETWORK' || error.message?.includes('ERR_CONNECTION_RESET') || error.message?.includes('Network Error')) {
        setError(
          'Erro de conexão com o servidor. ' +
          'Verifique se o backend está rodando na porta 3001. ' +
          'Reinicie o servidor backend e tente novamente.'
        );
      } else if (error.response?.status === 429) {
        const errorType = error.response?.data?.errorType;
        const helpUrl = error.response?.data?.helpUrl;
        const limit = error.response?.data?.limit;
        const requested = error.response?.data?.requested;
        
        if (errorType === 'insufficient_quota') {
          setError(
            'Quota insuficiente na OpenAI. ' +
            'Você não tem créditos suficientes na sua conta. ' +
            (helpUrl ? `Adicione créditos em: ${helpUrl}` : 'Acesse https://platform.openai.com/account/billing para adicionar créditos.')
          );
        } else if (errorType === 'tokens_per_minute') {
          setError(
            `Limite de tokens por minuto excedido. ` +
            `O schema do banco é muito grande (${requested ? requested.toLocaleString() : 'muitos'} tokens). ` +
            `O limite do modelo é ${limit ? limit.toLocaleString() : '200.000'} tokens/min. ` +
            `Aguarde 1 minuto e tente novamente, ou use um modelo com maior limite (gpt-4o) nas configurações.`
          );
        } else if (errorType === 'rate_limit_exceeded') {
          setError(
            'Rate limit excedido. ' +
            'Você atingiu o limite de requisições por minuto/hora. ' +
            'Aguarde alguns minutos e tente novamente.'
          );
        } else {
          setError(
            error.response?.data?.details ||
            'Limite excedido na OpenAI. ' +
            'Verifique sua conta em https://platform.openai.com/account/billing'
          );
        }
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        setError(
          'Erro de autenticação com a API da OpenAI. ' +
          'Verifique se a API Key está correta nas configurações.'
        );
      } else if (error.response?.status >= 500) {
        setError(
          'Erro interno do servidor. ' +
          'Verifique os logs do backend para mais detalhes.'
        );
      } else {
        setError(
          error.response?.data?.error || 
          error.response?.data?.details || 
          error.message ||
          'Erro ao gerar SQL. Verifique se a API Key está configurada corretamente e se o backend está rodando.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedSQL) {
      navigator.clipboard.writeText(generatedSQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExecute = async () => {
    if (!generatedSQL || !connId) {
      return;
    }

    setExecuting(true);
    setExecutionError(null);
    setQueryResults(null);

    try {
      const response = await openaiApi.executeSQL({
        sql: generatedSQL,
        connId: connId,
      });
      setQueryResults(response.data);
    } catch (error: any) {
      console.error('Erro ao executar SQL:', error);
      setExecutionError(
        error.response?.data?.error || 
        error.response?.data?.details || 
        'Erro ao executar query SQL'
      );
    } finally {
      setExecuting(false);
    }
  };

  const examplePrompts = [
    'Mostre todos os produtos ordenados por nome',
    'Liste os clientes que fizeram compras no último mês com o valor total',
    'Quais produtos estão com estoque abaixo de 10 unidades?',
  ];

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflowX: 'hidden', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Bar com título e botões de ação */}
      <Box 
        sx={{ 
          flexShrink: 0, 
          px: 2, 
          py: 0.5, 
          borderBottom: 1, 
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton
            onClick={() => navigate(`/schema/${connId}`)}
            size="small"
            sx={{
              p: 0.5,
              color: 'text.secondary',
              '&:hover': {
                color: 'text.primary',
                bgcolor: 'action.hover',
              },
            }}
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.2 }}>
            Consulta IA: {connectionName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ViewSwitcher currentView="ai-query" />
          <Button
            onClick={() => navigate('/settings')}
            variant="outlined"
            size="small"
            startIcon={<SettingsIcon fontSize="small" />}
            sx={{
              px: 1.5,
              py: 0.25,
              minHeight: 'auto',
              fontSize: '0.6875rem',
              fontWeight: 500,
              textTransform: 'none',
              borderRadius: 1.5,
              borderColor: theme.palette.divider,
              color: theme.palette.text.primary,
              '&:hover': {
                borderColor: theme.palette.divider,
                backgroundColor: alpha(theme.palette.action.hover, 0.04),
              },
            }}
          >
            Configurações
          </Button>
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', p: 3, maxWidth: 1200, mx: 'auto' }}>
        {/* Alerta se não estiver configurado */}
        {configStatus && !configStatus.configured && (
          <Alert
            severity="warning"
            icon={<AlertCircleIcon />}
            sx={{ mb: 3 }}
            action={
              <Button
                onClick={() => navigate('/settings')}
                size="small"
                sx={{ fontSize: '0.8125rem' }}
              >
                Ir para Configurações
              </Button>
            }
          >
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              Configuração Necessária
            </Typography>
            <Typography variant="body2">
              Para usar o gerador de SQL com IA, você precisa configurar a API Key da OpenAI.
            </Typography>
          </Alert>
        )}

        {/* Input de Prompt */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 1.5 }}>
              Descreva o que você quer buscar:
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ex: Mostre todos os produtos com preço maior que 100 e estoque menor que 50, ordenados por nome"
              disabled={loading || !configStatus?.configured}
              sx={{ mb: 1.5 }}
            />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color="text.secondary">
                Descreva em linguagem natural o que você quer buscar no banco de dados
              </Typography>
              <Button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim() || !configStatus?.configured}
                variant="contained"
                startIcon={loading ? <CircularProgress size={16} /> : <SparklesIcon />}
                sx={{ fontSize: '0.8125rem' }}
              >
                {loading ? 'Gerando...' : 'Gerar SQL'}
              </Button>
            </Box>
          </CardContent>
        </Card>

        {/* Erro */}
        {error && (
          <Alert severity="error" icon={<AlertCircleIcon />} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              Erro
            </Typography>
            <Typography variant="body2">{error}</Typography>
          </Alert>
        )}

        {/* SQL Gerado */}
        {generatedSQL && (
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h6" fontWeight={600}>
                  SQL Gerado:
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    onClick={handleCopy}
                    variant="outlined"
                    size="small"
                    startIcon={copied ? <CheckIcon /> : <CopyIcon />}
                    sx={{ fontSize: '0.8125rem' }}
                  >
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                  <Button
                    onClick={handleExecute}
                    disabled={executing || !generatedSQL}
                    variant="contained"
                    size="small"
                    startIcon={executing ? <CircularProgress size={16} /> : <PlayIcon />}
                    sx={{ fontSize: '0.8125rem' }}
                  >
                    {executing ? 'Executando...' : 'Executar Query'}
                  </Button>
                </Box>
              </Box>
              <Paper
                elevation={0}
                sx={{
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  p: 2,
                  borderRadius: 1,
                  overflowX: 'auto',
                }}
              >
                <Box
                  component="code"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    whiteSpace: 'pre',
                  }}
                >
                  {generatedSQL}
                </Box>
              </Paper>
            </CardContent>
          </Card>
        )}

        {/* Erro na Execução */}
        {executionError && (
          <Alert severity="error" icon={<AlertCircleIcon />} sx={{ mb: 3 }}>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 0.5 }}>
              Erro ao Executar Query
            </Typography>
            <Typography variant="body2">{executionError}</Typography>
          </Alert>
        )}

        {/* Resultados da Query */}
        {queryResults && (
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <DatabaseIcon />
                  <Typography variant="h6" fontWeight={600}>
                    Resultados da Query
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {queryResults.hasMore ? (
                    <Chip
                      label={`Mostrando ${queryResults.displayedRows} de ${queryResults.totalRows} resultados`}
                      size="small"
                      color="warning"
                      sx={{ fontSize: '0.75rem' }}
                    />
                  ) : (
                    `${queryResults.totalRows} ${queryResults.totalRows === 1 ? 'resultado' : 'resultados'}`
                  )}
                </Typography>
              </Box>
              
              {queryResults.rows.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                  <Typography variant="body1">Nenhum resultado encontrado</Typography>
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        {queryResults.columns.map((column, idx) => (
                          <TableCell
                            key={idx}
                            sx={{
                              fontWeight: 600,
                              fontSize: '0.75rem',
                              textTransform: 'uppercase',
                            }}
                          >
                            {column}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {queryResults.rows.map((row, rowIdx) => (
                        <TableRow key={rowIdx} hover>
                          {queryResults.columns.map((column, colIdx) => (
                            <TableCell key={colIdx}>
                              {row[column] !== null && row[column] !== undefined
                                ? String(row[column])
                                : <Typography component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>NULL</Typography>}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        )}

        {/* Exemplos */}
        {!generatedSQL && !loading && (
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Exemplos de Prompts:
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {examplePrompts.map((example, idx) => (
                  <Paper
                    key={idx}
                    elevation={0}
                    onClick={() => setPrompt(example)}
                    sx={{
                      p: 1.5,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                      cursor: 'pointer',
                      '&:hover': {
                        bgcolor: 'action.selected',
                      },
                    }}
                  >
                    <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                      "{example}"
                    </Typography>
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}
