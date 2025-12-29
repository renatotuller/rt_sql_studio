/**
 * Componente de lista de colunas SELECT
 * Exibe as colunas selecionadas e permite reordenar, editar alias e remover
 */

import { useState } from 'react';
import { Trash2, Edit2, Check, X, GripVertical } from 'lucide-react';
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
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 
        border border-gray-200 dark:border-gray-700 rounded-lg
        ${isDragging ? 'shadow-lg' : 'shadow-sm'}
        group transition-shadow
      `}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0">
        {field.expression ? (
          // Expressão customizada
          <div className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate">
            {field.expression}
            {field.alias && (
              <span className="text-blue-600 dark:text-blue-400"> AS {field.alias}</span>
            )}
          </div>
        ) : (
          // Coluna normal
          <div className="font-mono text-sm text-gray-900 dark:text-gray-100 truncate">
            <span className="text-gray-500">{tableAlias}.</span>
            {field.column}
            {field.alias && (
              <span className="text-blue-600 dark:text-blue-400"> AS {field.alias}</span>
            )}
          </div>
        )}
      </div>

      {/* Botões de ação */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isEditing ? (
          <>
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Alias"
              className="w-24 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                       focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={handleSave}
              className="p-1 text-green-600 hover:text-green-700"
              title="Salvar"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Cancelar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="Editar alias"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={onRemove}
              className="p-1 text-gray-400 hover:text-red-600"
              title="Remover"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
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
      <div className="h-full flex flex-col bg-white dark:bg-gray-900">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            SELECT (0)
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <p className="text-sm font-medium mb-2">Nenhuma coluna selecionada</p>
            <p className="text-xs">Arraste colunas do catálogo de tabelas para cá</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          SELECT ({fields.length})
        </h3>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedFields.map(f => f.id)}
            strategy={verticalListSortingStrategy}
          >
            {sortedFields.map(field => (
              <SortableItem
                key={field.id}
                field={field}
                tableAlias={getTableAlias(field.tableId)}
                onRemove={() => onRemove(field.id)}
                onEditAlias={(alias) => onEditAlias(field.id, alias)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
