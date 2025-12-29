/**
 * Dialog para exibir histórico de queries
 */

import { useState } from 'react';
import { X, Clock, Trash2, Copy, Check, Play } from 'lucide-react';
import type { QueryAST } from '../../types/query-builder';

interface QueryHistoryItem {
  id: string;
  sql: string;
  ast: QueryAST;
  timestamp: Date;
  name?: string;
}

interface QueryHistoryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  history: QueryHistoryItem[];
  onLoad: (ast: QueryAST) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export default function QueryHistoryDialog({
  isOpen,
  onClose,
  history,
  onLoad,
  onDelete,
  onClearAll,
}: QueryHistoryDialogProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = async (sql: string, id: string) => {
    await navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes}m atrás`;
    if (hours < 24) return `${hours}h atrás`;
    if (days < 7) return `${days}d atrás`;
    
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Dialog */}
      <div className="relative w-full max-w-2xl max-h-[80vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Histórico de Queries
            </h2>
            <span className="text-sm text-gray-500">({history.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 
                         hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                Limpar tudo
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {history.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma query no histórico</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800">
                    <span className="text-xs text-gray-500">
                      {formatDate(item.timestamp)}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopy(item.sql, item.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                                 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Copiar SQL"
                      >
                        {copiedId === item.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onLoad(item.ast)}
                        className="p-1.5 text-blue-500 hover:text-blue-600 
                                 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Carregar query"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 
                                 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <pre className="p-3 text-xs font-mono text-gray-700 dark:text-gray-300 
                                overflow-x-auto whitespace-pre-wrap">
                    {item.sql}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

