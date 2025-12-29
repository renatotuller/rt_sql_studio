import { useState, useMemo, useEffect } from 'react';
import { Search, X, ChevronRight, ChevronDown, Check, ChevronLeft, List } from 'lucide-react';
import { Node, Edge } from 'reactflow';

interface CascadingTableSelectorProps {
  nodes: Node[];
  edges: Edge[];
  onSelectTables: (mainTable: string | null, selectedRelated: Set<string>) => void;
  mainTableId: string | null;
  selectedRelatedTables: Set<string>;
  isOpen: boolean;
  onToggle: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

// ============================================================================
// IMPLEMENTAÇÃO ANTIGA (MANTIDA PARA REVERSÃO)
// ============================================================================
// A implementação antiga só mostrava tabelas relacionadas à tabela principal.
// Não permitia expandir tabelas relacionadas para ver suas próprias dependências.
// 
// Comportamento antigo:
// - findDirectlyRelatedTables() só calculava relacionamentos da tabela principal
// - selectedRelatedTables era um Set simples sem hierarquia
// - Não havia estado para controlar expansão de tabelas relacionadas
// ============================================================================

/**
 * Função para encontrar tabelas diretamente relacionadas a uma tabela específica.
 * Esta função é usada tanto na implementação antiga quanto na nova.
 * 
 * @param tableId - ID da tabela para encontrar relacionamentos
 * @param nodes - Array de todos os nós disponíveis
 * @param edges - Array de todas as arestas (relacionamentos)
 * @returns Set de IDs de tabelas relacionadas
 */
function findDirectlyRelatedTables(
  tableId: string,
  nodes: Node[],
  edges: Edge[]
): Set<string> {
  const relatedTables = new Set<string>();
  
  edges.forEach((edge) => {
    const fromId = edge.source;
    const toId = edge.target;
    
    if (fromId === tableId) {
      relatedTables.add(toId);
    }
    if (toId === tableId) {
      relatedTables.add(fromId);
    }
  });
  
  return relatedTables;
}

export default function CascadingTableSelector({
  nodes,
  edges,
  onSelectTables,
  mainTableId,
  selectedRelatedTables,
  isOpen,
  onToggle,
  onCollapsedChange,
}: CascadingTableSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedMainTable, setExpandedMainTable] = useState<string | null>(mainTableId);
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // ============================================================================
  // NOVA IMPLEMENTAÇÃO: Estado para expansão recursiva
  // ============================================================================
  // Permite expandir qualquer tabela relacionada selecionada para ver suas
  // próprias tabelas relacionadas, criando uma árvore de dependências.
  // ============================================================================
  const [expandedRelatedTables, setExpandedRelatedTables] = useState<Set<string>>(new Set());

  const handleCollapse = (collapsed: boolean) => {
    setIsCollapsed(collapsed);
    onCollapsedChange?.(collapsed);
  };

  // Quando a tabela principal muda, expandir automaticamente e limpar expansões antigas
  useEffect(() => {
    if (mainTableId) {
      setExpandedMainTable(mainTableId);
      // Limpar expansões de tabelas relacionadas quando a principal muda
      setExpandedRelatedTables(new Set());
    } else {
      setExpandedMainTable(null);
      setExpandedRelatedTables(new Set());
    }
  }, [mainTableId]);

  // Encontrar tabelas relacionadas à tabela principal (nível 1)
  const relatedTables = useMemo(() => {
    if (!mainTableId) return new Set<string>();
    return findDirectlyRelatedTables(mainTableId, nodes, edges);
  }, [mainTableId, nodes, edges]);
  
  // ============================================================================
  // NOVA IMPLEMENTAÇÃO: Cache de relacionamentos para todas as tabelas
  // ============================================================================
  // Pre-calculamos relacionamentos de todas as tabelas para performance.
  // Isso permite expandir qualquer tabela relacionada rapidamente.
  // ============================================================================
  const allTableRelationships = useMemo(() => {
    const relationships = new Map<string, Set<string>>();
    nodes.forEach(node => {
      relationships.set(node.id, findDirectlyRelatedTables(node.id, nodes, edges));
    });
    return relationships;
  }, [nodes, edges]);
  
  // Função para obter relacionamentos de uma tabela específica
  const getTableRelationships = (tableId: string): Set<string> => {
    return allTableRelationships.get(tableId) || new Set();
  };
  
