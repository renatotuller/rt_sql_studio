/**
 * Modal para escolher entre múltiplos relacionamentos diretos
 */

import { useState } from 'react';
import { X, Database, ArrowRight, Check } from 'lucide-react';
import type { JoinOption } from '../../types/query-builder';

interface JoinRelationshipSelectorProps {
  isOpen: boolean;
  sourceTable: string;
  targetTable: string;
  options: JoinOption[];
  onSelect: (options: JoinOption[]) => void;
  onCancel: () => void;
}

export default function JoinRelationshipSelector({
  isOpen,
  sourceTable,
  targetTable,
  options,
  onSelect,
  onCancel,
}: JoinRelationshipSelectorProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());

  if (!isOpen || options.length === 0) return null;

  const sourceTableName = sourceTable.includes('.') 
    ? sourceTable.split('.').pop() || sourceTable
    : sourceTable;
  const targetTableName = targetTable.includes('.') 
    ? targetTable.split('.').pop() || targetTable
    : targetTable;

  const toggleOption = (index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selectedOptions = Array.from(selectedIndices)
      .sort((a, b) => a - b)
      .map(index => options[index]);
    
    if (selectedOptions.length > 0) {
      onSelect(selectedOptions);
      setSelectedIndices(new Set());
    }
  };

  const handleCancel = () => {
    setSelectedIndices(new Set());
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Escolher Relacionamentos
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Múltiplos relacionamentos encontrados entre <span className="font-mono font-medium">{sourceTableName}</span> e <span className="font-mono font-medium">{targetTableName}</span>
              <br />
              <span className="text-xs">Selecione um ou mais relacionamentos para criar múltiplos JOINs</span>
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Fechar"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Options List */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-2">
            {options.map((option, index) => {
              const edge = option.path.edges[0]; // Primeira aresta (relacionamento direto)
              // A direção já está normalizada no path (sempre sourceTable → targetTable)
              const fromColumn = edge.fromColumn;
              const toColumn = edge.toColumn;

              const isSelected = selectedIndices.has(index);

              return (
                <button
                  key={index}
                  onClick={() => toggleOption(index)}
                  className={`w-full p-4 border rounded-lg transition-all text-left group ${
                    isSelected
                      ? 'border-blue-500 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                      : 'border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 p-2 rounded flex items-center justify-center ${
                      isSelected
                        ? 'bg-blue-500 dark:bg-blue-400'
                        : 'bg-blue-100 dark:bg-blue-900/30'
                    }`}>
                      {isSelected ? (
                        <Check className="h-4 w-4 text-white" />
                      ) : (
                        <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          Opção {index + 1}
                        </span>
                        {option.directRelationships > 0 && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded">
                            Relacionamento Direto
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 font-mono space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 dark:text-gray-400">{sourceTableName}</span>
                          <span className="text-gray-400">.</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{fromColumn}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <ArrowRight className="h-3 w-3" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600 dark:text-gray-400">{targetTableName}</span>
                          <span className="text-gray-400">.</span>
                          <span className="font-semibold text-blue-600 dark:text-blue-400">{toColumn}</span>
                        </div>
                      </div>
                      {option.description && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                          {option.description}
                        </p>
                      )}
                    </div>
                    <div className="text-blue-600 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowRight className="h-5 w-5" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedIndices.size > 0 ? (
              <span>{selectedIndices.size} relacionamento(s) selecionado(s)</span>
            ) : (
              <span>Selecione pelo menos um relacionamento</span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIndices.size === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded transition-colors"
            >
              Confirmar ({selectedIndices.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

