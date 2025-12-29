import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Box, 
  Button, 
  ButtonGroup, 
  Typography, 
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import { 
  List as ListIcon, 
  Refresh as RefreshIcon,
  Build as BuildIcon
} from '@mui/icons-material';
import { schemaApi } from '../api/client';
import type { SchemaCacheMetadata } from '../api/client';

interface ViewSwitcherProps {
  currentView: 'standard' | 'advanced' | 'analyzer' | 'table' | 'query-builder' | 'ai-query';
}

export default function ViewSwitcher({ currentView }: ViewSwitcherProps) {
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [cacheMetadata, setCacheMetadata] = useState<SchemaCacheMetadata | null>(null);

  useEffect(() => {
    if (connId) {
      loadCacheMetadata();
    }
  }, [connId]);

  const loadCacheMetadata = async () => {
    try {
      const response = await schemaApi.getCacheMetadata(connId!);
      setCacheMetadata(response.data);
    } catch (error) {
      setCacheMetadata(null);
    }
  };

  const handleRefresh = async () => {
    if (!connId || refreshing) return;
    
    setRefreshing(true);
    try {
      const response = await schemaApi.refresh(connId);
      if (response.data.cacheMetadata) {
        setCacheMetadata(response.data.cacheMetadata);
      }
      window.location.reload();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao atualizar estrutura');
    } finally {
      setRefreshing(false);
    }
  };

  const formatLastUpdated = (dateString: string) => {
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
    return date.toLocaleDateString('pt-BR');
  };

  const views = [
    { id: 'standard', label: 'Padrão', path: `/schema/${connId}` },
    { id: 'advanced', label: 'Avançada', path: `/schema/${connId}/advanced` },
    { id: 'analyzer', label: 'Analisador', path: `/schema/${connId}/analyzer` },
    { id: 'table', label: 'Tabela', path: `/schema/${connId}/table`, icon: <ListIcon sx={{ fontSize: '1.125rem' }} /> },
    { id: 'query-builder', label: 'Query Builder', path: `/schema/${connId}/query-builder`, icon: <BuildIcon sx={{ fontSize: '1.125rem' }} /> },
  ];

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        px: 2,
        py: 0.5,
        borderBottom: `1px solid ${theme.palette.divider}`,
      }}
    >
      {/* Botões de navegação */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        {views.map((view) => {
          const isActive = currentView === view.id;
          return (
            <Button
              key={view.id}
              onClick={() => navigate(view.path)}
              size="small"
              startIcon={view.icon}
              sx={{
                px: 2.5,
                py: 0.5,
                minHeight: 'auto',
                fontSize: '0.75rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 2,
                color: isActive
                  ? theme.palette.primary.main
                  : theme.palette.text.secondary,
                backgroundColor: isActive
                  ? alpha(theme.palette.primary.main, 0.12)
                  : 'transparent',
                '&:hover': {
                  backgroundColor: isActive
                    ? alpha(theme.palette.primary.main, 0.16)
                    : alpha(theme.palette.action.hover, 0.04),
                },
              }}
            >
              {view.label}
            </Button>
          );
        })}
      </Box>
      
      {/* Indicador de cache */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {cacheMetadata && (
          <Typography
            variant="caption"
            sx={{
              color: theme.palette.text.secondary,
              fontSize: '0.75rem',
            }}
          >
            Atualizado {formatLastUpdated(cacheMetadata.lastUpdated)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
