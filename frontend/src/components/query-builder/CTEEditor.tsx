/**
 * Componente para gerenciar CTEs (Common Table Expressions)
 */

import { useState, useEffect } from 'react';
import { Plus, X, Edit2, Trash2, Code, ChevronDown, ChevronRight } from 'lucide-react';
import type { CTEDefinition, QueryAST } from '../../types/query-builder';
import type { GraphNode, GraphEdge } from '../../api/client';
import SubqueryBuilder from './SubqueryBuilder';

interface CTEEditorProps {
  ctes: CTEDefinition[];
  onAdd: (cte: CTEDefinition) => void;
  onUpdate: (index: number, cte: CTEDefinition) => void;
  onRemove: (index: number) => void;
  nodes: GraphNode[];
  edges: GraphEdge[];
  dbType?: 'mysql' | 'sqlserver';
}

export default function CTEEditor({
  ctes,
  onAdd,
  onUpdate,
  onRemove,
  nodes,
  edges,
  dbType = 'mysql',
}: CTEEditorProps) {
  const [expandedCTEs, setExpandedCTEs] = useState<Set<number>>(new Set((ctes || []).map((_, i) => i)));
  const [editingCTEIndex, setEditingCTEIndex] = useState<number | null>(null);
  const [showAddCTE, setShowAddCTE] = useState(false);
  const [newCTEName, setNewCTEName] = useState('');
  const [newCTEColumns, setNewCTEColumns] = useState<string>('');

  // Atualizar expandedCTEs quando ctes mudar
  useEffect(() => {
    setExpandedCTEs(new Set((ctes || []).map((_, i) => i)));
  }, [ctes]);

  const toggleCTE = (index: number) => {
    setExpandedCTEs(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddCTE = (queryAST: QueryAST) => {
    if (!newCTEName.trim()) {
      alert('O nome do CTE é obrigatório');
      return;
    }

    const columns = newCTEColumns
      .split(',')
      .map(col => col.trim())
      .filter(col => col.length > 0);

    const newCTE: CTEDefinition = {
      name: newCTEName.trim(),
      query: queryAST,
      columns: columns.length > 0 ? columns : undefined,
    };

    onAdd(newCTE);
    setShowAddCTE(false);
    setNewCTEName('');
    setNewCTEColumns('');
  };

  const handleUpdateCTE = (index: number, queryAST: QueryAST) => {
    const existingCTE = ctes[index];
    const newCTE: CTEDefinition = {
      ...existingCTE,
      query: queryAST,
    };
    onUpdate(index, newCTE);
    setEditingCTEIndex(null);
  };

  if ((!ctes || ctes.length === 0) && !showAddCTE) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            CTEs (0)
          </h3>
          <button
            onClick={() => setShowAddCTE(true)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            title="Adicionar CTE"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar CTE
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <p className="text-sm font-medium mb-2">Nenhum CTE adicionado</p>
            <p className="text-xs">CTEs (Common Table Expressions) permitem definir consultas temporárias reutilizáveis</p>
            <p className="text-xs mt-2">Clique em "Adicionar CTE" para criar um</p>
          </div>
        </div>

        {showAddCTE && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do CTE <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newCTEName}
                  onChange={e => setNewCTEName(e.target.value)}
                  placeholder="ex: vendas_por_mes"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Colunas (opcional, separadas por vírgula)
                </label>
                <input
                  type="text"
                  value={newCTEColumns}
                  onChange={e => setNewCTEColumns(e.target.value)}
                  placeholder="ex: mes, total_vendas, quantidade"
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Defina nomes de colunas explícitos para o CTE (opcional)
                </p>
              </div>
            </div>
            <SubqueryBuilder
              initialAST={null}
              onSave={handleAddCTE}
              onCancel={() => {
                setShowAddCTE(false);
                setNewCTEName('');
                setNewCTEColumns('');
              }}
              nodes={nodes}
              edges={edges}
              dbType={dbType}
              title="Query do CTE"
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          CTEs ({(ctes || []).length})
        </h3>
        <button
          onClick={() => setShowAddCTE(true)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5"
          title="Adicionar CTE"
        >
          <Plus className="h-3.5 w-3.5" />
          Adicionar CTE
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {(ctes || []).map((cte, index) => {
          const isExpanded = expandedCTEs.has(index);
          const isEditing = editingCTEIndex === index;

          return (
            <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
              <div className={`flex items-center justify-between ${isExpanded ? 'p-3' : 'px-3 py-2'}`}>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => toggleCTE(index)}
                    className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                    title={isExpanded ? 'Contrair' : 'Expandir'}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500" />
                    )}
                  </button>
                  <Code className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  <span className="font-mono text-xs font-medium truncate">
                    {cte.name}
                    {cte.columns && cte.columns.length > 0 && (
                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                        ({cte.columns.join(', ')})
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingCTEIndex(index);
                    }}
                    className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                    title="Editar"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(index);
                    }}
                    className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                    title="Remover"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {isExpanded && !isEditing && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-200 dark:border-gray-700">
                  <div className="mt-2 text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded">
                    {cte.columns && cte.columns.length > 0
                      ? `WITH ${cte.name} (${cte.columns.join(', ')}) AS (SELECT ...)`
                      : `WITH ${cte.name} AS (SELECT ...)`
                    }
                  </div>
                </div>
              )}

              {isEditing && (
                <div className="px-3 pb-3 pt-0 border-t border-gray-200 dark:border-gray-700">
                  <SubqueryBuilder
                    initialAST={cte.query}
                    onSave={(queryAST) => handleUpdateCTE(index, queryAST)}
                    onCancel={() => setEditingCTEIndex(null)}
                    nodes={nodes}
                    edges={edges}
                    dbType={dbType}
                    title={`Editar CTE: ${cte.name}`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showAddCTE && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="space-y-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nome do CTE <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newCTEName}
                onChange={e => setNewCTEName(e.target.value)}
                placeholder="ex: vendas_por_mes"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Colunas (opcional, separadas por vírgula)
              </label>
              <input
                type="text"
                value={newCTEColumns}
                onChange={e => setNewCTEColumns(e.target.value)}
                placeholder="ex: mes, total_vendas, quantidade"
                className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Defina nomes de colunas explícitos para o CTE (opcional)
              </p>
            </div>
          </div>
          <SubqueryBuilder
            initialAST={null}
            onSave={handleAddCTE}
            onCancel={() => {
              setShowAddCTE(false);
              setNewCTEName('');
              setNewCTEColumns('');
            }}
            nodes={nodes}
            edges={edges}
            dbType={dbType}
            title="Query do CTE"
          />
        </div>
      )}
    </div>
  );
}