  // Handler para expandir/colapsar tabelas relacionadas
  const handleExpandRelatedTable = (tableId: string) => {
    const newExpanded = new Set(expandedRelatedTables);
    if (newExpanded.has(tableId)) {
      newExpanded.delete(tableId);
    } else {
      newExpanded.add(tableId);
    }
    setExpandedRelatedTables(newExpanded);
  };

  // Filtrar nós principais (todas as tabelas disponíveis)
  const mainTables = useMemo(() => {
    // Sempre mostrar todas as tabelas disponíveis para seleção
    return nodes;
  }, [nodes]);

  // Filtrar por busca
  const filteredMainTables = useMemo(() => {
    if (!searchTerm.trim()) {
      return mainTables;
    }
    const term = searchTerm.toLowerCase();
    return mainTables.filter((node) => {
      const label = node.data?.label || node.id;
      return label.toLowerCase().includes(term) || node.id.toLowerCase().includes(term);
    });
  }, [mainTables, searchTerm]);

  // Ordenar tabelas
  const sortedMainTables = useMemo(() => {
    return [...filteredMainTables].sort((a, b) => {
      // Tabela principal primeiro
      if (a.id === mainTableId) return -1;
      if (b.id === mainTableId) return 1;
      
      const labelA = a.data?.label || a.id;
      const labelB = b.data?.label || b.id;
      return labelA.localeCompare(labelB);
    });
  }, [filteredMainTables, mainTableId]);

  // Obter nós relacionados para exibição
  const relatedNodes = useMemo(() => {
    if (!mainTableId) return [];
    return nodes.filter(node => relatedTables.has(node.id));
  }, [nodes, mainTableId, relatedTables]);

  const handleMainTableSelect = (tableId: string) => {
    if (mainTableId === tableId) {
      // Deselecionar tabela principal
      onSelectTables(null, new Set());
      setExpandedMainTable(null);
    } else {
      // Selecionar nova tabela principal e expandir
      onSelectTables(tableId, new Set());
      setExpandedMainTable(tableId);
    }
  };

  const handleRelatedTableToggle = (tableId: string) => {
    const newSelected = new Set(selectedRelatedTables);
    if (newSelected.has(tableId)) {
      newSelected.delete(tableId);
    } else {
      newSelected.add(tableId);
    }
    onSelectTables(mainTableId, newSelected);
  };

  const handleSelectAllRelated = () => {
    onSelectTables(mainTableId, new Set(relatedTables));
  };

  const handleDeselectAllRelated = () => {
    onSelectTables(mainTableId, new Set());
  };

  if (!isOpen) {
    return null;
  }

