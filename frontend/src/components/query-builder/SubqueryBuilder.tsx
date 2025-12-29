/**
 * Componente para construir subselects (subqueries)
 * Usado dentro de WHERE (IN, EXISTS), FROM, JOIN, SELECT
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Check } from 'lucide-react';
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
  const {
    ast,
    sql,
    setBaseTable,
    addColumn,
    removeColumn,
    updateFieldAlias,
    updateFieldExpression,
    updateFieldIncludeInSelect,
    addCustomField,
    reorderFields,
    updateJoin,
    removeJoin,
    selectJoinPath,
    pendingJoinPath,
    setPendingJoinPath,
    addWhereCondition,
    updateWhereCondition,
    removeWhereCondition,
    reorderWhereConditions,
    addOrderByField,
    updateOrderByField,
    removeOrderByField,
    reorderOrderByFields,
    addGroupByField,
    updateGroupByField,
    removeGroupByField,
    reorderGroupByFields,
    importAST,
  } = useQueryBuilder(nodes, edges, dbType);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [baseTableId, setBaseTableId] = useState<string | undefined>(initialAST?.from.tableId);

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
    if (initialAST && ast === null) {
      // Usar importAST para carregar o AST completo (incluindo subselects, WHERE, etc.)
      importAST(JSON.stringify(initialAST));
    }
  }, [initialAST, ast, importAST]);

  const handleSave = () => {
    if (ast && ast.select.length > 0) {
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
        addColumn(data.tableId, data.column, tableName);
      }
    } else if (active.id.toString().startsWith('field-')) {
      const activeIndex = ast.select.findIndex(f => f.id === active.id);
      const overIndex = ast.select.findIndex(f => f.id === over.id);

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        // Criar novo array com os campos reordenados
        const newFields = [...ast.select];
        const [removed] = newFields.splice(activeIndex, 1);
        newFields.splice(overIndex, 0, removed);
        reorderFields(newFields);
      }
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const includedTableIds = useMemo(() => {
    if (!ast) return new Set<string>();
    const tables = new Set<string>();
    if (ast.from.tableId) tables.add(ast.from.tableId);
    ast.joins.forEach(j => {
      if ('targetTableId' in j) {
        tables.add(j.targetTableId);
      }
    });
    return tables;
  }, [ast]);

  const availableTablesForWhere = useMemo(() => {
    if (!ast) return new Set<string>();
    const tables = new Set<string>();
    if (ast.from.tableId) tables.add(ast.from.tableId);
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
    if (ast.from.tableId) {
      aliases.set(ast.from.tableId, ast.from.alias);
    }
    ast.joins.forEach(j => {
      if ('targetTableId' in j) {
        aliases.set(j.targetTableId, j.targetAlias);
      }
    });
    return aliases;
  }, [ast]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {title}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={!ast || ast.select.length === 0}
              className="p-2 text-green-600 hover:text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Salvar subselect"
            >
              <Check className="h-5 w-5" />
            </button>
            <button
              onClick={onCancel}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Cancelar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body - Query Builder simplificado */}
        <div className="flex-1 overflow-hidden flex">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            {/* Catálogo de Tabelas */}
            <div className="w-64 border-r border-gray-200 dark:border-gray-700 flex-shrink-0">
              <TableExplorer
                nodes={nodes}
                baseTableId={baseTableId}
                includedTableIds={includedTableIds}
                relatedTableIds={new Set()}
              />
            </div>

            {/* Área Principal */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    Campos SELECT
                  </h3>
                  {ast && ast.select.length > 0 ? (
                    <SortableContext
                      items={ast.select.map(f => f.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <SelectDropZone id="subquery-select">
                        <SelectList
                          fields={ast.select}
                          onRemove={removeColumn}
                          onUpdateAlias={updateFieldAlias}
                          onUpdateExpression={updateFieldExpression}
                          onUpdateIncludeInSelect={updateFieldIncludeInSelect}
                          onAddCustomField={addCustomField}
                          onReorder={(fields) => {
                            // Usar importAST para atualizar o AST (já que setAST não é exportado)
                            const updatedAST = {
                              ...ast,
                              select: fields.map((f, i) => ({ ...f, order: i })),
                            };
                            importAST(JSON.stringify(updatedAST));
                          }}
                          tableAliases={tableAliasesForWhere}
                        />
                      </SelectDropZone>
                    </SortableContext>
                  ) : (
                    <SelectDropZone id="subquery-select-empty">
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded">
                        <p className="text-sm">Arraste colunas aqui</p>
                        <p className="text-xs mt-1">ou selecione uma tabela base primeiro</p>
                      </div>
                    </SelectDropZone>
                  )}
                </div>

                {/* Preview SQL */}
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                    SQL do Subselect
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-900 rounded p-3 border border-gray-200 dark:border-gray-700">
                    <pre className="text-xs font-mono text-gray-700 dark:text-gray-300 whitespace-pre-wrap max-h-40 overflow-y-auto custom-scrollbar">
                      {sql || '-- Arraste colunas para construir o subselect'}
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            <DragOverlay>
              {activeId ? (
                <div className="bg-white dark:bg-gray-800 rounded shadow-lg p-2 border border-gray-200 dark:border-gray-700">
                  <div className="text-xs font-mono text-gray-900 dark:text-white">
                    {activeId.toString().startsWith('column-') ? 'Coluna' : 'Campo'}
                  </div>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>
    </div>
  );
}

