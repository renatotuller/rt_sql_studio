/**
 * Componente para construir subselects (subqueries)
 * Usado dentro de WHERE (IN, EXISTS), FROM, JOIN, SELECT
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Paper,
  useTheme,
} from '@mui/material';
import {
  Close as CloseIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import type { QueryAST } from '../../types/query-builder';
import type { GraphNode, GraphEdge } from '../../api/client';
import { useQueryBuilder } from '../../hooks/useQueryBuilder';
import TableExplorer from './TableExplorer';
import SelectList from './SelectList';
import SelectDropZone from './SelectDropZone';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import type { SelectField } from '../../types/query-builder';

interface SubqueryBuilderProps {
  /** AST inicial do subselect (se editando) */
  initialAST?: QueryAST | null;
  /** Callback quando subselect é salvo */
  onSave: (ast: QueryAST) => void;
  /** Callback para cancelar */
  onCancel: () => void;
  /** Nós do grafo (tabelas) */
  nodes: GraphNode[];
  /** Arestas do grafo (relacionamentos) */
  edges: GraphEdge[];
  /** Tipo do banco */
  dbType: 'mysql' | 'sqlserver';
  /** Título do modal */
  title?: string;
}

export default function SubqueryBuilder({
  initialAST,
  onSave,
  onCancel,
  nodes,
  edges,
  dbType,
  title = 'Construir Subselect',
}: SubqueryBuilderProps) {
  const theme = useTheme();
  const {
    ast,
    sql,
    setBaseTable,
    addColumn,
    removeColumn,
    updateColumnAlias,
    reorderColumns,
    loadAST,
  } = useQueryBuilder({ nodes, edges, dbType });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [baseTableId, setBaseTableId] = useState<string | undefined>(initialAST?.from.table);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Importar AST inicial se fornecido
  useEffect(() => {
    if (initialAST && ast && ast.select.fields.length === 0 && initialAST.from.table) {
      // Carregar o AST inicial usando loadAST
      loadAST(initialAST);
      setBaseTableId(initialAST.from.table);
    }
  }, [initialAST, loadAST]);

  const handleSave = () => {
    if (ast && ast.select.fields.length > 0) {
      onSave(ast);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !ast) return;

    if (active.id.toString().startsWith('column-')) {
      const data = active.data.current;
      if (data && data.type === 'column') {
        // Obter o nome da tabela do node
        const tableNode = nodes.find(n => n.id === data.tableId);
        const tableName = tableNode?.label || data.tableId;
        addColumn(data.tableId, data.column);
      }
    } else if (active.id.toString().startsWith('field-')) {
      const activeIndex = ast.select.fields.findIndex(f => f.id === active.id);
      const overIndex = ast.select.fields.findIndex(f => f.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        // Criar novo array com os campos reordenados
        const newFields = [...ast.select.fields];
        const [removed] = newFields.splice(activeIndex, 1);
        newFields.splice(overIndex, 0, removed);
        reorderColumns(newFields);
      }
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const includedTableIds = useMemo(() => {
    if (!ast) return new Set<string>();
    const tables = new Set<string>();
    if (ast.from.table) tables.add(ast.from.table);
    ast.joins.forEach(j => {
      if ('targetTableId' in j) {
        tables.add(j.targetTableId);
      }
    });
    return tables;
  }, [ast]);

  const tableAliasesForWhere = useMemo(() => {
    if (!ast) return new Map<string, string>();
    const aliases = new Map<string, string>();
    if (ast.from.table) {
      aliases.set(ast.from.table, ast.from.alias);
    }
    ast.joins.forEach(j => {
      if ('targetTableId' in j) {
        aliases.set(j.targetTableId, j.targetAlias);
      }
    });
    return aliases;
  }, [ast]);

  return (
    <Dialog
      open={true}
      onClose={onCancel}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh',
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
        <Typography variant="h6">{title}</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={handleSave}
            disabled={!ast || ast.select.fields.length === 0}
            size="small"
            sx={{
              color: 'success.main',
              '&:hover': { bgcolor: 'success.light', color: 'success.dark' },
              '&:disabled': { opacity: 0.5 },
            }}
            title="Salvar subselect"
          >
            <CheckIcon />
          </IconButton>
          <IconButton
            onClick={onCancel}
            size="small"
            sx={{ color: 'text.secondary' }}
            title="Cancelar"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers sx={{ flex: 1, overflow: 'hidden', p: 0 }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
            {/* Catálogo de Tabelas */}
            <Box
              sx={{
                width: 256,
                borderRight: 1,
                borderColor: 'divider',
                flexShrink: 0,
                overflow: 'hidden',
              }}
            >
              <TableExplorer
                nodes={nodes}
                expandedTables={expandedTables}
                onToggleExpand={(tableId) => {
                  setExpandedTables(prev => {
                    const next = new Set(prev);
                    if (next.has(tableId)) {
                      next.delete(tableId);
                    } else {
                      next.add(tableId);
                    }
                    return next;
                  });
                }}
                onColumnDragStart={(tableId, column) => {
                  // Drag start já é tratado pelo DndContext
                }}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                includedTables={includedTableIds}
                baseTableId={baseTableId}
              />
            </Box>

            {/* Área Principal */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Campos SELECT
                  </Typography>
                  {ast && ast.select.fields.length > 0 ? (
                    <SortableContext
                      items={ast.select.fields.map(f => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <SelectDropZone id="subquery-select">
                        <SelectList
                          fields={ast.select.fields}
                          onReorder={reorderColumns}
                          onRemove={removeColumn}
                          onEditAlias={(fieldId, alias) => updateColumnAlias(fieldId, alias)}
                          tableAliases={tableAliasesForWhere}
                        />
                      </SelectDropZone>
                    </SortableContext>
                  ) : (
                    <SelectDropZone id="subquery-select-empty">
                      <Paper
                        elevation={0}
                        sx={{
                          textAlign: 'center',
                          py: 4,
                          border: 2,
                          borderStyle: 'dashed',
                          borderColor: 'divider',
                          borderRadius: 1,
                        }}
                      >
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                          Arraste colunas aqui
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          ou selecione uma tabela base primeiro
                        </Typography>
                      </Paper>
                    </SelectDropZone>
                  )}
                </Box>

                {/* Preview SQL */}
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    SQL do Subselect
                  </Typography>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                      border: 1,
                      borderColor: 'divider',
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
                        display: 'block',
                        maxHeight: 160,
                        overflowY: 'auto',
                      }}
                    >
                      {sql || '-- Arraste colunas para construir o subselect'}
                    </Typography>
                  </Paper>
                </Box>
              </Box>
            </Box>

            <DragOverlay>
              {activeId ? (
                <Paper
                  elevation={4}
                  sx={{
                    p: 1,
                    border: 1,
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {activeId.toString().startsWith('column-') ? 'Coluna' : 'Campo'}
                  </Typography>
                </Paper>
              ) : null}
            </DragOverlay>
          </Box>
        </DndContext>
      </DialogContent>
    </Dialog>
  );
}
