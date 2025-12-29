import { X, ArrowRight, Database, Key } from 'lucide-react';

interface RelationshipDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  relationship: {
    id: string;
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
    label?: string;
    type?: string;
  } | null;
}

export default function RelationshipDetailsDialog({
  isOpen,
  onClose,
  relationship,
}: RelationshipDetailsDialogProps) {
  if (!isOpen || !relationship) return null;

  // Extrair schema se houver
  const fromParts = relationship.fromTable.split('.');
  const fromSchema = fromParts.length > 1 ? fromParts[0] : undefined;
  const fromTableName = fromParts.length > 1 ? fromParts[1] : fromParts[0];
  
  const toParts = relationship.toTable.split('.');
  const toSchema = toParts.length > 1 ? toParts[0] : undefined;
  const toTableName = toParts.length > 1 ? toParts[1] : toParts[0];

  // Determinar tipo de relacionamento
  const getRelationshipType = () => {
    if (relationship.type) {
      if (relationship.type.includes('view')) return 'Relacionamento de View';
      if (relationship.type.includes('join')) return 'Relacionamento de JOIN';
      return 'Relacionamento de View';
    }
    if (relationship.id.startsWith('fk_')) return 'Foreign Key';
    if (relationship.id.startsWith('view_')) return 'Relacionamento de View';
    return 'Relacionamento';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Key className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Detalhes do Relacionamento
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {getRelationshipType()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Tabela Origem */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Tabela/View Origem
              </h3>
            </div>
            <div className="space-y-2">
              {fromSchema && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-20">
                    Schema:
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {fromSchema}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-20">
                  Tabela:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {fromTableName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-20">
                  Coluna:
                </span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {relationship.fromColumn}
                </span>
              </div>
            </div>
          </div>

          {/* Seta */}
          <div className="flex items-center justify-center">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
              <ArrowRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>

          {/* Tabela Destino */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              <h3 className="font-semibold text-gray-900 dark:text-white">
                Tabela/View Destino
              </h3>
            </div>
            <div className="space-y-2">
              {toSchema && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500 dark:text-gray-400 w-20">
                    Schema:
                  </span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {toSchema}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-20">
                  Tabela:
                </span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {toTableName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 w-20">
                  Coluna:
                </span>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                  {relationship.toColumn}
                </span>
              </div>
            </div>
          </div>

          {/* Informações Adicionais */}
          {relationship.label && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-2 mb-2">
                <Key className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h3 className="font-semibold text-blue-900 dark:text-blue-200">
                  Nome da Constraint
                </h3>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-300 font-mono">
                {relationship.label}
              </p>
            </div>
          )}

          {/* ID do Relacionamento */}
          <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">
                ID do Relacionamento:
              </span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-mono break-all">
              {relationship.id}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="btn btn-primary"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}








