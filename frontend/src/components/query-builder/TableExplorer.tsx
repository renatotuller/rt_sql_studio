/**
 * Componente de exploração de tabelas (catálogo)
 * Permite visualizar e arrastar colunas para o Query Builder
 */

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Table2, Eye, Search, GripVertical, Key, Link2 } from 'lucide-react';
import type { GraphNode, Column } from '../../api/client';

interface TableExplorerProps {
  nodes: GraphNode[];
  expandedTables: Set<string>;
  onToggleExpand: (tableId: string) => void;
  onColumnDragStart: (tableId: string, column: Column) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  includedTables?: Set<string>;
  baseTableId?: string;
}

export default function TableExplorer({
  nodes,
  expandedTables,
  onToggleExpand,
  onColumnDragStart,
  searchTerm,
  onSearchChange,
  includedTables = new Set(),
  baseTableId,
}: TableExplorerProps) {
  // Filtrar e ordenar nós
  const filteredNodes = useMemo(() => {
    let filtered = nodes;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = nodes.filter(node => 
        node.label.toLowerCase().includes(term) ||
        node.columns?.some(col => col.name.toLowerCase().includes(term))
      );
    }
    
    // Ordenar: tabelas incluídas primeiro, depois por nome
    return [...filtered].sort((a, b) => {
      const aIncluded = includedTables.has(a.id) || a.id === baseTableId;
      const bIncluded = includedTables.has(b.id) || b.id === baseTableId;
      
      if (aIncluded && !bIncluded) return -1;
      if (!aIncluded && bIncluded) return 1;
      
      return a.label.localeCompare(b.label);
    });
  }, [nodes, searchTerm, includedTables, baseTableId]);

  const handleDragStart = (e: React.DragEvent, tableId: string, column: Column) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'column',
      tableId,
      column: {
        name: column.name,
        type: column.type,
        isPrimaryKey: column.isPrimaryKey,
        isForeignKey: column.isForeignKey,
      },
    }));
    e.dataTransfer.effectAllowed = 'copy';
    onColumnDragStart(tableId, column);
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header com busca */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar tabelas ou colunas..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Lista de tabelas */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {filteredNodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <p className="text-sm">Nenhuma tabela encontrada</p>
          </div>
        ) : (
          filteredNodes.map(node => {
            const isExpanded = expandedTables.has(node.id);
            const isIncluded = includedTables.has(node.id) || node.id === baseTableId;
            const isView = node.type === 'view';

            return (
              <div key={node.id} className="select-none">
                {/* Header da tabela */}
                <div
                  className={`
                    flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer
                    transition-colors
                    ${isIncluded 
                      ? 'bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40' 
                      : 'hover:bg-gray-100 dark:hover:bg-gray-800'
                    }
                  `}
                  onClick={() => onToggleExpand(node.id)}
                >
                  <span className="text-gray-400">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </span>
                  
                  {isView ? (
                    <Eye className={`h-4 w-4 ${isIncluded ? 'text-blue-600' : 'text-amber-500'}`} />
                  ) : (
                    <Table2 className={`h-4 w-4 ${isIncluded ? 'text-blue-600' : 'text-gray-500'}`} />
                  )}
                  
                  <span className={`
                    text-sm font-medium truncate flex-1
                    ${isIncluded ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'}
                  `}>
                    {node.label}
                  </span>
                  
                  <span className="text-xs text-gray-400">
                    {node.columns?.length || 0}
                  </span>
                </div>

                {/* Lista de colunas (quando expandido) */}
                {isExpanded && node.columns && (
                  <div className="ml-6 mt-1 space-y-0.5">
                    {node.columns.map(column => (
                      <div
                        key={column.name}
                        draggable
                        onDragStart={(e) => handleDragStart(e, node.id, column)}
                        className={`
                          flex items-center gap-2 px-2 py-1 rounded text-sm
                          cursor-grab active:cursor-grabbing
                          hover:bg-gray-100 dark:hover:bg-gray-800
                          transition-colors group
                        `}
                      >
                        <GripVertical className="h-3 w-3 text-gray-300 group-hover:text-gray-400" />
                        
                        {column.isPrimaryKey && (
                          <Key className="h-3 w-3 text-amber-500 flex-shrink-0" title="Primary Key" />
                        )}
                        {column.isForeignKey && !column.isPrimaryKey && (
                          <Link2 className="h-3 w-3 text-blue-500 flex-shrink-0" title="Foreign Key" />
                        )}
                        
                        <span className="text-gray-900 dark:text-gray-100 truncate flex-1">
                          {column.name}
                        </span>
                        
                        <span className="text-xs text-gray-400 truncate max-w-[80px]" title={column.type}>
                          {column.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
