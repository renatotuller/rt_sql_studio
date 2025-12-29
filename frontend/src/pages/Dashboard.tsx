import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Paper,
  CircularProgress,
  Alert,
  useTheme,
  alpha,
  Chip,
} from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import {
  Storage as DatabaseIcon,
  TableChart as TableIcon,
  Layers as ViewsIcon,
  BarChart as BarChartIcon,
  Add as AddIcon,
  Visibility as VisibilityIcon,
  Build as ActivityIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { connectionsApi, schemaApi, type DatabaseConnection, type SchemaStats } from '../api/client';
import PageLayout from '../components/PageLayout';

interface ConnectionWithStats extends DatabaseConnection {
  stats?: SchemaStats;
  loading?: boolean;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const [connections, setConnections] = useState<ConnectionWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalTables, setTotalTables] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [totalConnections, setTotalConnections] = useState(0);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const response = await connectionsApi.getAll();
      const connectionsData = response.data;
      setTotalConnections(connectionsData.length);
      
      if (location.pathname === '/') {
        if (connectionsData.length > 0) {
          setLoading(false);
        } else {
          navigate('/connections', { replace: true });
          return;
        }
      } else {
        setLoading(false);
      }

      const connectionsWithStats = await Promise.all(
        connectionsData.map(async (conn) => {
          try {
            const statsResponse = await schemaApi.getStats(conn.id);
            return { ...conn, stats: statsResponse.data, loading: false };
          } catch (error) {
            console.error(`Erro ao carregar stats para ${conn.id}:`, error);
            return { ...conn, stats: undefined, loading: false };
          }
        })
      );

      setConnections(connectionsWithStats);
      
      const tables = connectionsWithStats.reduce((sum, conn) => sum + (conn.stats?.tables || 0), 0);
      const views = connectionsWithStats.reduce((sum, conn) => sum + (conn.stats?.views || 0), 0);
      setTotalTables(tables);
      setTotalViews(views);
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Nunca';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours}h`;
    if (diffDays < 7) return `há ${diffDays} dias`;
    return date.toLocaleDateString('pt-BR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <PageLayout title="Dashboard">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
          <CircularProgress />
        </Box>
      </PageLayout>
    );
  }

  const statCards = [
    {
      title: 'Conexões',
      value: totalConnections,
      icon: <DatabaseIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.primary.main,
      bgColor: alpha(theme.palette.primary.main, 0.1),
    },
    {
      title: 'Tabelas',
      value: totalTables,
      icon: <TableIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.success.main,
      bgColor: alpha(theme.palette.success.main, 0.1),
    },
    {
      title: 'Views',
      value: totalViews,
      icon: <ViewsIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.secondary.main,
      bgColor: alpha(theme.palette.secondary.main, 0.1),
    },
    {
      title: 'Bancos',
      value: new Set(connections.map(c => c.type)).size,
      icon: <BarChartIcon sx={{ fontSize: 40 }} />,
      color: theme.palette.warning.main,
      bgColor: alpha(theme.palette.warning.main, 0.1),
    },
  ];

  return (
    <PageLayout 
      title="Dashboard"
      actions={
        <Button
          component={Link}
          to="/connections"
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
          }}
        >
          Nova Conexão
        </Button>
      }
    >
      <Box sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          Gerencie suas conexões de banco de dados e visualize schemas
        </Typography>
      </Box>

      {/* Cards de Estatísticas Gerais */}
      <Grid2 container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((stat, index) => (
          <Grid2 xs={12} sm={6} md={3} key={index}>
            <Card
              sx={{
                background: `linear-gradient(135deg, ${stat.bgColor} 0%, ${alpha(stat.bgColor, 0.5)} 100%)`,
                border: `1px solid ${alpha(stat.color, 0.2)}`,
                borderRadius: 3,
                height: '100%',
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                      {stat.title}
                    </Typography>
                    <Typography
                      variant="h4"
                      sx={{
                        fontWeight: 700,
                        color: stat.color,
                        mt: 0.5,
                      }}
                    >
                      {stat.value}
                    </Typography>
                  </Box>
                  <Box sx={{ color: stat.color, opacity: 0.6 }}>
                    {stat.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid2>
        ))}
      </Grid2>

      {/* Cards de Conexões */}
      {connections.length === 0 ? (
        <Card>
          <CardContent>
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <DatabaseIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography variant="body1" color="text.secondary" gutterBottom>
                Nenhuma conexão configurada
              </Typography>
              <Button
                component={Link}
                to="/connections"
                variant="contained"
                sx={{ mt: 2, textTransform: 'none', borderRadius: 2 }}
              >
                Criar Primeira Conexão
              </Button>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid2 container spacing={2}>
          {connections.map((conn) => (
            <Grid2 xs={12} sm={6} md={4} key={conn.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRadius: 3,
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: theme.shadows[8],
                  },
                }}
              >
                <CardContent sx={{ flex: 1, p: 2.5 }}>
                  {/* Header */}
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                          {conn.name}
                        </Typography>
                        {conn.stats?.hasCache ? (
                          <Chip
                            label="Ativo"
                            size="small"
                            color="success"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        ) : (
                          <Chip
                            label="Sem Schema"
                            size="small"
                            color="warning"
                            sx={{ height: 20, fontSize: '0.65rem' }}
                          />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                          label={conn.type.toUpperCase()}
                          size="small"
                          color={conn.type === 'mysql' ? 'primary' : 'secondary'}
                          sx={{ fontSize: '0.7rem', height: 22 }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {conn.host}:{conn.port}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Estatísticas */}
                  {conn.stats ? (
                    <Box sx={{ mb: 2 }}>
                      <Grid2 container spacing={1.5} sx={{ mb: 1.5 }}>
                        <Grid2 xs={6}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              backgroundColor: alpha(theme.palette.primary.main, 0.05),
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <TableIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                              <Typography variant="caption" color="text.secondary">
                                Tabelas
                              </Typography>
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                              {conn.stats.tables}
                            </Typography>
                          </Paper>
                        </Grid2>
                        <Grid2 xs={6}>
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 1.5,
                              borderRadius: 2,
                              backgroundColor: alpha(theme.palette.secondary.main, 0.05),
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                              <ViewsIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                              <Typography variant="caption" color="text.secondary">
                                Views
                              </Typography>
                            </Box>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                              {conn.stats.views}
                            </Typography>
                          </Paper>
                        </Grid2>
                      </Grid2>
                      
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          backgroundColor: alpha(theme.palette.info.main, 0.05),
                          mb: conn.stats.foreignKeys > 0 ? 1.5 : 0,
                        }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                          Última Atualização
                        </Typography>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {formatDate(conn.stats.lastUpdated)}
                        </Typography>
                      </Paper>

                      {conn.stats.foreignKeys > 0 && (
                        <Paper
                          variant="outlined"
                          sx={{
                            p: 1.5,
                            borderRadius: 2,
                            backgroundColor: alpha(theme.palette.success.main, 0.05),
                          }}
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Relacionamentos
                          </Typography>
                          <Typography variant="body2" sx={{ fontWeight: 500 }}>
                            {conn.stats.foreignKeys} Foreign Keys
                          </Typography>
                        </Paper>
                      )}
                    </Box>
                  ) : (
                    <Alert
                      severity="warning"
                      sx={{
                        mb: 2,
                        borderRadius: 2,
                        '& .MuiAlert-icon': {
                          fontSize: 20,
                        },
                      }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 500, display: 'block' }}>
                        Schema não carregado
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Clique em "Ver Schema" para carregar
                      </Typography>
                    </Alert>
                  )}

                  {/* Ações */}
                  <Box sx={{ display: 'flex', gap: 1, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
                    <Button
                      component={Link}
                      to={`/schema/${conn.id}`}
                      variant="contained"
                      fullWidth
                      size="small"
                      startIcon={<VisibilityIcon />}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2,
                      }}
                    >
                      Ver Schema
                    </Button>
                    <Button
                      component={Link}
                      to={`/schema/${conn.id}/query-builder`}
                      variant="outlined"
                      fullWidth
                      size="small"
                      startIcon={<ActivityIcon />}
                      sx={{
                        textTransform: 'none',
                        borderRadius: 2,
                      }}
                    >
                      Query Builder
                    </Button>
                  </Box>
                </CardContent>
                </Card>
              </Grid2>
            ))}
          </Grid2>
      )}
    </PageLayout>
  );
}
