/**
 * Dialog para gerenciar queries salvas
 */

import { useState } from 'react';
import { X, Save, Trash2, Copy, Check, Play, FolderOpen, Plus } from 'lucide-react';
import type { QueryAST } from '../../types/query-builder';

interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  sql: string;
  ast: QueryAST;
  createdAt: Date;
  updatedAt: Date;
}

interface SavedQueriesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  savedQueries: SavedQuery[];
  currentSQL: string;
  currentAST: QueryAST;
  onLoad: (ast: QueryAST) => void;
  onSave: (name: string, description?: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, name: string, description?: string) => void;
}

export default function SavedQueriesDialog({
  isOpen,
  onClose,
  savedQueries,
  currentSQL,
  currentAST,
  onLoad,
  onSave,
  onDelete,
  onUpdate,
}: SavedQueriesDialogProps) {
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSave(saveName.trim(), saveDescription.trim() || undefined);
    setSaveName('');
    setSaveDescription('');
    setShowSaveForm(false);
  };

  const handleCopy = async (sql: string, id: string) => {
    await navigator.clipboard.writeText(sql);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Dialog */}
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-gray-900 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Queries Salvas
            </h2>
            <span className="text-sm text-gray-500">({savedQueries.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {currentSQL && (
              <button
                onClick={() => setShowSaveForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                         text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                <Plus className="h-4 w-4" />
                Salvar Query Atual
              </button>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
        
        {/* Save Form */}
        {showSaveForm && (
          <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome da Query *
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Ex: Clientes ativos com pedidos"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descrição (opcional)
                </label>
                <textarea
                  value={saveDescription}
                  onChange={(e) => setSaveDescription(e.target.value)}
                  placeholder="Descreva o propósito desta query..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                           bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                           focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowSaveForm(false)}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 
                           hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                           text-white bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400
                           rounded-lg transition-colors"
                >
                  <Save className="h-4 w-4" />
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {savedQueries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="mb-2">Nenhuma query salva</p>
              <p className="text-sm">Salve suas queries frequentes para reutilizá-las depois</p>
            </div>
          ) : (
            <div className="space-y-3">
              {savedQueries.map((query) => (
                <div
                  key={query.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {query.name}
                      </h3>
                      {query.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{query.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-gray-400 mr-2">
                        {formatDate(query.updatedAt)}
                      </span>
                      <button
                        onClick={() => handleCopy(query.sql, query.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 
                                 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        title="Copiar SQL"
                      >
                        {copiedId === query.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => onLoad(query.ast)}
                        className="p-1.5 text-blue-500 hover:text-blue-600 
                                 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="Carregar query"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => onDelete(query.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 
                                 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Remover"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <pre className="p-3 text-xs font-mono text-gray-700 dark:text-gray-300 
                                overflow-x-auto whitespace-pre-wrap max-h-32">
                    {query.sql}
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

