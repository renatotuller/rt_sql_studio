/**
 * Editor de ORDER BY
 * Permite adicionar, remover e reordenar campos para ORDER BY
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

type OrderByField = NonNullable<QueryAST['orderBy']>[0];

interface OrderByEditorProps {
  fields: OrderByField[];
  onAdd: (field: Omit<OrderByField, 'id' | 'order'>) => void;
  onUpdate: (id: string, updates: Partial<OrderByField>) => void;
  onRemove: (id: string) => void;
  onReorder: (fields: OrderByField[]) => void;
  nodes: GraphNode[];
  availableFields: SelectField[]; // Campos disponíveis do SELECT
  tableAliases: Map<string, string>; // Mapeamento tableId -> alias
}

function OrderByItem({
  field,
  onUpdate,
  onRemove,
  nodes,
  availableFields,
  tableAliases,
}: {
  field: OrderByField;
  onUpdate: (id: string, updates: Partial<OrderByField>) => void;
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

      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
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
        <FormControl size="small" sx={{ minWidth: 80 }}>
          <Select
            value={field.direction}
            onChange={e =>
              onUpdate(field.id, { direction: e.target.value as 'ASC' | 'DESC' })
            }
            sx={{ fontSize: '0.75rem', height: 28 }}
          >
            <MenuItem value="ASC" sx={{ fontSize: '0.75rem' }}>ASC</MenuItem>
            <MenuItem value="DESC" sx={{ fontSize: '0.75rem' }}>DESC</MenuItem>
          </Select>
        </FormControl>
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

export default function OrderByEditor({
  fields,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  nodes,
  availableFields,
  tableAliases,
}: OrderByEditorProps) {
  const theme = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedDirection, setSelectedDirection] = useState<'ASC' | 'DESC'>('ASC');

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
      alert('Este campo já está no ORDER BY');
      return;
    }

    const selectField = availableFields.find(
      f => f.tableId === selectedTableId && f.column === selectedColumn
    );

    onAdd({
      tableId: selectedTableId,
      column: selectedColumn,
      alias: selectField?.alias,
      direction: selectedDirection,
    });

    setIsAdding(false);
    setSelectedTableId('');
    setSelectedColumn('');
    setSelectedDirection('ASC');
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
          ORDER BY ({fields.length})
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

                <FormControl size="small" sx={{ minWidth: 80 }}>
                  <Select
                    value={selectedDirection}
                    onChange={e =>
                      setSelectedDirection(e.target.value as 'ASC' | 'DESC')
                    }
                    sx={{ fontSize: '0.75rem', height: 32 }}
                  >
                    <MenuItem value="ASC" sx={{ fontSize: '0.75rem' }}>ASC</MenuItem>
                    <MenuItem value="DESC" sx={{ fontSize: '0.75rem' }}>DESC</MenuItem>
                  </Select>
                </FormControl>
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
              Nenhum campo no ORDER BY. Adicione campos do SELECT para ordenar.
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
                    <OrderByItem
                      key={field.id}
                      field={field}
                      onUpdate={onUpdate}
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
