/**
 * Editor de GROUP BY
 * Permite adicionar, remover e reordenar campos para GROUP BY
 */

import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Select,
  MenuItem,
  FormControl,
  Paper,
  Tooltip,
  TextField,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { GraphNode } from '../../api/client';
import type { SelectField, QueryAST } from '../../types/query-builder';

type GroupByField = NonNullable<QueryAST['groupBy']>[0];

interface GroupByEditorProps {
  fields: GroupByField[];
  onAdd: (field: Omit<GroupByField, 'id' | 'order'>) => void;
  onUpdate: (id: string, updates: Partial<GroupByField>) => void;
  onRemove: (id: string) => void;
  onReorder: (fields: GroupByField[]) => void;
  nodes: GraphNode[];
  availableFields: SelectField[]; // Campos disponíveis do SELECT
  tableAliases: Map<string, string>; // Mapeamento tableId -> alias
  onAddAggregate?: (tableId: string, column: string, aggregateFunction: 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX', alias?: string) => void; // Callback para adicionar agregação
}

function GroupByItem({
  field,
  onRemove,
  nodes,
  availableFields,
  tableAliases,
}: {
  field: GroupByField;
  onRemove: (id: string) => void;
  nodes: GraphNode[];
  availableFields: SelectField[];
  tableAliases: Map<string, string>;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const table = nodes.find(n => n.id === field.tableId);
  const tableAlias = tableAliases.get(field.tableId) || field.tableId;

  // Verificar se o campo tem alias no SELECT
  const selectField = availableFields.find(
    f => f.tableId === field.tableId && f.column === field.column
  );
  const displayName = selectField?.alias
    ? selectField.alias
    : `${tableAlias}.${field.column}`;

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={0}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        bgcolor: 'action.hover',
      }}
    >
      <IconButton
        {...attributes}
        {...listeners}
        size="small"
        sx={{
          cursor: 'grab',
          '&:active': {
            cursor: 'grabbing',
          },
          color: 'text.secondary',
          p: 0.5,
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 16 }} />
      </IconButton>

      <Box sx={{ flex: 1 }}>
        <Typography
          variant="body2"
          sx={{
            fontFamily: 'monospace',
            fontSize: '0.8125rem',
            color: 'text.primary',
          }}
        >
          {displayName}
        </Typography>
      </Box>

      <Tooltip title="Remover">
        <IconButton
          onClick={() => onRemove(field.id)}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              color: 'error.main',
            },
          }}
        >
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

