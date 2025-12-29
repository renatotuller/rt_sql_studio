/**
 * Modal para escolher entre múltiplos relacionamentos diretos
 */

import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Checkbox,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Storage as StorageIcon,
  ArrowForward as ArrowForwardIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import type { JoinOption } from '../../types/query-builder';

interface JoinRelationshipSelectorProps {
  isOpen: boolean;
  sourceTable: string;
  targetTable: string;
  options: JoinOption[];
  onSelect: (options: JoinOption[]) => void;
  onCancel: () => void;
}

export default function JoinRelationshipSelector({
  isOpen,
  sourceTable,
  targetTable,
  options,
  onSelect,
  onCancel,
}: JoinRelationshipSelectorProps) {
  const theme = useTheme();
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  if (!isOpen || options.length === 0) return null;

  const sourceTableName = sourceTable.includes('.') 
    ? sourceTable.split('.').pop() || sourceTable
    : sourceTable;
  const targetTableName = targetTable.includes('.') 
    ? targetTable.split('.').pop() || targetTable
    : targetTable;

  const toggleOption = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedOptions = Array.from(selectedIndices)
      .sort((a, b) => a - b)
      .map(index => options[index]);
    
    if (selectedOptions.length > 0) {
      onSelect(selectedOptions);
      setSelectedIndices(new Set());
    }
  };

  const handleCancel = () => {
    setSelectedIndices(new Set());
    onCancel();
  };

  return (
    <Dialog
      open={isOpen}
      onClose={handleCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box>
          <Typography variant="h6">Escolher Relacionamentos</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Múltiplos relacionamentos encontrados entre{' '}
            <Typography component="span" variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
              {sourceTableName}
            </Typography>{' '}
            e{' '}
            <Typography component="span" variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 500 }}>
              {targetTableName}
            </Typography>
            <br />
            <Typography component="span" variant="caption" fontSize="0.625rem">
              Selecione um ou mais relacionamentos para criar múltiplos JOINs
            </Typography>
          </Typography>
        </Box>
        <IconButton
          onClick={handleCancel}
          size="small"
          sx={{ color: 'text.secondary' }}
          title="Fechar"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ flex: 1, overflow: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {options.map((option, index) => {
            const edge = option.path.edges[0]; // Primeira aresta (relacionamento direto)
            const fromColumn = edge.fromColumn;
            const toColumn = edge.toColumn;

            const isSelected = selectedIndices.has(index);

            return (
              <Paper
                key={index}
                elevation={0}
                component="button"
                onClick={() => toggleOption(index)}
                sx={{
                  width: '100%',
                  p: 2,
                  border: 1,
                  borderRadius: 1,
                  textAlign: 'left',
                  cursor: 'pointer',
                  bgcolor: isSelected
                    ? alpha(theme.palette.primary.main, 0.08)
                    : 'transparent',
                  borderColor: isSelected
                    ? 'primary.main'
                    : 'divider',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                  },
                  transition: 'all 0.2s',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box
                    sx={{
                      mt: 0.5,
                      p: 1,
                      borderRadius: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: isSelected
                        ? 'primary.main'
                        : alpha(theme.palette.primary.main, 0.1),
                      color: isSelected ? 'primary.contrastText' : 'primary.main',
                    }}
                  >
                    {isSelected ? (
                      <CheckIcon sx={{ fontSize: 16 }} />
                    ) : (
                      <StorageIcon sx={{ fontSize: 16 }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Opção {index + 1}
                      </Typography>
                      {option.directRelationships > 0 && (
                        <Box
                          component="span"
                          sx={{
                            px: 1,
                            py: 0.25,
                            fontSize: '0.625rem',
                            bgcolor: theme.palette.mode === 'dark' ? 'success.dark' : 'success.light',
                            color: 'success.contrastText',
                            borderRadius: 0.5,
                          }}
                        >
                          Relacionamento Direto
                        </Box>
                      )}
                    </Box>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.5,
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {sourceTableName}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">.</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {fromColumn}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled' }}>
                        <ArrowForwardIcon sx={{ fontSize: 12 }} />
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" color="text.secondary">
                          {targetTableName}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">.</Typography>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main' }}>
                          {toColumn}
                        </Typography>
                      </Box>
                    </Box>
                    {option.description && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        {option.description}
                      </Typography>
                    )}
                  </Box>
                  <ArrowForwardIcon
                    sx={{
                      fontSize: 20,
                      color: 'primary.main',
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      'button:hover &': {
                        opacity: 1,
                      },
                    }}
                  />
                </Box>
              </Paper>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {selectedIndices.size > 0 ? (
            <>{selectedIndices.size} relacionamento(s) selecionado(s)</>
          ) : (
            <>Selecione pelo menos um relacionamento</>
          )}
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button onClick={handleCancel} variant="outlined" size="small">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={selectedIndices.size === 0}
            variant="contained"
            size="small"
          >
            Confirmar ({selectedIndices.size})
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
}