  // Estado retraído: mostrar apenas botão para expandir
  if (isCollapsed) {
    return (
      <div className="w-12 flex-shrink-0">
        <button
          onClick={() => handleCollapse(false)}
          className="w-full h-full p-2 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center"
          title="Expandir seletor de tabelas"
        >
          <ChevronRight className="h-5 w-5 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <List className="h-4 w-4" />
            Seleção em Cascata
          </h3>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleCollapse(true)}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Retrair"
            >
              <ChevronLeft className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
            <button
              onClick={() => {
                setIsCollapsed(false);
                onToggle();
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Fechar"
            >
              <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
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
        {sortedMainTables.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
            {searchTerm ? 'Nenhuma tabela encontrada' : 'Nenhuma tabela disponível'}
          </div>
        ) : (
          <div className="p-2">
            {sortedMainTables.map((node) => {
              const label = node.data?.label || node.id;
              const isMainSelected = mainTableId === node.id;
              const isView = node.data?.type === 'view';
              const isExpanded = expandedMainTable === node.id;
              const nodeRelatedTables = isMainSelected ? relatedTables : new Set<string>();

              return (
                <div key={node.id} className="mb-2">
                  {/* Tabela Principal */}
                  <button
                    onClick={() => handleMainTableSelect(node.id)}
                    className={`w-full text-left px-3 py-2 rounded-md transition-colors text-sm flex items-center justify-between ${
                      isMainSelected
                        ? 'bg-primary-100 dark:bg-primary-900 text-primary-900 dark:text-primary-100 font-medium'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isView && <span className="text-xs flex-shrink-0">👁️</span>}
                      <span className="truncate">{label}</span>
                      {isMainSelected && (
                        <span className="text-xs bg-primary-200 dark:bg-primary-800 px-2 py-0.5 rounded flex-shrink-0">
                          Principal
                        </span>
                      )}
                    </div>
                    {isMainSelected && nodeRelatedTables.size > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {nodeRelatedTables.size}
                        </span>
                      </div>
                    )}
                  </button>

                  {/* Subnível: Tabelas Relacionadas */}
                  {isMainSelected && isExpanded && nodeRelatedTables.size > 0 && (
                    <div className="ml-4 mt-1 border-l-2 border-primary-200 dark:border-primary-700 pl-3">
                      {/* Botões de seleção em massa */}
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={handleSelectAllRelated}
                          className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors text-gray-700 dark:text-gray-300"
                        >
                          Selecionar Todas
                        </button>
                        <button
                          onClick={handleDeselectAllRelated}
                          className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors text-gray-700 dark:text-gray-300"
                        >
                          Limpar
                        </button>
                      </div>

                      {/* Lista de tabelas relacionadas (Nível 1) */}
                      {relatedNodes
                        .filter(n => nodeRelatedTables.has(n.id))
                        .sort((a, b) => {
                          const labelA = a.data?.label || a.id;
                          const labelB = b.data?.label || b.id;
                          return labelA.localeCompare(labelB);
                        })
                        .map((relatedNode) => {
                          const relatedLabel = relatedNode.data?.label || relatedNode.id;
                          const isRelatedSelected = selectedRelatedTables.has(relatedNode.id);
                          const isRelatedView = relatedNode.data?.type === 'view';
                          
                          // ============================================================================
                          // NOVA IMPLEMENTAÇÃO: Verificar se tabela relacionada tem suas próprias relacionadas
                          // ============================================================================
                          const relatedNodeRelationships = getTableRelationships(relatedNode.id);
                          const hasSubRelationships = relatedNodeRelationships.size > 0;
                          const isExpanded = expandedRelatedTables.has(relatedNode.id);
                          // Excluir a tabela principal e outras já selecionadas para evitar loops
                          const filteredSubRelationships = new Set(
                            Array.from(relatedNodeRelationships).filter(
                              id => id !== mainTableId && !selectedRelatedTables.has(id)
                            )
                          );
                          // ============================================================================

                          return (
                            <div key={relatedNode.id} className="mb-1">
                              {/* Botão da tabela relacionada (Nível 1) */}
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleRelatedTableToggle(relatedNode.id)}
                                  className={`flex-1 text-left px-3 py-1.5 rounded-md transition-colors text-sm flex items-center gap-2 ${
                                    isRelatedSelected
                                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100 font-medium'
                                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {isRelatedSelected ? (
                                      <Check className="h-3 w-3 flex-shrink-0" />
                                    ) : (
                                      <div className="w-3 h-3 border border-gray-300 dark:border-gray-600 rounded flex-shrink-0" />
                                    )}
                                    {isRelatedView && <span className="text-xs flex-shrink-0">👁️</span>}
                                    <span className="truncate">{relatedLabel}</span>
                                  </div>
                                </button>
                                
                                {/* ============================================================================
                                    NOVA IMPLEMENTAÇÃO: Botão de expansão para tabelas relacionadas
                                    ============================================================================
                                    Mostra botão de expansão apenas se a tabela tem relacionamentos
                                    e está selecionada (para evitar confusão visual)
                                    ============================================================================ */}
                                {isRelatedSelected && hasSubRelationships && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExpandRelatedTable(relatedNode.id);
                                    }}
                                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                                    title={isExpanded ? 'Colapsar' : 'Expandir relacionamentos'}
                                  >
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                                    )}
                                  </button>
                                )}
                                {/* ============================================================================ */}
                              </div>
                              
                              {/* ============================================================================
                                  NOVA IMPLEMENTAÇÃO: Subnível - Tabelas relacionadas às relacionadas (Nível 2+)
                                  ============================================================================
                                  Renderiza recursivamente as tabelas relacionadas a uma tabela relacionada
                                  selecionada, criando uma árvore de dependências.
                                  ============================================================================ */}
                              {isRelatedSelected && isExpanded && filteredSubRelationships.size > 0 && (
                                <div className="ml-6 mt-1 border-l-2 border-blue-200 dark:border-blue-700 pl-3">
                                  {Array.from(filteredSubRelationships)
                                    .map(subRelatedId => {
                                      const subRelatedNode = nodes.find(n => n.id === subRelatedId);
                                      if (!subRelatedNode) return null;
                                      
                                      const subRelatedLabel = subRelatedNode.data?.label || subRelatedNode.id;
                                      const isSubRelatedSelected = selectedRelatedTables.has(subRelatedId);
                                      const isSubRelatedView = subRelatedNode.data?.type === 'view';
                                      
                                      // Verificar se esta sub-relacionada também tem relacionamentos
                                      const subSubRelationships = getTableRelationships(subRelatedId);
                                      const hasSubSubRelationships = subSubRelationships.size > 0;
                                      const isSubExpanded = expandedRelatedTables.has(subRelatedId);
                                      const filteredSubSubRelationships = new Set(
                                        Array.from(subSubRelationships).filter(
                                          id => id !== mainTableId && 
                                                id !== relatedNode.id && 
                                                !selectedRelatedTables.has(id)
                                        )
                                      );
                                      
                                      return (
                                        <div key={subRelatedId} className="mb-1">
                                          <div className="flex items-center gap-1">
                                            <button
                                              onClick={() => handleRelatedTableToggle(subRelatedId)}
                                              className={`flex-1 text-left px-3 py-1.5 rounded-md transition-colors text-sm flex items-center gap-2 ${
                                                isSubRelatedSelected
                                                  ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-900 dark:text-indigo-100 font-medium'
                                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                                {isSubRelatedSelected ? (
                                                  <Check className="h-3 w-3 flex-shrink-0" />
                                                ) : (
                                                  <div className="w-3 h-3 border border-gray-300 dark:border-gray-600 rounded flex-shrink-0" />
                                                )}
                                                {isSubRelatedView && <span className="text-xs flex-shrink-0">👁️</span>}
                                                <span className="truncate text-xs">{subRelatedLabel}</span>
                                              </div>
                                            </button>
                                            
                                            {isSubRelatedSelected && hasSubSubRelationships && (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleExpandRelatedTable(subRelatedId);
                                                }}
                                                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                                                title={isSubExpanded ? 'Colapsar' : 'Expandir relacionamentos'}
                                              >
                                                {isSubExpanded ? (
                                                  <ChevronDown className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                                ) : (
                                                  <ChevronRight className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                                )}
                                              </button>
                                            )}
                                          </div>
                                          
                                          {/* Nível 3+ (recursivo) - pode continuar expandindo */}
                                          {isSubRelatedSelected && isSubExpanded && filteredSubSubRelationships.size > 0 && (
                                            <div className="ml-4 mt-1 border-l-2 border-indigo-200 dark:border-indigo-700 pl-2">
                                              {Array.from(filteredSubSubRelationships).map(subSubRelatedId => {
                                                const subSubRelatedNode = nodes.find(n => n.id === subSubRelatedId);
                                                if (!subSubRelatedNode) return null;
                                                
                                                const subSubRelatedLabel = subSubRelatedNode.data?.label || subSubRelatedNode.id;
                                                const isSubSubRelatedSelected = selectedRelatedTables.has(subSubRelatedId);
                                                const isSubSubRelatedView = subSubRelatedNode.data?.type === 'view';
                                                
                                                return (
                                                  <button
                                                    key={subSubRelatedId}
                                                    onClick={() => handleRelatedTableToggle(subSubRelatedId)}
                                                    className={`w-full text-left px-2 py-1 rounded-md mb-1 transition-colors text-xs flex items-center gap-2 ${
                                                      isSubSubRelatedSelected
                                                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100 font-medium'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400'
                                                    }`}
                                                  >
                                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                                      {isSubSubRelatedSelected ? (
                                                        <Check className="h-2.5 w-2.5 flex-shrink-0" />
                                                      ) : (
                                                        <div className="w-2.5 h-2.5 border border-gray-300 dark:border-gray-600 rounded flex-shrink-0" />
                                                      )}
                                                      {isSubSubRelatedView && <span className="text-[10px] flex-shrink-0">👁️</span>}
                                                      <span className="truncate">{subSubRelatedLabel}</span>
                                                    </div>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })
                                    .filter(Boolean)}
                                </div>
                              )}
                              {/* ============================================================================ */}
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      {mainTableId && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            {selectedRelatedTables.size > 0 ? (
              <span>
                {selectedRelatedTables.size} de {relatedTables.size} tabelas relacionadas selecionadas
              </span>
            ) : (
              <span>Nenhuma tabela relacionada selecionada</span>
            )}
          </div>
          <button
            onClick={() => {
              onSelectTables(null, new Set());
              setExpandedMainTable(null);
              // ============================================================================
              // NOVA IMPLEMENTAÇÃO: Limpar também expansões de tabelas relacionadas
              // ============================================================================
              setExpandedRelatedTables(new Set());
              // ============================================================================
            }}
            className="w-full btn btn-secondary text-sm py-2"
          >
            Limpar Seleção
          </button>
        </div>
      )}
    </div>
  );
}