export default function GroupByEditor({
  fields,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  nodes,
  availableFields,
  tableAliases,
  onAddAggregate,
}: GroupByEditorProps) {
  const theme = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedAggregate, setSelectedAggregate] = useState<'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX' | ''>('');
  const [aggregateAlias, setAggregateAlias] = useState<string>('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex(f => f.id === active.id);
    const newIndex = fields.findIndex(f => f.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newFields = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
        ...f,
        order: i,
      }));
      onReorder(newFields);
    }
  };

  const handleAdd = () => {
    if (!selectedTableId || !selectedColumn) return;

    // Verificar se já existe este campo
    const exists = fields.some(
      f => f.tableId === selectedTableId && f.column === selectedColumn
    );

    if (exists) {
      alert('Este campo já está no GROUP BY');
      return;
    }

    const selectField = availableFields.find(
      f => f.tableId === selectedTableId && f.column === selectedColumn
    );

    // Adicionar ao GROUP BY
    onAdd({
      tableId: selectedTableId,
      column: selectedColumn,
      alias: selectField?.alias,
    });

    // Se uma função de agregação foi selecionada, adicionar também ao SELECT
    if (selectedAggregate && onAddAggregate) {
      const alias = aggregateAlias.trim() || undefined;
      // Sempre usar a coluna selecionada para a agregação
      onAddAggregate(selectedTableId, selectedColumn, selectedAggregate, alias);
    }

    setIsAdding(false);
    setSelectedTableId('');
    setSelectedColumn('');
    setSelectedAggregate('');
    setAggregateAlias('');
  };

  // Obter tabelas disponíveis (das que têm campos no SELECT)
  const availableTables = Array.from(
    new Set(availableFields.map(f => f.tableId))
  );

  // Obter colunas da tabela selecionada
  const selectedTable = nodes.find(n => n.id === selectedTableId);
  const availableColumns = selectedTable
    ? selectedTable.columns.filter(c =>
        availableFields.some(
          f => f.tableId === selectedTableId && f.column === c.name
        )
      )
    : [];

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          GROUP BY ({fields.length})
        </Typography>
        <Tooltip title="Adicionar campo">
          <IconButton
            onClick={() => setIsAdding(true)}
            size="small"
            sx={{
              color: 'text.secondary',
              '&:hover': {
                color: 'primary.main',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1.5,
        }}
      >
        {/* Formulário de adição */}
        {isAdding && (
          <Paper
            elevation={0}
            sx={{
              p: 1.5,
              border: 1,
              borderColor: 'primary.main',
              borderRadius: 1,
              bgcolor: alpha(theme.palette.primary.main, 0.04),
              mb: 1,
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FormControl size="small" sx={{ flex: 1 }}>
                    <Select
                      value={selectedTableId}
                      onChange={e => {
                        setSelectedTableId(e.target.value);
                        setSelectedColumn('');
                      }}
                      sx={{ fontSize: '0.75rem', height: 32 }}
                    >
                      <MenuItem value="" sx={{ fontSize: '0.75rem' }}>Selecione a tabela</MenuItem>
                      {availableTables.map(tableId => {
                        const table = nodes.find(n => n.id === tableId);
                        const alias = tableAliases.get(tableId) || tableId;
                        return (
                          <MenuItem key={tableId} value={tableId} sx={{ fontSize: '0.75rem' }}>
                            {table?.label || tableId} ({alias})
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>

                  <FormControl size="small" sx={{ flex: 1 }} disabled={!selectedTableId}>
                    <Select
                      value={selectedColumn}
                      onChange={e => setSelectedColumn(e.target.value)}
                      sx={{ fontSize: '0.75rem', height: 32 }}
                    >
                      <MenuItem value="" sx={{ fontSize: '0.75rem' }}>Selecione a coluna</MenuItem>
                      {availableColumns.map(col => {
                        const selectField = availableFields.find(
                          f => f.tableId === selectedTableId && f.column === col.name
                        );
                        return (
                          <MenuItem key={col.name} value={col.name} sx={{ fontSize: '0.75rem' }}>
                            {col.name}
                            {selectField?.alias && ` (AS ${selectField.alias})`}
                          </MenuItem>
                        );
                      })}
                    </Select>
                  </FormControl>
                </Box>

                {/* Seletor de função de agregação */}
                {onAddAggregate && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                      Função de Agregação (opcional)
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <FormControl size="small" sx={{ flex: 1 }}>
                        <Select
                          value={selectedAggregate}
                          onChange={e => setSelectedAggregate(e.target.value as typeof selectedAggregate)}
                          sx={{ fontSize: '0.75rem', height: 32 }}
                          displayEmpty
                        >
                          <MenuItem value="" sx={{ fontSize: '0.75rem' }}>Sem agregação</MenuItem>
                          <MenuItem value="COUNT" sx={{ fontSize: '0.75rem' }}>COUNT - Contar</MenuItem>
                          <MenuItem value="SUM" sx={{ fontSize: '0.75rem' }}>SUM - Somar</MenuItem>
                          <MenuItem value="AVG" sx={{ fontSize: '0.75rem' }}>AVG - Média</MenuItem>
                          <MenuItem value="MIN" sx={{ fontSize: '0.75rem' }}>MIN - Mínimo</MenuItem>
                          <MenuItem value="MAX" sx={{ fontSize: '0.75rem' }}>MAX - Máximo</MenuItem>
                        </Select>
                      </FormControl>
                      {selectedAggregate && (
                        <TextField
                          size="small"
                          placeholder="Alias (opcional)"
                          value={aggregateAlias}
                          onChange={e => setAggregateAlias(e.target.value)}
                          sx={{ flex: 1, fontSize: '0.75rem', '& .MuiInputBase-input': { fontSize: '0.75rem', height: 32, py: 0.5 } }}
                        />
                      )}
                    </Box>
                    {selectedAggregate && (
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
                        A função {selectedAggregate} será adicionada ao SELECT automaticamente
                      </Typography>
                    )}
                  </Box>
                )}
              </Box>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Button
                  onClick={handleAdd}
                  disabled={!selectedTableId || !selectedColumn}
                  variant="contained"
                  size="small"
                  fullWidth
                  sx={{ fontSize: '0.75rem', minHeight: 'auto' }}
                >
                  Adicionar
                </Button>
                <Button
                  onClick={() => {
                    setIsAdding(false);
                    setSelectedTableId('');
                    setSelectedColumn('');
                    setSelectedAggregate('');
                    setAggregateAlias('');
                  }}
                  size="small"
                  sx={{ fontSize: '0.75rem', minHeight: 'auto' }}
                >
                  Cancelar
                </Button>
              </Box>
            </Box>
          </Paper>
        )}

        {/* Lista de campos */}
        {fields.length === 0 && !isAdding ? (
          <Box
            sx={{
              textAlign: 'center',
              color: 'text.secondary',
              p: 2,
            }}
          >
            <Typography variant="body2">
              Nenhum campo no GROUP BY. Adicione campos do SELECT para agrupar.
            </Typography>
          </Box>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={fields.map(f => f.id)}
              strategy={verticalListSortingStrategy}
            >
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {fields
                  .sort((a, b) => a.order - b.order)
                  .map(field => (
                    <GroupByItem
                      key={field.id}
                      field={field}
                      onRemove={onRemove}
                      nodes={nodes}
                      availableFields={availableFields}
                      tableAliases={tableAliases}
                    />
                  ))}
              </Box>
            </SortableContext>
          </DndContext>
        )}
      </Box>
    </Box>
  );
}
