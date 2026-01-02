/**
 * Componente para gerenciar CTEs (Common Table Expressions)
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  TextField,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Code as CodeIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import type { CTEDefinition, QueryAST } from '../../types/query-builder';
import type { GraphNode, GraphEdge } from '../../api/client';
import SubqueryBuilder from './SubqueryBuilder';

interface CTEEditorProps {
  ctes: CTEDefinition[];
  onAdd: (cte: CTEDefinition) => void;
  onUpdate: (index: number, cte: CTEDefinition) => void;
  onRemove: (index: number) => void;
  nodes: GraphNode[];
  edges: GraphEdge[];
  dbType?: 'mysql' | 'sqlserver';
}

export default function CTEEditor({
  ctes,
  onAdd,
  onUpdate,
  onRemove,
  nodes,
  edges,
  dbType = 'mysql',
}: CTEEditorProps) {
  const theme = useTheme();
  const [expandedCTEs, setExpandedCTEs] = useState<Set<number>>(new Set((ctes || []).map((_, i) => i)));
  const [editingCTEIndex, setEditingCTEIndex] = useState<number | null>(null);
  const [showAddCTE, setShowAddCTE] = useState(false);
  const [newCTEName, setNewCTEName] = useState('');
  const [newCTEColumns, setNewCTEColumns] = useState<string>('');

  // Atualizar expandedCTEs quando ctes mudar
  useEffect(() => {
    setExpandedCTEs(new Set((ctes || []).map((_, i) => i)));
  }, [ctes]);

  const toggleCTE = (index: number) => {
    setExpandedCTEs(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddCTE = (queryAST: QueryAST) => {
    if (!newCTEName.trim()) {
      alert('O nome do CTE é obrigatório');
      return;
    }

    const columns = newCTEColumns
      .split(',')
      .map(col => col.trim())
      .filter(col => col.length > 0);

    const newCTE: CTEDefinition = {
      id: `cte-${Date.now()}-${Math.random()}`,
      name: newCTEName.trim(),
      query: queryAST,
      columns: columns.length > 0 ? columns : undefined,
    };

    onAdd(newCTE);
    setShowAddCTE(false);
    setNewCTEName('');
    setNewCTEColumns('');
  };

  const handleUpdateCTE = (index: number, queryAST: QueryAST) => {
    const existingCTE = ctes[index];
    const newCTE: CTEDefinition = {
      ...existingCTE,
      query: queryAST,
    };
    onUpdate(index, newCTE);
    setEditingCTEIndex(null);
  };

  if ((!ctes || ctes.length === 0) && !showAddCTE) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            CTEs (0)
          </Typography>
          <Button
            onClick={() => setShowAddCTE(true)}
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
            title="Adicionar CTE"
          >
            Adicionar CTE
          </Button>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
          <Box sx={{ color: 'text.secondary' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
              Nenhum CTE adicionado
            </Typography>
            <Typography variant="caption" display="block">
              CTEs (Common Table Expressions) permitem definir consultas temporárias reutilizáveis
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              Clique em "Adicionar CTE" para criar um
            </Typography>
          </Box>
        </Box>

        {showAddCTE && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
              <TextField
                label="Nome do CTE"
                required
                value={newCTEName}
                onChange={e => setNewCTEName(e.target.value)}
                placeholder="ex: vendas_por_mes"
                size="small"
                fullWidth
              />
              <TextField
                label="Colunas (opcional, separadas por vírgula)"
                value={newCTEColumns}
                onChange={e => setNewCTEColumns(e.target.value)}
                placeholder="ex: mes, total_vendas, quantidade"
                size="small"
                fullWidth
                helperText="Defina nomes de colunas explícitos para o CTE (opcional)"
              />
            </Box>
            <SubqueryBuilder
              initialAST={null}
              onSave={handleAddCTE}
              onCancel={() => {
                setShowAddCTE(false);
                setNewCTEName('');
                setNewCTEColumns('');
              }}
              nodes={nodes}
              edges={edges}
              dbType={dbType}
              title="Query do CTE"
            />
          </Box>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          CTEs ({(ctes || []).length})
        </Typography>
        <Button
          onClick={() => setShowAddCTE(true)}
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
          title="Adicionar CTE"
        >
          Adicionar CTE
        </Button>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {(ctes || []).map((cte, index) => {
          const isExpanded = expandedCTEs.has(index);
          const isEditing = editingCTEIndex === index;

          return (
            <Paper
              key={index}
              elevation={0}
              sx={{
                bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  p: isExpanded ? 1.5 : 1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                  <IconButton
                    onClick={() => toggleCTE(index)}
                    size="small"
                    sx={{ p: 0.5, flexShrink: 0 }}
                    title={isExpanded ? 'Contrair' : 'Expandir'}
                  >
                    {isExpanded ? (
                      <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    ) : (
                      <ChevronRightIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    )}
                  </IconButton>
                  <CodeIcon sx={{ fontSize: 14, color: 'secondary.main', flexShrink: 0 }} />
                  <Typography
                    variant="caption"
                    noWrap
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {cte.name}
                    {cte.columns && cte.columns.length > 0 && (
                      <Typography component="span" variant="caption" sx={{ color: 'text.secondary', ml: 0.5 }}>
                        ({cte.columns.join(', ')})
                      </Typography>
                    )}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, flexShrink: 0 }}>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCTEIndex(index);
                    }}
                    size="small"
                    sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                    title="Editar"
                  >
                    <EditIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    size="small"
                    sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                    title="Remover"
                  >
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              </Box>

              {isExpanded && !isEditing && (
                <Box sx={{ px: 1.5, pb: 1.5, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                  <Paper
                    elevation={0}
                    sx={{
                      mt: 1,
                      p: 1,
                      bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                      borderRadius: 1,
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                      }}
                    >
                      {cte.columns && cte.columns.length > 0
                        ? `WITH ${cte.name} (${cte.columns.join(', ')}) AS (SELECT ...)`
                        : `WITH ${cte.name} AS (SELECT ...)`
                      }
                    </Typography>
                  </Paper>
                </Box>
              )}

              {isEditing && (
                <Box sx={{ px: 1.5, pb: 1.5, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                  <SubqueryBuilder
                    initialAST={cte.query}
                    onSave={(queryAST) => handleUpdateCTE(index, queryAST)}
                    onCancel={() => setEditingCTEIndex(null)}
                    nodes={nodes}
                    edges={edges}
                    dbType={dbType}
                    title={`Editar CTE: ${cte.name}`}
                  />
                </Box>
              )}
            </Paper>
          );
        })}
      </Box>

      {showAddCTE && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            <TextField
              label="Nome do CTE"
              required
              value={newCTEName}
              onChange={e => setNewCTEName(e.target.value)}
              placeholder="ex: vendas_por_mes"
              size="small"
              fullWidth
            />
            <TextField
              label="Colunas (opcional, separadas por vírgula)"
              value={newCTEColumns}
              onChange={e => setNewCTEColumns(e.target.value)}
              placeholder="ex: mes, total_vendas, quantidade"
              size="small"
              fullWidth
              helperText="Defina nomes de colunas explícitos para o CTE (opcional)"
            />
          </Box>
          <SubqueryBuilder
            initialAST={null}
            onSave={handleAddCTE}
            onCancel={() => {
              setShowAddCTE(false);
              setNewCTEName('');
              setNewCTEColumns('');
            }}
            nodes={nodes}
            edges={edges}
            dbType={dbType}
            title="Query do CTE"
          />
        </Box>
      )}
    </Box>
  );
}
