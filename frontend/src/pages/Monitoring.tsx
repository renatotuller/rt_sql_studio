import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  IconButton,
  useTheme,
  alpha,
  Grid,
} from '@mui/material';
import {
  Timeline as ActivityIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { monitoringApi, connectionsApi, type ActiveQuery } from '../api/client';

export default function Monitoring() {
  const theme = useTheme();
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const [connectionName, setConnectionName] = useState('');
  const [queries, setQueries] = useState<ActiveQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (connId) {
      loadConnection();
      loadQueries();
      setupWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connId]);

  useEffect(() => {
    if (autoRefresh && !wsRef.current) {
      intervalRef.current = setInterval(() => {
        loadQueries();
      }, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const loadConnection = async () => {
    try {
      const response = await connectionsApi.get(connId!);
      setConnectionName(response.data.name);
    } catch (error) {
      console.error('Erro ao carregar conexão:', error);
    }
  };

  const loadQueries = async () => {
    try {
      const response = await monitoringApi.getActiveQueries(connId!);
      setQueries(response.data);
    } catch (error) {
      console.error('Erro ao carregar queries:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    // Fechar conexão anterior se existir
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    // Obter URL do WebSocket da configuração
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const wsUrl = import.meta.env.VITE_WS_URL || apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket conectado');
          reconnectAttempts = 0;
          ws.send(
            JSON.stringify({
              type: 'monitoring',
              payload: {
                type: 'subscribe',
                connId: connId!,
              },
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'active-queries') {
              setQueries(message.data);
            }
          } catch (error) {
            console.error('Erro ao processar mensagem WebSocket:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('Erro WebSocket:', error);
        };

        ws.onclose = (event) => {
          console.log('WebSocket desconectado', event.code, event.reason);
          // Tentar reconectar se não foi fechado intencionalmente
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Tentando reconectar WebSocket (${reconnectAttempts}/${maxReconnectAttempts})...`);
            setTimeout(connect, 2000 * reconnectAttempts); // Backoff exponencial
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Erro ao criar WebSocket:', error);
        // Fallback para polling HTTP se WebSocket falhar
        if (reconnectAttempts >= maxReconnectAttempts) {
          console.log('WebSocket falhou, usando polling HTTP como fallback');
        }
      }
    };

    connect();
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatSQL = (sql: string) => {
    if (!sql) return '';
    // Truncar SQL muito longo
    if (sql.length > 200) {
      return sql.substring(0, 200) + '...';
    }
    return sql;
  };

  const averageTime = queries.length > 0
    ? Math.round(queries.reduce((acc, q) => acc + q.elapsedTime, 0) / queries.length)
    : 0;

  const maxTime = queries.length > 0
    ? Math.max(...queries.map((q) => q.elapsedTime))
    : 0;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Barra superior com controles */}
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
            onClick={() => navigate('/connections')}
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
            Monitoramento: {connectionName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="caption" sx={{ fontSize: '0.75rem' }}>
                Auto-refresh
              </Typography>
            }
          />
          <Button
            onClick={loadQueries}
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon fontSize="small" />}
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
            Atualizar
          </Button>
        </Box>
      </Box>
      
      {/* Conteúdo com scroll */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
        <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ActivityIcon sx={{ fontSize: 32, color: 'primary.main', mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Queries Ativas
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {queries.length}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ActivityIcon sx={{ fontSize: 32, color: 'success.main', mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Tempo Médio
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {formatDuration(averageTime)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ActivityIcon sx={{ fontSize: 32, color: 'error.main', mr: 2 }} />
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Mais Longa
                  </Typography>
                  <Typography variant="h4" fontWeight={700}>
                    {formatDuration(maxTime)}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card>
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 256 }}>
              <CircularProgress />
            </Box>
          ) : queries.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <ActivityIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2, opacity: 0.5 }} />
              <Typography variant="body1" color="text.secondary">
                Nenhuma query ativa no momento
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Session ID
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Usuário
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Host
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Database
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Status
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      Tempo
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>
                      SQL
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queries.map((query) => (
                    <TableRow key={query.id}>
                      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                        {query.sessionId}
                      </TableCell>
                      <TableCell>{query.user}</TableCell>
                      <TableCell>{query.host}</TableCell>
                      <TableCell>{query.database || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={query.status}
                          size="small"
                          color={query.status === 'running' ? 'success' : 'warning'}
                          sx={{ fontSize: '0.6875rem', height: 20 }}
                        />
                      </TableCell>
                      <TableCell>{formatDuration(query.elapsedTime)}</TableCell>
                      <TableCell>
                        <Box
                          component="code"
                          sx={{
                            bgcolor: 'action.hover',
                            px: 1,
                            py: 0.5,
                            borderRadius: 0.5,
                            fontSize: '0.75rem',
                            fontFamily: 'monospace',
                            display: 'block',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 300,
                          }}
                        >
                          {formatSQL(query.sqlText)}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
      </Box>
    </Box>
  );
}
