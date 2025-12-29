/**
 * Editor de GROUP BY
 * Permite adicionar, remover e reordenar campos para GROUP BY
 */

import { useState } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
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
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex-1">
        <span className="text-sm font-mono text-gray-700 dark:text-gray-300">
          {displayName}
        </span>
      </div>

      <button
        onClick={() => onRemove(field.id)}
        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 rounded transition-colors"
        title="Remover"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
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
}: GroupByEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [selectedColumn, setSelectedColumn] = useState<string>('');

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

    onAdd({
      tableId: selectedTableId,
      column: selectedColumn,
      alias: selectField?.alias,
    });

    setIsAdding(false);
    setSelectedTableId('');
    setSelectedColumn('');
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
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          GROUP BY ({fields.length})
        </h3>
        <button
          onClick={() => setIsAdding(true)}
          className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          title="Adicionar campo"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {/* Formulário de adição */}
        {isAdding && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800 space-y-2">
            <div className="flex items-center gap-2">
              <select
                value={selectedTableId}
                onChange={e => {
                  setSelectedTableId(e.target.value);
                  setSelectedColumn('');
                }}
                className="flex-1 text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="">Selecione a tabela</option>
                {availableTables.map(tableId => {
                  const table = nodes.find(n => n.id === tableId);
                  const alias = tableAliases.get(tableId) || tableId;
                  return (
                    <option key={tableId} value={tableId}>
                      {table?.label || tableId} ({alias})
                    </option>
                  );
                })}
              </select>

              <select
                value={selectedColumn}
                onChange={e => setSelectedColumn(e.target.value)}
                disabled={!selectedTableId}
                className="flex-1 text-xs px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              >
                <option value="">Selecione a coluna</option>
                {availableColumns.map(col => {
                  const selectField = availableFields.find(
                    f => f.tableId === selectedTableId && f.column === col.name
                  );
                  return (
                    <option key={col.name} value={col.name}>
                      {col.name}
                      {selectField?.alias && ` (AS ${selectField.alias})`}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAdd}
                disabled={!selectedTableId || !selectedColumn}
                className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-xs rounded transition-colors"
              >
                Adicionar
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setSelectedTableId('');
                  setSelectedColumn('');
                }}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Lista de campos */}
        {fields.length === 0 && !isAdding ? (
          <div className="text-center text-sm text-gray-500 dark:text-gray-400 p-4">
            Nenhum campo no GROUP BY. Adicione campos do SELECT para agrupar.
          </div>
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
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

