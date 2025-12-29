/**
 * Dialog para exibir histórico de queries
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  Box,
  Typography,
  Paper,
  Tooltip,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  PlayArrow as PlayIcon,
  AccessTime as AccessTimeIcon,
} from '@mui/icons-material';
import type { QueryAST } from '../../types/query-builder';

interface QueryHistoryItem {
  id: string;
  sql: string;
  ast: QueryAST;
  timestamp: Date;
  name?: string;
}

interface QueryHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  history: QueryHistoryItem[];
  onLoad: (ast: QueryAST) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export default function QueryHistoryDialog({
  isOpen,
  onClose,
  history,
  onLoad,
  onDelete,
  onClearAll,
}: QueryHistoryDialogProps) {
  const theme = useTheme();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (sql: string, id: string) => {
    await navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccessTimeIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="h6" component="span">
            Histórico de Queries
          </Typography>
          <Chip label={history.length} size="small" />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {history.length > 0 && (
            <Button
              onClick={onClearAll}
              size="small"
              sx={{
                color: 'error.main',
                fontSize: '0.8125rem',
                '&:hover': {
                  bgcolor: alpha(theme.palette.error.main, 0.08),
                },
              }}
            >
              Limpar tudo
            </Button>
          )}
          <IconButton
            onClick={onClose}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                bgcolor: 'action.hover',
              },
            }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ overflow: 'auto', p: 2 }}>
        {history.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              color: 'text.secondary',
            }}
          >
            <AccessTimeIcon
              sx={{
                fontSize: 48,
                mb: 2,
                opacity: 0.5,
                color: 'text.secondary',
              }}
            />
            <Typography variant="body1">Nenhuma query no histórico</Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {history.map((item) => (
              <Paper
                key={item.id}
                elevation={0}
                sx={{
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 1.5,
                    py: 1,
                    bgcolor: 'action.hover',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {formatDate(item.timestamp)}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip title="Copiar SQL">
                      <IconButton
                        onClick={() => handleCopy(item.sql, item.id)}
                        size="small"
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            color: copiedId === item.id ? 'success.main' : 'text.primary',
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        {copiedId === item.id ? (
                          <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <CopyIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Carregar query">
                      <IconButton
                        onClick={() => onLoad(item.ast)}
                        size="small"
                        sx={{
                          color: 'primary.main',
                          '&:hover': {
                            bgcolor: alpha(theme.palette.primary.main, 0.08),
                          },
                        }}
                      >
                        <PlayIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Remover">
                      <IconButton
                        onClick={() => onDelete(item.id)}
                        size="small"
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            color: 'error.main',
                            bgcolor: alpha(theme.palette.error.main, 0.08),
                          },
                        }}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
                <Box
                  component="pre"
                  sx={{
                    p: 1.5,
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    color: 'text.primary',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    m: 0,
                    bgcolor: 'background.paper',
                  }}
                >
                  {item.sql}
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
