/**
 * Componente para gerenciar UNION/UNION ALL
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  useTheme,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Code as CodeIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  SwapVert as SwapVertIcon,
} from '@mui/icons-material';
import type { UnionClause, QueryAST } from '../../types/query-builder';
import type { GraphNode, GraphEdge } from '../../api/client';
import SubqueryBuilder from './SubqueryBuilder';

interface UnionEditorProps {
  unions: UnionClause[];
  onAdd: (union: UnionClause) => void;
  onUpdate: (index: number, union: UnionClause) => void;
  onRemove: (index: number) => void;
  onReorder: (unions: UnionClause[]) => void;
  nodes: GraphNode[];
  edges: GraphEdge[];
  dbType?: 'mysql' | 'sqlserver';
}

export default function UnionEditor({
  unions,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  nodes,
  edges,
  dbType = 'mysql',
}: UnionEditorProps) {
  const theme = useTheme();
  const [expandedUnions, setExpandedUnions] = useState<Set<number>>(new Set((unions || []).map((_, i) => i)));
  const [editingUnionIndex, setEditingUnionIndex] = useState<number | null>(null);
  const [showAddUnion, setShowAddUnion] = useState(false);
  const [newUnionType, setNewUnionType] = useState<'UNION' | 'UNION ALL'>('UNION');

  // Atualizar expandedUnions quando unions mudar
  useEffect(() => {
    setExpandedUnions(new Set((unions || []).map((_, i) => i)));
  }, [unions]);

  const toggleUnion = (index: number) => {
    setExpandedUnions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddUnion = (queryAST: QueryAST) => {
    const newUnion: UnionClause = {
      id: `union-${Date.now()}-${Math.random()}`,
      query: queryAST,
      type: newUnionType,
      order: unions.length,
    };

    onAdd(newUnion);
    setShowAddUnion(false);
    setNewUnionType('UNION');
  };

  const handleUpdateUnion = (index: number, queryAST: QueryAST) => {
    const existingUnion = unions[index];
    const newUnion: UnionClause = {
      ...existingUnion,
      query: queryAST,
    };
    onUpdate(index, newUnion);
    setEditingUnionIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newUnions = [...unions];
    [newUnions[index - 1], newUnions[index]] = [newUnions[index], newUnions[index - 1]];
    // Atualizar ordem
    newUnions.forEach((u, i) => {
      u.order = i;
    });
    onReorder(newUnions);
  };

  const handleMoveDown = (index: number) => {
    if (index === unions.length - 1) return;
    const newUnions = [...unions];
    [newUnions[index], newUnions[index + 1]] = [newUnions[index + 1], newUnions[index]];
    // Atualizar ordem
    newUnions.forEach((u, i) => {
      u.order = i;
    });
    onReorder(newUnions);
  };

  if ((!unions || unions.length === 0) && !showAddUnion) {
    return (
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            UNION (0)
          </Typography>
          <Button
            onClick={() => setShowAddUnion(true)}
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
            title="Adicionar UNION"
          >
            Adicionar UNION
          </Button>
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
          <Box sx={{ color: 'text.secondary', maxWidth: 500 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
              Nenhum UNION adicionado
            </Typography>
            <Alert severity="info" sx={{ mb: 2, textAlign: 'left' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                O que é UNION?
              </Typography>
              <Typography variant="caption" component="div">
                UNION permite <strong>combinar resultados de múltiplas queries</strong> em uma única tabela de resultados.
              </Typography>
            </Alert>
            <Box sx={{ textAlign: 'left', mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Diferenças:
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                • <strong>UNION</strong>: Remove linhas duplicadas (mais lento, mas garante unicidade)
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                • <strong>UNION ALL</strong>: Mantém todas as linhas, incluindo duplicatas (mais rápido)
              </Typography>
            </Box>
            <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Requisitos importantes:
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                1. Todas as queries devem ter o <strong>mesmo número de colunas</strong>
              </Typography>
              <Typography variant="caption" component="div" sx={{ mb: 0.5 }}>
                2. Os <strong>tipos de dados</strong> devem ser compatíveis entre as colunas correspondentes
              </Typography>
              <Typography variant="caption" component="div">
                3. A <strong>ordem das colunas</strong> importa (coluna 1 da query 1 será combinada com coluna 1 da query 2)
              </Typography>
            </Alert>
            <Typography variant="caption" display="block" sx={{ mt: 2, fontStyle: 'italic' }}>
              Clique em "Adicionar UNION" para começar
            </Typography>
          </Box>
        </Box>

        {showAddUnion && (
          <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
            <Alert severity="info" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Criando Query UNION
              </Typography>
              <Typography variant="caption" component="div">
                A query UNION deve ter o <strong>mesmo número de colunas</strong> e <strong>tipos compatíveis</strong> com a query principal.
              </Typography>
              <Typography variant="caption" component="div" sx={{ mt: 1 }}>
                A ordem das colunas importa: a primeira coluna desta query será combinada com a primeira coluna da query principal, e assim por diante.
              </Typography>
            </Alert>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo de UNION</InputLabel>
                <Select
                  value={newUnionType}
                  onChange={e => setNewUnionType(e.target.value as 'UNION' | 'UNION ALL')}
                  label="Tipo de UNION"
                >
                  <MenuItem value="UNION">UNION (remove duplicatas)</MenuItem>
                  <MenuItem value="UNION ALL">UNION ALL (mantém todas as linhas)</MenuItem>
                </Select>
              </FormControl>
            </Box>
            <SubqueryBuilder
              initialAST={null}
              onSave={handleAddUnion}
              onCancel={() => {
                setShowAddUnion(false);
                setNewUnionType('UNION');
              }}
              nodes={nodes}
              edges={edges}
              dbType={dbType}
              title="Query UNION"
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
          UNION ({(unions || []).length})
        </Typography>
        <Button
          onClick={() => setShowAddUnion(true)}
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
          title="Adicionar UNION"
        >
          Adicionar UNION
        </Button>
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {(unions || []).map((union, index) => {
          const isExpanded = expandedUnions.has(index);
          const isEditing = editingUnionIndex === index;

          return (
            <Paper
              key={union.id}
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
                    onClick={() => toggleUnion(index)}
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
                  <SwapVertIcon sx={{ fontSize: 14, color: 'secondary.main', flexShrink: 0 }} />
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
                    {union.type}
                  </Typography>
                  {index > 0 && (
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveUp(index);
                      }}
                      size="small"
                      sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                      title="Mover para cima"
                    >
                      <ChevronRightIcon sx={{ fontSize: 14, transform: 'rotate(-90deg)' }} />
                    </IconButton>
                  )}
                  {index < unions.length - 1 && (
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMoveDown(index);
                      }}
                      size="small"
                      sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                      title="Mover para baixo"
                    >
                      <ChevronRightIcon sx={{ fontSize: 14, transform: 'rotate(90deg)' }} />
                    </IconButton>
                  )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, flexShrink: 0 }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select
                      value={union.type}
                      onChange={e => {
                        const updated = { ...union, type: e.target.value as 'UNION' | 'UNION ALL' };
                        onUpdate(index, updated);
                      }}
                      sx={{ fontSize: '0.75rem', height: 28 }}
                    >
                      <MenuItem value="UNION">UNION</MenuItem>
                      <MenuItem value="UNION ALL">UNION ALL</MenuItem>
                    </Select>
                  </FormControl>
                  <IconButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingUnionIndex(index);
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
                  <Alert severity="info" sx={{ mt: 1, mb: 1 }}>
                    <Typography variant="caption" component="div">
                      <strong>Tipo:</strong> {union.type === 'UNION' ? 'UNION (remove duplicatas)' : 'UNION ALL (mantém todas as linhas)'}
                    </Typography>
                    <Typography variant="caption" component="div" sx={{ mt: 0.5 }}>
                      <strong>Colunas:</strong> {union.query.select.fields.length} coluna(s) selecionada(s)
                    </Typography>
                    {union.query.select.fields.length > 0 && (
                      <Typography variant="caption" component="div" sx={{ mt: 0.5, fontFamily: 'monospace' }}>
                        {union.query.select.fields.slice(0, 3).map(f => f.alias || f.column || 'col').join(', ')}
                        {union.query.select.fields.length > 3 && '...'}
                      </Typography>
                    )}
                  </Alert>
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
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {union.type} (SELECT {union.query.select.fields.length} coluna{union.query.select.fields.length !== 1 ? 's' : ''})
                    </Typography>
                  </Paper>
                </Box>
              )}

              {isEditing && (
                <Box sx={{ px: 1.5, pb: 1.5, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                  <SubqueryBuilder
                    initialAST={union.query}
                    onSave={(queryAST) => handleUpdateUnion(index, queryAST)}
                    onCancel={() => setEditingUnionIndex(null)}
                    nodes={nodes}
                    edges={edges}
                    dbType={dbType}
                    title={`Editar UNION: ${union.type}`}
                  />
                </Box>
              )}
            </Paper>
          );
        })}
      </Box>

      {showAddUnion && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50' }}>
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              Criando Query UNION
            </Typography>
            <Typography variant="caption" component="div">
              A query UNION deve ter o <strong>mesmo número de colunas</strong> e <strong>tipos compatíveis</strong> com a query principal.
            </Typography>
            <Typography variant="caption" component="div" sx={{ mt: 1 }}>
              A ordem das colunas importa: a primeira coluna desta query será combinada com a primeira coluna da query principal, e assim por diante.
            </Typography>
          </Alert>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Tipo de UNION</InputLabel>
              <Select
                value={newUnionType}
                onChange={e => setNewUnionType(e.target.value as 'UNION' | 'UNION ALL')}
                label="Tipo de UNION"
              >
                <MenuItem value="UNION">UNION (remove duplicatas)</MenuItem>
                <MenuItem value="UNION ALL">UNION ALL (mantém todas as linhas)</MenuItem>
              </Select>
            </FormControl>
          </Box>
          <SubqueryBuilder
            initialAST={null}
            onSave={handleAddUnion}
            onCancel={() => {
              setShowAddUnion(false);
              setNewUnionType('UNION');
            }}
            nodes={nodes}
            edges={edges}
            dbType={dbType}
            title="Query UNION"
          />
        </Box>
      )}
    </Box>
  );
}

