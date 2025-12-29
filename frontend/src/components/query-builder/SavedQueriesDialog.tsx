/**
 * Dialog para gerenciar queries salvas
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Button,
  TextField,
  Box,
  Typography,
  Paper,
  Tooltip,
  Chip,
  Divider,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Save as SaveIcon,
  Delete as DeleteIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  PlayArrow as PlayIcon,
  FolderOpen as FolderOpenIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import type { QueryAST } from '../../types/query-builder';

interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sql: string;
  ast: QueryAST;
  createdAt: Date;
  updatedAt: Date;
}

interface SavedQueriesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  savedQueries: SavedQuery[];
  currentSQL: string;
  currentAST: QueryAST;
  onLoad: (ast: QueryAST) => void;
  onSave: (name: string, description?: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, name: string, description?: string) => void;
}

export default function SavedQueriesDialog({
  isOpen,
  onClose,
  savedQueries,
  currentSQL,
  currentAST,
  onLoad,
  onSave,
  onDelete,
  onUpdate,
}: SavedQueriesDialogProps) {
  const theme = useTheme();
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim(), saveDescription.trim() || undefined);
    setSaveName('');
    setSaveDescription('');
    setShowSaveForm(false);
  };

  const handleCopy = async (sql: string, id: string) => {
    await navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '85vh',
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
          <FolderOpenIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
          <Typography variant="h6" component="span">
            Queries Salvas
          </Typography>
          <Chip label={savedQueries.length} size="small" />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {currentSQL && (
            <Button
              onClick={() => setShowSaveForm(true)}
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              sx={{ fontSize: '0.8125rem' }}
            >
              Salvar Query Atual
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

      {/* Save Form */}
      {showSaveForm && (
        <Box
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: alpha(theme.palette.primary.main, 0.04),
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              fullWidth
              size="small"
              label="Nome da Query"
              required
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Ex: Clientes ativos com pedidos"
              autoFocus
            />
            <TextField
              fullWidth
              size="small"
              label="Descrição (opcional)"
              value={saveDescription}
              onChange={(e) => setSaveDescription(e.target.value)}
              placeholder="Descreva o propósito desta query..."
              multiline
              rows={2}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
              <Button
                onClick={() => setShowSaveForm(false)}
                size="small"
                sx={{ fontSize: '0.8125rem' }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={!saveName.trim()}
                variant="contained"
                size="small"
                startIcon={<SaveIcon />}
                sx={{ fontSize: '0.8125rem' }}
              >
                Salvar
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      <DialogContent dividers sx={{ overflow: 'auto', p: 2 }}>
        {savedQueries.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 6,
              color: 'text.secondary',
            }}
          >
            <FolderOpenIcon
              sx={{
                fontSize: 48,
                mb: 2,
                opacity: 0.5,
                color: 'text.secondary',
              }}
            />
            <Typography variant="body1" sx={{ mb: 1 }}>
              Nenhuma query salva
            </Typography>
            <Typography variant="body2">
              Salve suas queries frequentes para reutilizá-las depois
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {savedQueries.map((query) => (
              <Paper
                key={query.id}
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
                  <Box>
                    <Typography variant="subtitle2" fontWeight={500}>
                      {query.name}
                    </Typography>
                    {query.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.25, display: 'block' }}>
                        {query.description}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mr: 1 }}>
                      {formatDate(query.updatedAt)}
                    </Typography>
                    <Tooltip title="Copiar SQL">
                      <IconButton
                        onClick={() => handleCopy(query.sql, query.id)}
                        size="small"
                        sx={{
                          color: 'text.secondary',
                          '&:hover': {
                            color: copiedId === query.id ? 'success.main' : 'text.primary',
                            bgcolor: 'action.hover',
                          },
                        }}
                      >
                        {copiedId === query.id ? (
                          <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <CopyIcon sx={{ fontSize: 16 }} />
                        )}
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Carregar query">
                      <IconButton
                        onClick={() => onLoad(query.ast)}
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
                        onClick={() => onDelete(query.id)}
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
                    maxHeight: 128,
                    overflowY: 'auto',
                    m: 0,
                    bgcolor: 'background.paper',
                  }}
                >
                  {query.sql}
                </Box>
              </Paper>
            ))}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
