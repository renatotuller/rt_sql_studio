/**
 * Componente de lista de colunas SELECT
 * Exibe as colunas selecionadas e permite reordenar, editar alias e remover
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  TextField,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  DragIndicator as DragIndicatorIcon,
  CheckBox as CheckBoxIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SelectField } from '../../types/query-builder';

interface SelectListProps {
  fields: SelectField[];
  onReorder: (fields: SelectField[]) => void;
  onRemove: (fieldId: string) => void;
  onEditAlias: (fieldId: string, alias: string) => void;
  tableAliases: Map<string, string>;
}

interface SortableItemProps {
  field: SelectField;
  tableAlias: string;
  onRemove: () => void;
  onEditAlias: (alias: string) => void;
}

function SortableItem({ field, tableAlias, onRemove, onEditAlias }: SortableItemProps) {
  const theme = useTheme();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(field.alias || '');
  
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

  const handleSave = () => {
    onEditAlias(editValue.trim());
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(field.alias || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      elevation={isDragging ? 4 : 1}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 1,
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        transition: 'box-shadow 0.2s',
        '&:hover': {
          '& > .MuiBox-root:last-of-type': {
            opacity: 1,
          },
        },
        '& .action-buttons': {
          opacity: 0,
          transition: 'opacity 0.2s',
        },
        '&:hover .action-buttons': {
          opacity: 1,
        },
      }}
    >
      {/* Checkbox */}
      <CheckBoxIcon
        sx={{
          fontSize: 16,
          color: 'success.main',
          flexShrink: 0,
        }}
      />
      
      {/* Drag handle */}
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

      {/* Conteúdo */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        {field.expression ? (
          // Expressão customizada
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              noWrap: true,
            }}
          >
            {field.expression}
            {field.alias && (
              <Box component="span" sx={{ color: 'primary.main' }}>
                {' AS '}
                {field.alias}
              </Box>
            )}
          </Typography>
        ) : (
          // Coluna normal
          <Typography
            variant="body2"
            sx={{
              fontFamily: 'monospace',
              fontSize: '0.8125rem',
              noWrap: true,
            }}
          >
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {tableAlias}.
            </Box>
            {field.column}
            {field.alias && (
              <Box component="span" sx={{ color: 'primary.main' }}>
                {' AS '}
                {field.alias}
              </Box>
            )}
          </Typography>
        )}
      </Box>

      {/* Botões de ação */}
      <Box
        className="action-buttons"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
        }}
      >
        {isEditing ? (
          <>
            <TextField
              size="small"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Alias"
              autoFocus
              sx={{
                width: 96,
                '& .MuiInputBase-root': {
                  fontSize: '0.75rem',
                  height: 28,
                },
              }}
            />
            <Tooltip title="Salvar">
              <IconButton
                onClick={handleSave}
                size="small"
                sx={{
                  color: 'success.main',
                  p: 0.5,
                }}
              >
                <CheckIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Cancelar">
              <IconButton
                onClick={handleCancel}
                size="small"
                sx={{
                  color: 'text.secondary',
                  p: 0.5,
                }}
              >
                <CloseIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <>
            <Tooltip title="Ver relacionamentos">
              <IconButton
                onClick={() => {
                  // TODO: Mostrar relacionamentos da coluna
                  alert('Funcionalidade de relacionamentos em desenvolvimento');
                }}
                size="small"
                sx={{
                  color: 'text.secondary',
                  p: 0.5,
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <LinkIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Editar alias">
              <IconButton
                onClick={() => setIsEditing(true)}
                size="small"
                sx={{
                  color: 'text.secondary',
                  p: 0.5,
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Remover">
              <IconButton
                onClick={onRemove}
                size="small"
                sx={{
                  color: 'text.secondary',
                  p: 0.5,
                  '&:hover': {
                    color: 'error.main',
                  },
                }}
              >
                <DeleteIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>
    </Paper>
  );
}

export default function SelectList({
  fields,
  onReorder,
  onRemove,
  onEditAlias,
  tableAliases,
}: SelectListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const sortedFields = [...fields].sort((a, b) => a.order - b.order);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedFields.findIndex(f => f.id === active.id);
      const newIndex = sortedFields.findIndex(f => f.id === over.id);
      
      const reordered = arrayMove(sortedFields, oldIndex, newIndex);
      onReorder(reordered);
    }
  };

  const getTableAlias = (tableId: string): string => {
    return tableAliases.get(tableId) || (tableId.includes('.') ? tableId.split('.').pop()! : tableId);
  };

  if (fields.length === 0) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 4,
          textAlign: 'center',
        }}
      >
        <Box sx={{ color: 'text.secondary' }}>
          <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
            Nenhuma coluna selecionada
          </Typography>
          <Typography variant="caption">
            Arraste colunas do catálogo de tabelas para cá
          </Typography>
        </Box>
      </Box>
    );
  }

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
          flex: 1,
          overflow: 'auto',
          p: 1.5,
        }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedFields.map(f => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {sortedFields.map(field => (
                <SortableItem
                  key={field.id}
                  field={field}
                  tableAlias={getTableAlias(field.tableId)}
                  onRemove={() => onRemove(field.id)}
                  onEditAlias={(alias) => onEditAlias(field.id, alias)}
                />
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      </Box>
    </Box>
  );
}
