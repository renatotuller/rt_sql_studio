import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  TextField,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  IconButton,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Science as TestTubeIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material';
import {
  connectionsApi,
  type DatabaseConnection,
} from '../api/client';
import PageLayout from '../components/PageLayout';

export default function Connections() {
  const navigate = useNavigate();
  const theme = useTheme();
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'mysql' as 'mysql' | 'sqlserver',
    host: 'localhost',
    port: 3306,
    user: '',
    password: '',
    database: '',
    ssl: false,
  });

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await connectionsApi.getAll();
      setConnections(response.data || []);
    } catch (error) {
      console.error('Erro ao carregar conexões:', error);
      setConnections([]);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'mysql',
      host: 'localhost',
      port: 3306,
      user: '',
      password: '',
      database: '',
      ssl: false,
    });
    setEditingId(null);
    setShowForm(false);
  };

  const handleEdit = (conn: DatabaseConnection) => {
    setFormData({
      name: conn.name,
      type: conn.type,
      host: conn.host,
      port: conn.port,
      user: conn.user,
      password: '', // Não carregar senha por segurança
      database: conn.database,
      ssl: conn.ssl || false,
    });
    setEditingId(conn.id);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);

    try {
      // Testar conexão primeiro
      const testResult = await connectionsApi.test(formData);
      if (!testResult.data.valid) {
        alert('Falha ao conectar. Verifique os dados.');
        return;
      }

      // Criar ou atualizar conexão
      if (editingId) {
        await connectionsApi.update(editingId, formData);
      } else {
        await connectionsApi.create(formData);
      }
      
      await loadConnections();
      resetForm();
    } catch (error: any) {
      alert(error.response?.data?.error || `Erro ao ${editingId ? 'atualizar' : 'criar'} conexão`);
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta conexão?')) {
      return;
    }

    try {
      await connectionsApi.delete(id);
      await loadConnections();
    } catch (error) {
      alert('Erro ao deletar conexão');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Conteúdo com scroll */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
      <Box 
        sx={{ 
          mb: 3, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary">
          Gerencie suas conexões de banco de dados
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setShowForm(!showForm)}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
          }}
        >
          Nova Conexão
        </Button>
      </Box>

      {showForm && (
        <Card sx={{ mb: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
              {editingId ? 'Editar Conexão' : 'Nova Conexão'}
            </Typography>
            <Box component="form" onSubmit={handleSubmit}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, mb: 3 }}>
                <TextField
                  label="Nome"
                  required
                  fullWidth
                  size="small"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo</InputLabel>
                  <Select
                    value={formData.type}
                    label="Tipo"
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        type: e.target.value as 'mysql' | 'sqlserver',
                        port: e.target.value === 'mysql' ? 3306 : 1433,
                      })
                    }
                  >
                    <MenuItem value="mysql">MySQL</MenuItem>
                    <MenuItem value="sqlserver">SQL Server</MenuItem>
                  </Select>
                </FormControl>
                <TextField
                  label="Host"
                  required
                  fullWidth
                  size="small"
                  value={formData.host}
                  onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                />
                <TextField
                  label="Porta"
                  type="number"
                  required
                  fullWidth
                  size="small"
                  value={formData.port}
                  onChange={(e) =>
                    setFormData({ ...formData, port: parseInt(e.target.value) })
                  }
                />
                <TextField
                  label="Usuário"
                  required
                  fullWidth
                  size="small"
                  value={formData.user}
                  onChange={(e) => setFormData({ ...formData, user: e.target.value })}
                />
                <TextField
                  label="Senha"
                  type="password"
                  fullWidth
                  size="small"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                />
                <TextField
                  label="Database"
                  required
                  fullWidth
                  size="small"
                  value={formData.database}
                  onChange={(e) =>
                    setFormData({ ...formData, database: e.target.value })
                  }
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={formData.ssl}
                      onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                    />
                  }
                  label="SSL"
                />
              </Box>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <Button
                  type="submit"
                  variant="contained"
                  disabled={testing}
                  startIcon={testing ? <CircularProgress size={16} sx={{ color: 'inherit' }} /> : <TestTubeIcon />}
                  sx={{ textTransform: 'none' }}
                >
                  {testing ? 'Testando...' : 'Testar e Salvar'}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  onClick={resetForm}
                  sx={{ textTransform: 'none' }}
                >
                  Cancelar
                </Button>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent sx={{ p: 0 }}>
          {connections.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 6 }}>
              <Typography variant="body2" color="text.secondary">
                Nenhuma conexão configurada
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      Nome
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      Tipo
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      Host
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      Database
                    </TableCell>
                    <TableCell sx={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.75rem' }}>
                      Ações
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {connections.map((conn) => (
                    <TableRow
                      key={conn.id}
                      sx={{
                        '&:hover': {
                          backgroundColor: theme.palette.action.hover,
                        },
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {conn.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={conn.type.toUpperCase()}
                          size="small"
                          color={conn.type === 'mysql' ? 'primary' : 'secondary'}
                          sx={{ fontSize: '0.7rem', height: 22 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {conn.host}:{conn.port}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {conn.database}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Button
                            size="small"
                            startIcon={<VisibilityIcon />}
                            onClick={() => navigate(`/schema/${conn.id}`)}
                            sx={{
                              textTransform: 'none',
                              color: theme.palette.primary.main,
                            }}
                          >
                            Ver Schema
                          </Button>
                          <IconButton
                            size="small"
                            onClick={() => handleEdit(conn)}
                            sx={{
                              color: theme.palette.primary.main,
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.primary.main, 0.1),
                              },
                            }}
                            title="Editar conexão"
                          >
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(conn.id)}
                            sx={{
                              color: theme.palette.error.main,
                              '&:hover': {
                                backgroundColor: alpha(theme.palette.error.main, 0.1),
                              },
                            }}
                            title="Deletar conexão"
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
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




