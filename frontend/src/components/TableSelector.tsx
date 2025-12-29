import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { Node } from 'reactflow';

interface TableSelectorProps {
  nodes: Node[];
  onSelectTable: (tableId: string | null) => void;
  selectedTableId: string | null;
  isOpen: boolean;
  onToggle: () => void;
}

export default function TableSelector({
  nodes,
  onSelectTable,
  selectedTableId,
  isOpen,
  onToggle,
}: TableSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredNodes = useMemo(() => {
    if (!searchTerm.trim()) {
      return nodes;
    }
    const term = searchTerm.toLowerCase();
    return nodes.filter((node) =>
      node.data?.label?.toLowerCase().includes(term) ||
      node.id.toLowerCase().includes(term)
    );
  }, [nodes, searchTerm]);

  const sortedNodes = useMemo(() => {
    return [...filteredNodes].sort((a, b) => {
      const labelA = a.data?.label || a.id;
      const labelB = b.data?.label || b.id;
      return labelA.localeCompare(labelB);
    });
  }, [filteredNodes]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute left-4 top-24 bottom-4 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-40 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Selecionar Tabela
          </h3>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Fechar"
          >
            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar tabela..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {sortedNodes.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Nenhuma tabela encontrada' : 'Nenhuma tabela disponível'}
          </div>
        ) : (
          <div className="p-2">
            {sortedNodes.map((node) => {
              const label = node.data?.label || node.id;
              const isSelected = selectedTableId === node.id;
              const isView = node.data?.type === 'view';

              return (
                <button
                  key={node.id}
                  onClick={() => onSelectTable(isSelected ? null : node.id)}
                  className={`w-full text-left px-3 py-2 rounded-md mb-1 transition-colors text-sm ${
                    isSelected
                      ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100 font-medium'
                      : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isView && <span className="text-xs">👁️</span>}
                    <span className="truncate">{label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {selectedTableId && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            onClick={() => onSelectTable(null)}
            className="w-full btn btn-secondary text-sm py-2"
          >
            Limpar Seleção
          </button>
        </div>
      )}
    </div>
  );
}








