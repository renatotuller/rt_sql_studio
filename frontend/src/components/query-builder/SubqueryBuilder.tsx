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
  Button,
  Menu,
  MenuItem,
  Dialog as AggregateDialog,
  DialogTitle as AggregateDialogTitle,
  DialogContent as AggregateDialogContent,
  DialogActions as AggregateDialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  Alert,
} from '@mui/material';
import {
  Close as CloseIcon,
  Check as CheckIcon,
  Add as AddIcon,
  Layers as LayersIcon,
  Code as CodeIcon,
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
  /** FieldId do subselect sendo editado (para atualização) */
  editingFieldId?: string | null;
  /** Callback para atualizar subselect existente */
  onUpdateSubquery?: (fieldId: string, subqueryAST: QueryAST) => void;
}

export default function SubqueryBuilder({
  initialAST,
  onSave,
  onCancel,
  nodes,
  edges,
  dbType,
  title = 'Construir Subselect',
  editingFieldId,
  onUpdateSubquery,
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
    addAggregate,
    addExpression,
    addSubquery,
    updateSubquery,
    tableAliases,
  } = useQueryBuilder({ nodes, edges, dbType });

  const [activeId, setActiveId] = useState<string | null>(null);
  const [baseTableId, setBaseTableId] = useState<string | undefined>(initialAST?.from.table);
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [advancedMenuAnchor, setAdvancedMenuAnchor] = useState<null | HTMLElement>(null);
  const [aggregateDialogOpen, setAggregateDialogOpen] = useState(false);
  const [aggregateFunction, setAggregateFunction] = useState<'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'>('COUNT');
  const [aggregateFieldId, setAggregateFieldId] = useState('');
  const [aggregateAlias, setAggregateAlias] = useState('');
  const [customFieldDialogOpen, setCustomFieldDialogOpen] = useState(false);
  const [customExpression, setCustomExpression] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [subqueryDialogOpen, setSubqueryDialogOpen] = useState(false);
  const [editingSubqueryFieldId, setEditingSubqueryFieldId] = useState<string | null>(null);

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

    const activeIdStr = active.id.toString();
    const overIdStr = over.id.toString();

    // Se arrastou uma coluna do TableExplorer
    if (activeIdStr.startsWith('column-')) {
      const data = active.data.current;
      if (data && data.type === 'column') {
        // Verificar se foi solto na zona de drop (SelectDropZone)
        if (overIdStr === 'subquery-select' || overIdStr === 'subquery-select-empty') {
          addColumn(data.tableId, data.column);
        }
      }
    } 
    // Se arrastou um campo do SELECT para reordenar
    else if (activeIdStr.startsWith('field-')) {
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
      maxWidth="xl"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '95vh',
          height: '95vh',
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

      <DialogContent dividers sx={{ flex: 1, overflow: 'hidden', p: 2 }}>
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
                width: 280,
                borderRight: 1,
                borderColor: 'divider',
                flexShrink: 0,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
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
                useDndKit={true}
              />
            </Box>

            {/* Área Principal */}
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', ml: 2 }}>
              <Box sx={{ flex: 1, overflowY: 'auto' }}>
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Campos SELECT
                    </Typography>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={(e) => setAdvancedMenuAnchor(e.currentTarget)}
                      sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.5, px: 1 }}
                    >
                      Avançado
                    </Button>
                    <Menu
                      anchorEl={advancedMenuAnchor}
                      open={Boolean(advancedMenuAnchor)}
                      onClose={() => setAdvancedMenuAnchor(null)}
                      anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left',
                      }}
                      transformOrigin={{
                        vertical: 'top',
                        horizontal: 'left',
                      }}
                    >
                      <MenuItem
                        onClick={() => {
                          setAggregateDialogOpen(true);
                          setAggregateFunction('COUNT');
                          setAggregateFieldId('');
                          setAggregateAlias('');
                          setAdvancedMenuAnchor(null);
                        }}
                      >
                        <LayersIcon sx={{ fontSize: 16, mr: 1, color: 'warning.main' }} />
                        Agregação
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setCustomFieldDialogOpen(true);
                          setCustomExpression('');
                          setCustomAlias('');
                          setAdvancedMenuAnchor(null);
                        }}
                      >
                        <CodeIcon sx={{ fontSize: 16, mr: 1, color: 'primary.main' }} />
                        Personalizada
                      </MenuItem>
                      <MenuItem
                        onClick={() => {
                          setEditingSubqueryFieldId(null);
                          setSubqueryDialogOpen(true);
                          setAdvancedMenuAnchor(null);
                        }}
                      >
                        <CodeIcon sx={{ fontSize: 16, mr: 1, color: 'secondary.main' }} />
                        Subselect
                      </MenuItem>
                    </Menu>
                  </Box>
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
                          onEditSubquery={(fieldId) => {
                            setEditingSubqueryFieldId(fieldId);
                            setSubqueryDialogOpen(true);
                          }}
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

      {/* Dialog de Agregação */}
      <AggregateDialog
        open={aggregateDialogOpen}
        onClose={() => {
          setAggregateDialogOpen(false);
          setAggregateFunction('COUNT');
          setAggregateFieldId('');
          setAggregateAlias('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <AggregateDialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Adicionar Função de Agregação</Typography>
            <IconButton
              onClick={() => {
                setAggregateDialogOpen(false);
                setAggregateFunction('COUNT');
                setAggregateFieldId('');
                setAggregateAlias('');
              }}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </AggregateDialogTitle>
        <AggregateDialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Função de Agregação</InputLabel>
              <Select
                value={aggregateFunction}
                onChange={(e) => setAggregateFunction(e.target.value as typeof aggregateFunction)}
                label="Função de Agregação"
              >
                <MenuItem value="COUNT">COUNT - Contar linhas</MenuItem>
                <MenuItem value="SUM">SUM - Somar valores</MenuItem>
                <MenuItem value="AVG">AVG - Média</MenuItem>
                <MenuItem value="MIN">MIN - Valor mínimo</MenuItem>
                <MenuItem value="MAX">MAX - Valor máximo</MenuItem>
              </Select>
            </FormControl>
            
            {ast.select.fields.length === 0 ? (
              <Alert severity="warning">
                <Typography variant="body2">
                  Adicione pelo menos uma coluna no SELECT antes de criar funções de agregação.
                </Typography>
              </Alert>
            ) : (
              <FormControl fullWidth>
                <InputLabel>Coluna do SELECT</InputLabel>
                <Select
                  value={aggregateFieldId}
                  onChange={(e) => setAggregateFieldId(e.target.value)}
                  label="Coluna do SELECT"
                >
                  <MenuItem value="">
                    {aggregateFunction === 'COUNT' ? 'COUNT(*) - Contar todas as linhas' : 'Selecione uma coluna...'}
                  </MenuItem>
                  {ast.select.fields
                    .filter(field => {
                      if (field.type === 'aggregate' || field.type === 'subquery' || field.expression) return false;
                      if (!field.tableId || !field.column) return false;
                      if (aggregateFunction === 'COUNT') return true;
                      const node = nodes.find(n => n.id === field.tableId);
                      const column = node?.columns?.find(c => c.name === field.column);
                      if (!column) return false;
                      const numericTypes = ['int', 'bigint', 'decimal', 'numeric', 'float', 'double', 'money', 'smallmoney', 'tinyint', 'smallint', 'real'];
                      return numericTypes.some(type => column.type.toLowerCase().includes(type));
                    })
                    .map(field => {
                      const tableAlias = tableAliases.get(field.tableId) || field.tableId;
                      const displayName = field.alias 
                        ? field.alias 
                        : `${tableAlias}.${field.column}`;
                      return (
                        <MenuItem key={field.id} value={field.id}>
                          {displayName} {field.column && `(${field.column})`}
                        </MenuItem>
                      );
                    })}
                </Select>
                {aggregateFunction === 'COUNT' && (
                  <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary' }}>
                    Selecione uma coluna ou deixe vazio para COUNT(*) que conta todas as linhas
                  </Typography>
                )}
                {aggregateFunction !== 'COUNT' && (
                  <Typography variant="caption" sx={{ mt: 0.5, color: 'text.secondary' }}>
                    Apenas colunas numéricas do SELECT podem ser usadas com {aggregateFunction}
                  </Typography>
                )}
              </FormControl>
            )}
            
            <TextField
              label="Alias (opcional)"
              value={aggregateAlias}
              onChange={(e) => setAggregateAlias(e.target.value)}
              placeholder="Ex: total_vendas, quantidade"
              fullWidth
              helperText="Nome que aparecerá na coluna de resultados"
            />
          </Box>
        </AggregateDialogContent>
        <AggregateDialogActions sx={{ px: 2, py: 1.5 }}>
          <Button
            onClick={() => {
              setAggregateDialogOpen(false);
              setAggregateFunction('COUNT');
              setAggregateFieldId('');
              setAggregateAlias('');
            }}
            variant="outlined"
            size="small"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (aggregateFunction === 'COUNT' && !aggregateFieldId) {
                addAggregate('', '*', aggregateFunction, aggregateAlias.trim() || undefined);
              } else if (aggregateFieldId) {
                const field = ast.select.fields.find(f => f.id === aggregateFieldId);
                if (field) {
                  addAggregate(
                    field.tableId,
                    field.column || '*',
                    aggregateFunction,
                    aggregateAlias.trim() || undefined
                  );
                }
              }
              setAggregateDialogOpen(false);
              setAggregateFunction('COUNT');
              setAggregateFieldId('');
              setAggregateAlias('');
            }}
            disabled={ast.select.fields.length === 0 || (aggregateFunction !== 'COUNT' && !aggregateFieldId)}
            variant="contained"
            size="small"
          >
            Adicionar
          </Button>
        </AggregateDialogActions>
      </AggregateDialog>

      {/* Dialog de Expressão Customizada */}
      <AggregateDialog
        open={customFieldDialogOpen}
        onClose={() => {
          setCustomFieldDialogOpen(false);
          setCustomExpression('');
          setCustomAlias('');
        }}
        maxWidth="sm"
        fullWidth
      >
        <AggregateDialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Adicionar Campo Personalizado</Typography>
            <IconButton
              onClick={() => {
                setCustomFieldDialogOpen(false);
                setCustomExpression('');
                setCustomAlias('');
              }}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </AggregateDialogTitle>
        <AggregateDialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Expressão SQL"
              placeholder="Ex: COUNT(*), SUM(coluna), CONCAT(nome, ' ', sobrenome)"
              value={customExpression}
              onChange={(e) => setCustomExpression(e.target.value)}
              multiline
              rows={3}
              fullWidth
              helperText="Digite uma expressão SQL válida (funções, cálculos, etc.)"
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                },
              }}
            />
            <TextField
              label="Alias (opcional)"
              placeholder="Ex: total_vendas, nome_completo"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
              fullWidth
              helperText="Nome que aparecerá na coluna de resultados"
            />
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="caption">
                <strong>Dica:</strong> Você pode usar colunas das tabelas usando seus aliases (ex: t1.nome, t2.valor)
              </Typography>
            </Alert>
          </Box>
        </AggregateDialogContent>
        <AggregateDialogActions sx={{ px: 2, py: 1.5 }}>
          <Button
            onClick={() => {
              setCustomFieldDialogOpen(false);
              setCustomExpression('');
              setCustomAlias('');
            }}
            variant="outlined"
            size="small"
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (customExpression.trim()) {
                addExpression(customExpression.trim(), customAlias.trim() || undefined);
                setCustomFieldDialogOpen(false);
                setCustomExpression('');
                setCustomAlias('');
              }
            }}
            disabled={!customExpression.trim()}
            variant="contained"
            size="small"
          >
            Adicionar
          </Button>
        </AggregateDialogActions>
      </AggregateDialog>

      {/* Dialog de Subselect no SELECT */}
      <AggregateDialog
        open={subqueryDialogOpen}
        onClose={() => {
          setSubqueryDialogOpen(false);
          setEditingSubqueryFieldId(null);
        }}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: {
            width: '95vw',
            height: '95vh',
            maxWidth: '95vw',
            maxHeight: '95vh',
            m: 0,
          },
        }}
      >
        <AggregateDialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              {editingSubqueryFieldId ? 'Editar Subselect' : 'Adicionar Subselect'}
            </Typography>
            <IconButton
              onClick={() => {
                setSubqueryDialogOpen(false);
                setEditingSubqueryFieldId(null);
              }}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </AggregateDialogTitle>
        <AggregateDialogContent dividers sx={{ p: 0, height: 'calc(95vh - 64px)', overflow: 'hidden' }}>
          <SubqueryBuilder
            initialAST={
              editingSubqueryFieldId
                ? ast.select.fields.find(f => f.id === editingSubqueryFieldId)?.subquery || null
                : null
            }
            onSave={(subqueryAST) => {
              if (editingSubqueryFieldId) {
                if (onUpdateSubquery) {
                  onUpdateSubquery(editingSubqueryFieldId, subqueryAST);
                } else {
                  // Tentar usar updateSubquery do hook local
                  updateSubquery(editingSubqueryFieldId, subqueryAST);
                }
                setSubqueryDialogOpen(false);
                setEditingSubqueryFieldId(null);
              } else {
                addSubquery(subqueryAST);
                setSubqueryDialogOpen(false);
                setEditingSubqueryFieldId(null);
              }
            }}
            onCancel={() => {
              setSubqueryDialogOpen(false);
              setEditingSubqueryFieldId(null);
            }}
            nodes={nodes}
            edges={edges}
            dbType={dbType}
            title={editingSubqueryFieldId ? 'Editar Subselect' : 'Criar Subselect'}
          />
        </AggregateDialogContent>
      </AggregateDialog>
    </Dialog>
  );
}
