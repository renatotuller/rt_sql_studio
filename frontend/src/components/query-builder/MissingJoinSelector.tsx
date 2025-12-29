/**
 * Componente para selecionar uma tabela intermediária quando não há JOIN compatível
 */

import { useState, useMemo } from 'react';
import { X, Check, AlertCircle, Link2 } from 'lucide-react';
import type { GraphNode, GraphEdge, Column } from '../../api/client';
import { findTablesWithRelationships } from '../../utils/query-builder/graph-path-finder';

interface MissingJoinSelectorProps {
  sourceTableId: string;
  targetTableId: string;
  targetColumn: Column;
  nodes: GraphNode[];
  edges: GraphEdge[];
  includedTableIds: Set<string>;
  onSelectTable: (intermediateTableId: string) => void;
  onCancel: () => void;
}

export default function MissingJoinSelector({
  sourceTableId,
  targetTableId,
  targetColumn,
  nodes,
  edges,
  includedTableIds,
  onSelectTable,
  onCancel,
}: MissingJoinSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Encontrar TODAS as tabelas intermediárias possíveis que conectam sourceTableId com targetTableId
  // Uma tabela intermediária deve ter relacionamento com sourceTableId (ou tabelas incluídas) E com targetTableId
  const availableTables = useMemo(() => {
    const intermediateTables = new Map<string, {
      tableId: string;
      tableName: string;
      relationships: Array<{
        edge: GraphEdge;
        direction: 'from' | 'to';
        relatedTableId: string;
      }>;
      relationshipCount: number;
    }>();

    // Criar um Set com todas as tabelas que podem ser "origem" (sourceTableId + tabelas incluídas)
    const possibleSourceTables = new Set<string>([sourceTableId]);
    includedTableIds.forEach(id => possibleSourceTables.add(id));

    // Para cada tabela no grafo, verificar se ela pode ser intermediária
    nodes.forEach(node => {
      // Pular se for a tabela de origem ou destino
      if (node.id === sourceTableId || node.id === targetTableId) return;
      
      // Pular se já estiver incluída na query
      if (includedTableIds.has(node.id)) return;

      // Verificar se tem relacionamento com sourceTableId OU com alguma tabela incluída
      let hasRelationToSource = false;
      let sourceRelationships: Array<{ edge: GraphEdge; relatedTableId: string }> = [];
      
      possibleSourceTables.forEach(possibleSource => {
        edges.forEach(edge => {
          if ((edge.from === node.id && edge.to === possibleSource) ||
              (edge.to === node.id && edge.from === possibleSource)) {
            hasRelationToSource = true;
            sourceRelationships.push({
              edge,
              relatedTableId: possibleSource,
            });
          }
        });
      });

      // Verificar se tem relacionamento com targetTableId
      const targetRelationships: Array<{ edge: GraphEdge }> = [];
      const hasRelationToTarget = edges.some(edge => {
        if ((edge.from === node.id && edge.to === targetTableId) ||
            (edge.to === node.id && edge.from === targetTableId)) {
          targetRelationships.push({ edge });
          return true;
        }
        return false;
      });

      // Se tem relacionamento com ambos, é uma tabela intermediária válida
      if (hasRelationToSource && hasRelationToTarget) {
        const tableName = node.id.includes('.') 
          ? node.id.split('.').pop() || node.id
          : node.id;

        // Coletar todos os relacionamentos desta tabela
        const relationships: Array<{
          edge: GraphEdge;
          direction: 'from' | 'to';
          relatedTableId: string;
        }> = [];

        // Adicionar relacionamentos com source (sourceTableId ou tabelas incluídas)
        sourceRelationships.forEach(({ edge, relatedTableId }) => {
          relationships.push({
            edge,
            direction: edge.from === node.id ? 'to' : 'from',
            relatedTableId,
          });
        });

        // Adicionar relacionamentos com targetTableId
        targetRelationships.forEach(({ edge }) => {
          relationships.push({
            edge,
            direction: edge.from === node.id ? 'to' : 'from',
            relatedTableId: targetTableId,
          });
        });

        // Contar quantos relacionamentos únicos esta tabela tem (com source e target)
        const uniqueRelationships = new Set<string>();
        relationships.forEach(rel => {
          uniqueRelationships.add(`${rel.relatedTableId}-${rel.edge.id}`);
        });

        intermediateTables.set(node.id, {
          tableId: node.id,
          tableName,
          relationships,
          relationshipCount: uniqueRelationships.size,
        });
      }
    });

    // Converter para array e ordenar por número de relacionamentos (mais relacionamentos = melhor opção)
    return Array.from(intermediateTables.values())
      .sort((a, b) => b.relationshipCount - a.relationshipCount);
  }, [nodes, edges, includedTableIds, sourceTableId, targetTableId]);

  const filteredTables = useMemo(() => {
    if (!searchTerm.trim()) return availableTables;
    
    const term = searchTerm.toLowerCase();
    return availableTables.filter(table =>
      table.tableName.toLowerCase().includes(term) ||
      table.tableId.toLowerCase().includes(term)
    );
  }, [availableTables, searchTerm]);

  const sourceTableName = sourceTableId.includes('.') 
    ? sourceTableId.split('.').pop() || sourceTableId
    : sourceTableId;
  const targetTableName = targetTableId.includes('.') 
    ? targetTableId.split('.').pop() || targetTableId
    : targetTableId;

  const handleSelectTable = (tableId: string) => {
    onSelectTable(tableId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-6 w-6 text-amber-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                JOIN não encontrado
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Não foi possível encontrar um relacionamento direto entre as tabelas
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Cancelar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>Coluna selecionada:</strong> <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded">{targetTableName}.{targetColumn.name}</code>
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-1">
              <strong>Tabela atual:</strong> <code className="px-1 py-0.5 bg-amber-100 dark:bg-amber-900/40 rounded">{sourceTableName}</code>
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200 mt-2">
              Selecione uma tabela abaixo que tenha relacionamento com ambas as tabelas para criar o JOIN necessário.
            </p>
          </div>

          {/* Busca */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Buscar tabela..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Lista de tabelas */}
          {filteredTables.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">
                {searchTerm ? 'Nenhuma tabela encontrada com o termo de busca.' : 'Nenhuma tabela com relacionamento disponível encontrada.'}
              </p>
              <p className="text-xs mt-2 text-gray-400 dark:text-gray-500">
                Você pode criar um JOIN manualmente através do editor de JOINs.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTables.map(table => {
                const relationshipCount = table.relationshipCount || table.relationships.length;
                const relationshipText = relationshipCount === 1 
                  ? '1 relacionamento' 
                  : `${relationshipCount} relacionamentos`;

                return (
                  <button
                    key={table.tableId}
                    onClick={() => handleSelectTable(table.tableId)}
                    className="w-full p-4 text-left border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Link2 className="h-4 w-4 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                          <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                            {table.tableName}
                          </h3>
                          <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded">
                            {relationshipText}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono mb-2">
                          {table.tableId}
                        </p>
                        <div className="space-y-1">
                          {table.relationships.slice(0, 3).map((rel, idx) => {
                            const relatedTableName = rel.relatedTableId.includes('.')
                              ? rel.relatedTableId.split('.').pop() || rel.relatedTableId
                              : rel.relatedTableId;
                            
                            return (
                              <div key={idx} className="text-xs text-gray-600 dark:text-gray-300 flex items-center gap-2">
                                <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
                                  {rel.direction === 'from' 
                                    ? `${relatedTableName}.${rel.edge.fromColumn} → ${table.tableName}.${rel.edge.toColumn}`
                                    : `${table.tableName}.${rel.edge.fromColumn} → ${relatedTableName}.${rel.edge.toColumn}`
                                  }
                                </span>
                              </div>
                            );
                          })}
                          {table.relationships.length > 3 && (
                            <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                              +{table.relationships.length - 3} relacionamento(s) adicional(is)
                            </p>
                          )}
                        </div>
                      </div>
                      <Check className="h-5 w-5 text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Selecione uma tabela para criar o JOIN necessário
          </p>
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
