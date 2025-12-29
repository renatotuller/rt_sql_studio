import { memo } from 'react';
import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Key } from 'lucide-react';

export interface Column {
  name: string;
  type: string;
  nullable: boolean;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  defaultValue?: string;
  comment?: string;
}

interface DatabaseSchemaNodeData {
  label: string;
  schema?: string;
  columns: Column[];
  primaryKeys: string[];
  type: 'table' | 'view';
  zoomLevel?: number;
  simplified?: boolean; // Modo simplificado: mostrar apenas nome
  semanticZoomEnabled?: boolean; // Controla se o zoom semântico está ativo
}

const schemaColors: Record<string, string> = {
  'dbo': '#3b82f6',
  'public': '#10b981',
  'auth': '#f59e0b',
  'app': '#8b5cf6',
  'default': '#6b7280',
};

function DatabaseSchemaNode({ data, selected }: NodeProps<DatabaseSchemaNodeData>) {
  const { label, schema, columns, primaryKeys, type, zoomLevel = 1, simplified = false, semanticZoomEnabled = true } = data;
  const isView = type === 'view';
  const schemaColor = schema ? (schemaColors[schema.toLowerCase()] || schemaColors.default) : schemaColors.default;
  
  // Zoom Semântico com 3 níveis (se habilitado):
  // Nível 1 (zoom < 0.3): Apenas nome da tabela
  // Nível 2 (0.3 <= zoom < 0.7): Nome + chaves primárias + colunas principais
  // Nível 3 (zoom >= 0.7): Detalhes completos (tipos, descrições, etc)
  // Se semanticZoomEnabled = false, sempre mostrar detalhes completos
  const effectiveZoomLevel = semanticZoomEnabled ? zoomLevel : 1.0;
  const semanticZoomLevel = simplified ? 0 : effectiveZoomLevel;
  const showFullDetails = semanticZoomLevel >= 0.7;
  const showMediumDetails = semanticZoomLevel >= 0.3;
  const showDetails = !simplified && showMediumDetails;

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg border-2 transition-all ${
        selected 
          ? 'border-red-500 shadow-red-500/50 shadow-xl scale-105' 
          : 'border-gray-300 dark:border-gray-600'
      }`}
      style={{ 
        minWidth: showDetails ? '280px' : '150px',
        backgroundColor: selected ? 'rgba(239, 68, 68, 0.1)' : undefined,
        transition: 'opacity 0.5s ease-in-out, transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
        transform: selected ? 'scale(1.02)' : 'scale(1)',
        boxShadow: selected ? '0 10px 25px rgba(239, 68, 68, 0.3)' : undefined,
      }}
    >
      {/* Cabeçalho da Tabela */}
      <div
        className="px-4 py-2 rounded-t-lg text-white font-semibold text-sm flex items-center justify-between"
        style={{ backgroundColor: schemaColor }}
      >
        <div className="flex items-center gap-2">
          {isView && <span className="text-xs">👁️</span>}
          <span>{label}</span>
        </div>
        {schema && showDetails && (
          <span className="text-xs opacity-80">{schema}</span>
        )}
      </div>

      {/* Handles genéricos (fallback para conexões sem coluna específica) - sempre presentes */}
      <Handle
        type="source"
        position={Position.Left}
        id="default-source"
        style={{
          top: '50%',
          left: -8,
          width: 8,
          height: 8,
          background: 'transparent',
          border: 'none',
          opacity: 0,
          pointerEvents: 'all',
        }}
      />
      <Handle
        type="target"
        position={Position.Right}
        id="default-target"
        style={{
          top: '50%',
          right: -8,
          width: 8,
          height: 8,
          background: 'transparent',
          border: 'none',
          opacity: 0,
          pointerEvents: 'all',
        }}
      />
      
      {/* Handles específicos por coluna (sempre presentes, visíveis apenas quando showDetails) */}
      {columns.map((column, index) => {
        // No modo detalhado, calcular posição baseada no índice
        // No modo simplificado, usar 50% (centro)
        // Ajustar para alinhar perfeitamente com o centro vertical de cada linha
        const headerHeight = 40; // Altura do cabeçalho
        const rowHeight = 32; // Altura de cada linha (ajustado para corresponder ao padding py-2)
        const rowPadding = 8; // py-2 = 8px (4px top + 4px bottom)
        const handleTop = showDetails 
          ? `${headerHeight + (index * rowHeight) + (rowHeight / 2)}px`
          : '50%';

        return (
          <React.Fragment key={column.name}>
            <Handle
              type="source"
              position={Position.Left}
              id={`${column.name}-source`}
              style={{
                top: handleTop,
                left: -8,
                width: 8,
                height: 8,
                background: showDetails ? '#6366f1' : 'transparent',
                border: showDetails ? '2px solid white' : 'none',
                opacity: showDetails ? 1 : 0,
                pointerEvents: 'all',
                transform: 'translateY(-50%)', // Centralizar verticalmente
              }}
            />
            <Handle
              type="target"
              position={Position.Right}
              id={`${column.name}-target`}
              style={{
                top: handleTop,
                right: -8,
                width: 8,
                height: 8,
                background: showDetails ? '#6366f1' : 'transparent',
                border: showDetails ? '2px solid white' : 'none',
                opacity: showDetails ? 1 : 0,
                pointerEvents: 'all',
                transform: 'translateY(-50%)', // Centralizar verticalmente
              }}
            />
          </React.Fragment>
        );
      })}

      {/* Corpo da Tabela - Zoom Semântico com 3 níveis */}
      {!showMediumDetails ? (
        // Nível 1: Apenas nome da tabela
        <div className="px-4 py-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </div>
      ) : showFullDetails ? (
        // Nível 3: Detalhes completos (tipos, descrições, etc)
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {columns.map((column, index) => {
            const isPK = primaryKeys.includes(column.name);

            return (
              <div
                key={column.name}
                className="relative px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                style={{ 
                  height: '32px',
                  minHeight: '32px',
                  display: 'flex', 
                  flexDirection: 'column',
                  justifyContent: 'center',
                  boxSizing: 'border-box',
                }}
              >
                {/* Conteúdo da célula completo */}
                <div className="flex items-center gap-2 text-xs">
                  {isPK && (
                    <Key className="h-3 w-3 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {column.name}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 text-[10px] ml-auto">
                    {column.type}
                  </span>
                </div>
                {/* Descrição/comentário (se disponível) - removido para manter altura fixa */}
              </div>
            );
          })}
        </div>
      ) : (
        // Nível 2: Nome + chaves primárias + colunas principais (sem tipos)
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {columns.map((column, index) => {
            const isPK = primaryKeys.includes(column.name);
            // No nível médio, mostrar apenas PKs e FKs principais
            if (!isPK && !column.isForeignKey) {
              return null;
            }

            return (
              <div
                key={column.name}
                className="relative px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                style={{ 
                  height: '32px',
                  minHeight: '32px',
                  display: 'flex', 
                  alignItems: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <div className="flex items-center gap-2 text-xs w-full">
                  {isPK && (
                    <Key className="h-3 w-3 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  )}
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {column.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Rodapé com contagem */}
      {showDetails && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-b-lg text-xs text-gray-600 dark:text-gray-400 text-center">
          {columns.length} {columns.length === 1 ? 'coluna' : 'colunas'}
        </div>
      )}
    </div>
  );
}

export default memo(DatabaseSchemaNode);

