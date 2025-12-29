/**
 * Componente para visualizar e editar condições WHERE
 */

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Check, X as XIcon, Database } from 'lucide-react';
import type { WhereCondition, WhereOperator, WhereLogicalOperator, QueryAST } from '../../types/query-builder';
import type { GraphNode, GraphEdge } from '../../api/client';
import SubqueryBuilder from './SubqueryBuilder';

interface WhereEditorProps {
  conditions: WhereCondition[];
  onAdd: (condition: WhereCondition) => void;
  onUpdate: (conditionId: string, updates: Partial<WhereCondition>) => void;
  onRemove: (conditionId: string) => void;
  onReorder: (conditions: WhereCondition[]) => void;
  nodes: GraphNode[];
  edges: GraphEdge[]; // Arestas para subselects
  dbType: 'mysql' | 'sqlserver'; // Tipo do banco para subselects
  availableTables: Set<string>; // Tabelas disponíveis (FROM + JOINs)
  tableAliases: Map<string, string>; // Mapa de tableId -> alias
}

const WHERE_OPERATORS: WhereOperator[] = ['=', '!=', '<>', '>', '>=', '<', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN', 'NOT BETWEEN', 'EXISTS', 'NOT EXISTS'];
const LOGICAL_OPERATORS: WhereLogicalOperator[] = ['AND', 'OR'];

export default function WhereEditor({
  conditions,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  nodes,
  edges,
  dbType,
  availableTables,
  tableAliases,
}: WhereEditorProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSubqueryId, setEditingSubqueryId] = useState<string | null>(null);
  const [newCondition, setNewCondition] = useState<Partial<WhereCondition>>({
    tableId: '',
    column: '',
    operator: '=',
    value: '',
    logicalOperator: 'AND',
  });

  // Obter colunas disponíveis de uma tabela
  const getColumnsForTable = (tableId: string): string[] => {
    const node = nodes.find(n => n.id === tableId);
    return node?.columns?.map(c => c.name) || [];
  };

  // Obter alias de uma tabela
  const getTableAlias = (tableId: string): string => {
    return tableAliases.get(tableId) || (tableId.includes('.') ? tableId.split('.').pop()! : tableId);
  };

  const handleAdd = () => {
    // EXISTS e NOT EXISTS não precisam de coluna
    const needsColumn = !['EXISTS', 'NOT EXISTS'].includes(newCondition.operator || '');
    if (needsColumn && (!newCondition.tableId || !newCondition.column || !newCondition.operator)) return;
    if (!newCondition.operator) return;
    // Se é IN/EXISTS e não tem subquery nem value, não pode adicionar
    if (needsSubquery(newCondition.operator) && !newCondition.subquery && !newCondition.value) return;

    const condition: WhereCondition = {
      id: `where-${Date.now()}-${Math.random()}`,
      tableId: newCondition.tableId || '',
      column: newCondition.column || '',
      operator: newCondition.operator || '=',
      value: newCondition.value,
      subquery: newCondition.subquery,
      logicalOperator: newCondition.logicalOperator || 'AND',
      order: conditions.length,
    };

    onAdd(condition);
    setIsAdding(false);
    setNewCondition({
      tableId: '',
      column: '',
      operator: '=',
      value: '',
      logicalOperator: 'AND',
    });
  };

  const handleUpdate = (id: string, updates: Partial<WhereCondition>) => {
    onUpdate(id, updates);
    setEditingId(null);
  };

  const needsValue = (operator: WhereOperator): boolean => {
    return !['IS NULL', 'IS NOT NULL', 'EXISTS', 'NOT EXISTS'].includes(operator);
  };

  const needsSubquery = (operator: WhereOperator): boolean => {
    return ['IN', 'NOT IN', 'EXISTS', 'NOT EXISTS'].includes(operator);
  };

  const needsMultipleValues = (operator: WhereOperator): boolean => {
    return ['IN', 'NOT IN', 'BETWEEN', 'NOT BETWEEN'].includes(operator);
  };

  const formatValue = (value: string | number | string[] | number[] | undefined, operator: WhereOperator): string => {
    if (value === undefined || value === null) return '';
    
    if (needsMultipleValues(operator)) {
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    }
    
    return String(value);
  };

  const parseValue = (value: string, operator: WhereOperator): string | number | string[] | number[] => {
    if (needsMultipleValues(operator)) {
      return value.split(',').map(v => v.trim()).filter(v => v);
    }
    
    // Tentar converter para número se possível
    const numValue = Number(value);
    if (!isNaN(numValue) && value.trim() !== '') {
      return numValue;
    }
    
    return value;
  };

  const sortedConditions = [...conditions].sort((a, b) => a.order - b.order);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          WHERE ({conditions.length})
        </h3>
        <button
          onClick={() => setIsAdding(true)}
          className="p-1.5 text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
          title="Adicionar condição"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
        {sortedConditions.length === 0 && !isAdding ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">Nenhuma condição WHERE</p>
            <p className="text-xs mt-1">Clique no botão + para adicionar</p>
          </div>
        ) : (
          <>
            {sortedConditions.map((condition, index) => {
              const isEditing = editingId === condition.id;
              const tableName = condition.tableId.includes('.') 
                ? condition.tableId.split('.').pop() || condition.tableId
                : condition.tableId;
              const alias = getTableAlias(condition.tableId);
              const columns = getColumnsForTable(condition.tableId);

              return (
                <div
                  key={condition.id}
                  className="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700 p-2"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        {index > 0 && (
                          <select
                            value={condition.logicalOperator || 'AND'}
                            onChange={e => handleUpdate(condition.id, { logicalOperator: e.target.value as WhereLogicalOperator })}
                            className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            {LOGICAL_OPERATORS.map(op => (
                              <option key={op} value={op}>{op}</option>
                            ))}
                          </select>
                        )}
                        <select
                          value={condition.tableId}
                          onChange={e => {
                            const newTableId = e.target.value;
                            handleUpdate(condition.id, { 
                              tableId: newTableId,
                              column: '', // Resetar coluna ao mudar tabela
                            });
                          }}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="">Selecione tabela</option>
                          {Array.from(availableTables).map(tableId => {
                            const tableName = tableId.includes('.') 
                              ? tableId.split('.').pop() || tableId
                              : tableId;
                            return (
                              <option key={tableId} value={tableId}>
                                {tableName} AS {getTableAlias(tableId)}
                              </option>
                            );
                          })}
                        </select>
                        <select
                          value={condition.column}
                          onChange={e => handleUpdate(condition.id, { column: e.target.value })}
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          disabled={!condition.tableId}
                        >
                          <option value="">Selecione coluna</option>
                          {columns.map(col => (
                            <option key={col} value={col}>{col}</option>
                          ))}
                        </select>
                        <select
                          value={condition.operator}
                          onChange={e => handleUpdate(condition.id, { operator: e.target.value as WhereOperator })}
                          className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          {WHERE_OPERATORS.map(op => (
                            <option key={op} value={op}>{op}</option>
                          ))}
                        </select>
                      </div>
                      {needsValue(condition.operator) && !needsSubquery(condition.operator) && (
                        <input
                          type="text"
                          value={formatValue(condition.value, condition.operator)}
                          onChange={e => {
                            const parsed = parseValue(e.target.value, condition.operator);
                            handleUpdate(condition.id, { value: parsed });
                          }}
                          placeholder={needsMultipleValues(condition.operator) ? 'valor1, valor2, ...' : 'valor'}
                          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                        />
                      )}
                      {needsSubquery(condition.operator) && (
                        <div className="flex items-center gap-2">
                          {condition.subquery ? (
                            <div className="flex-1 px-2 py-1 text-xs border border-green-300 dark:border-green-700 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-mono">
                              Subselect configurado
                            </div>
                          ) : (
                            <div className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                              Nenhum subselect configurado
                            </div>
                          )}
                          <button
                            onClick={() => setEditingSubqueryId(condition.id)}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                          >
                            <Database className="h-3 w-3" />
                            {condition.subquery ? 'Editar' : 'Criar'} Subselect
                          </button>
                        </div>
                      )}
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      {index > 0 && (
                        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 px-1">
                          {condition.logicalOperator || 'AND'}
                        </span>
                      )}
                      <span className="font-mono text-xs text-gray-900 dark:text-white flex-1">
                        {condition.operator === 'EXISTS' || condition.operator === 'NOT EXISTS' 
                          ? `${condition.operator} (subselect)`
                          : `${alias}.${condition.column} ${condition.operator} ${condition.subquery ? '(subselect)' : needsValue(condition.operator) ? formatValue(condition.value, condition.operator) : ''}`
                        }
                      </span>
                      <button
                        onClick={() => setEditingId(condition.id)}
                        className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                        title="Editar"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                      <button
                        onClick={() => onRemove(condition.id)}
                        className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                        title="Remover"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {isAdding && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800 p-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={newCondition.logicalOperator || 'AND'}
                      onChange={e => setNewCondition({ ...newCondition, logicalOperator: e.target.value as WhereLogicalOperator })}
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {LOGICAL_OPERATORS.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                    <select
                      value={newCondition.tableId || ''}
                      onChange={e => setNewCondition({ ...newCondition, tableId: e.target.value, column: '' })}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Selecione tabela</option>
                      {Array.from(availableTables).map(tableId => {
                        const tableName = tableId.includes('.') 
                          ? tableId.split('.').pop() || tableId
                          : tableId;
                        return (
                          <option key={tableId} value={tableId}>
                            {tableName} AS {getTableAlias(tableId)}
                          </option>
                        );
                      })}
                    </select>
                    <select
                      value={newCondition.column || ''}
                      onChange={e => setNewCondition({ ...newCondition, column: e.target.value })}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      disabled={!newCondition.tableId}
                    >
                      <option value="">Selecione coluna</option>
                      {newCondition.tableId && getColumnsForTable(newCondition.tableId).map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                    <select
                      value={newCondition.operator || '='}
                      onChange={e => setNewCondition({ ...newCondition, operator: e.target.value as WhereOperator })}
                      className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {WHERE_OPERATORS.map(op => (
                        <option key={op} value={op}>{op}</option>
                      ))}
                    </select>
                  </div>
                  {needsValue(newCondition.operator || '=') && !needsSubquery(newCondition.operator || '=') && (
                    <input
                      type="text"
                      value={formatValue(newCondition.value, newCondition.operator || '=')}
                      onChange={e => {
                        const parsed = parseValue(e.target.value, newCondition.operator || '=');
                        setNewCondition({ ...newCondition, value: parsed });
                      }}
                      placeholder={needsMultipleValues(newCondition.operator || '=') ? 'valor1, valor2, ...' : 'valor'}
                      className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono"
                    />
                  )}
                  {needsSubquery(newCondition.operator || '=') && (
                    <div className="flex items-center gap-2">
                      {newCondition.subquery ? (
                        <div className="flex-1 px-2 py-1 text-xs border border-green-300 dark:border-green-700 rounded bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 font-mono">
                          Subselect configurado
                        </div>
                      ) : (
                        <div className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          Nenhum subselect configurado
                        </div>
                      )}
                      <button
                        onClick={() => setEditingSubqueryId('new')}
                        className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                      >
                        <Database className="h-3 w-3" />
                        {newCondition.subquery ? 'Editar' : 'Criar'} Subselect
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2 justify-end">
                    <button
                      onClick={() => {
                        setIsAdding(false);
                        setNewCondition({
                          tableId: '',
                          column: '',
                          operator: '=',
                          value: '',
                          logicalOperator: 'AND',
                        });
                      }}
                      className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleAdd}
                      disabled={!newCondition.tableId || !newCondition.column || !newCondition.operator}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Adicionar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Subquery Builder Dialog */}
      {editingSubqueryId && (
        <SubqueryBuilder
          initialAST={
            editingSubqueryId === 'new'
              ? newCondition.subquery || null
              : conditions.find(c => c.id === editingSubqueryId)?.subquery || null
          }
          onSave={(subqueryAST) => {
            if (editingSubqueryId === 'new') {
              setNewCondition({ ...newCondition, subquery: subqueryAST });
            } else {
              handleUpdate(editingSubqueryId, { subquery: subqueryAST });
            }
            setEditingSubqueryId(null);
          }}
          onCancel={() => setEditingSubqueryId(null)}
          nodes={nodes}
          edges={edges}
          dbType={dbType}
          title={
            editingSubqueryId === 'new'
              ? 'Criar Subselect'
              : 'Editar Subselect'
          }
        />
      )}
    </div>
  );
}

