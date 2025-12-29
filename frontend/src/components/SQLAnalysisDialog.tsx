import { useState, useEffect } from 'react';
import { X, FileText } from 'lucide-react';

interface SQLAnalysisDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAnalyze: (sqlQuery: string) => void;
  sqlQuery: string;
  setSqlQuery: (query: string) => void;
  analysisResult?: {
    tables: string[];
    joins: Array<{ from: string; to: string; condition?: string }>;
  } | null;
  highlightedTablesCount: number;
  filterMode: boolean;
}

export default function SQLAnalysisDialog({
  isOpen,
  onClose,
  onAnalyze,
  sqlQuery,
  setSqlQuery,
  analysisResult,
  highlightedTablesCount,
  filterMode,
}: SQLAnalysisDialogProps) {
  const [localQuery, setLocalQuery] = useState(sqlQuery);

  // Sincronizar query local com prop
  useEffect(() => {
    setLocalQuery(sqlQuery);
  }, [sqlQuery, isOpen]);

  // Fechar com ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevenir scroll do body quando modal está aberto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAnalyze = () => {
    if (!localQuery.trim()) {
      return; // Não fazer nada se estiver vazio (botão já está desabilitado)
    }
    setSqlQuery(localQuery);
    onAnalyze(localQuery);
    onClose(); // Fechar após análise
  };

  const handleClose = () => {
    setLocalQuery(sqlQuery); // Restaurar query original
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={handleClose}
    >
      {/* Overlay com backdrop blur */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Dialog */}
      <div
        className="relative bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Analisar Query SQL
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cole sua query SQL para destacar tabelas e relacionamentos no grafo
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Fechar (ESC)"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Query SQL
            </label>
            <textarea
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              placeholder="Exemplo:&#10;SELECT * FROM Users u&#10;INNER JOIN Orders o ON u.id = o.user_id&#10;WHERE u.active = 1&#10;&#10;Suporta CTEs (WITH ... AS ...), múltiplos JOINs, etc."
              className="w-full input min-h-[300px] font-mono text-sm resize-none"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleAnalyze();
                }
              }}
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Dica: Pressione <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Ctrl+Enter</kbd> ou <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">Cmd+Enter</kbd> para analisar
            </p>
          </div>

          {/* Resultado da análise anterior (se houver) */}
          {analysisResult && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                  Última Análise:
                </span>
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {analysisResult.tables.length} {analysisResult.tables.length === 1 ? 'tabela encontrada' : 'tabelas encontradas'}
                  {analysisResult.joins.length > 0 && ` • ${analysisResult.joins.length} ${analysisResult.joins.length === 1 ? 'relacionamento' : 'relacionamentos'}`}
                </span>
              </div>
              {analysisResult.tables.length > 0 && (
                <div className="text-xs text-blue-800 dark:text-blue-300 mt-2">
                  <strong>Tabelas:</strong> {analysisResult.tables.join(', ')}
                </div>
              )}
              {highlightedTablesCount === 0 && analysisResult.tables.length > 0 && (
                <div className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                  ⚠️ Nenhuma tabela correspondente encontrada no schema. Verifique os nomes das tabelas.
                </div>
              )}
              {filterMode && (
                <div className="mt-2 text-xs text-green-700 dark:text-green-300">
                  ✓ Modo filtro ativo: mostrando apenas {highlightedTablesCount} {highlightedTablesCount === 1 ? 'tabela' : 'tabelas'} da consulta
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {localQuery.trim().length > 0 ? (
              <span>{localQuery.split('\n').length} linhas</span>
            ) : (
              <span>Cole ou digite sua query SQL acima</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="btn btn-secondary"
            >
              Cancelar
            </button>
            <button
              onClick={handleAnalyze}
              disabled={!localQuery.trim()}
              className="btn btn-primary"
            >
              Analisar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

