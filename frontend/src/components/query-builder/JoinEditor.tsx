/**
 * Componente para visualizar e editar JOINs
 * Mostra a cadeia de joins e permite editar tipo e condições
 */

import { useState, useEffect, useMemo } from 'react';
import { Edit2, Trash2, ChevronRight, ChevronDown, Database, Code, Plus } from 'lucide-react';
import type { QueryJoin, JoinType, QueryAST } from '../../types/query-builder';
import type { GraphNode, GraphEdge } from '../../api/client';
import SubqueryBuilder from './SubqueryBuilder';
import ManualJoinCreator from './ManualJoinCreator';

interface JoinEditorProps {
  joins: QueryJoin[];
  onUpdate: (joinId: string, updates: Partial<QueryJoin>) => void;
  onRemove: (joinId: string) => void;
  onAddManual?: (
    targetTableId: string,
    sourceTableId: string,
    conditions: Array<{ sourceColumn: string; targetColumn: string }>,
    joinType: JoinType,
    targetSubquery?: QueryAST,
    targetSubqueryAlias?: string
  ) => void;
  baseTableId: string;
  baseTableAlias: string;
  fromSubquery?: QueryAST | null; // Subselect no FROM, se houver
  onSetFromSubquery?: (subqueryAST: QueryAST, alias: string) => void;
  onClearFromSubquery?: (tableId: string) => void;
  nodes?: GraphNode[];
  edges?: GraphEdge[];
  dbType?: 'mysql' | 'sqlserver';
  preselectedViewTableId?: string | null; // VIEW pré-selecionada quando arrastada
  onJoinCreated?: (targetTableId: string) => void; // Callback quando um JOIN é criado
}

const JOIN_TYPES: JoinType[] = ['INNER', 'LEFT', 'RIGHT', 'FULL'];

export default function JoinEditor({
  joins,
  onUpdate,
  onRemove,
  onAddManual,
  baseTableId,
  baseTableAlias,
  fromSubquery,
  onSetFromSubquery,
  onClearFromSubquery,
  nodes = [],
  edges = [],
  dbType = 'mysql',
  preselectedViewTableId = null,
  onJoinCreated,
}: JoinEditorProps) {
  const [expandedJoins, setExpandedJoins] = useState<Set<string>>(new Set(joins.map(j => j.id))); // Todos expandidos por padrão
  const [editingFromSubquery, setEditingFromSubquery] = useState(false);
  const [showManualJoinCreator, setShowManualJoinCreator] = useState(false);
  const [editingJoin, setEditingJoin] = useState<QueryJoin | null>(null); // JOIN sendo editado no ManualJoinCreator

  // Abrir automaticamente o ManualJoinCreator quando há VIEW pré-selecionada
  // Mas apenas se o usuário não fechou manualmente
  const [userClosedManually, setUserClosedManually] = useState(false);
  
  useEffect(() => {
    if (preselectedViewTableId && !showManualJoinCreator && !userClosedManually) {
      setShowManualJoinCreator(true);
      setUserClosedManually(false); // Resetar flag quando uma nova VIEW é pré-selecionada
    }
  }, [preselectedViewTableId, showManualJoinCreator, userClosedManually]);
  
  // Resetar flag quando preselectedViewTableId mudar (nova VIEW arrastada)
  useEffect(() => {
    if (preselectedViewTableId) {
      setUserClosedManually(false);
    }
  }, [preselectedViewTableId]);

  // Tabelas disponíveis como origem (base + JOINs já criados)
  // A VIEW pré-selecionada deve ser o DESTINO, não a origem
  const availableSourceTables = useMemo(() => {
    const tables = Array.from(new Set([
      ...(baseTableId ? [baseTableId] : []),
      ...joins.map(j => ('targetTableId' in j ? j.targetTableId : '')).filter(t => t),
    ]));
    
    return tables;
  }, [baseTableId, joins]);

  const handleStartEdit = (join: QueryJoin) => {
    // Abrir ManualJoinCreator em modo de edição
    setEditingJoin(join);
    setShowManualJoinCreator(true);
    setUserClosedManually(false);
  };

  const toggleJoin = (joinId: string) => {
    setExpandedJoins(prev => {
      const next = new Set(prev);
      if (next.has(joinId)) {
        next.delete(joinId);
      } else {
        next.add(joinId);
      }
      return next;
    });
  };

  const getTableDisplayName = (tableId: string) => {
    return tableId.includes('.') ? tableId.split('.').pop() : tableId;
  };

  // Função para formatar a condição do JOIN (para exibição quando contraído)
  const formatJoinCondition = (join: QueryJoin): string => {
    if (join.customCondition && join.customCondition.trim()) {
      return join.customCondition.trim();
    }
    // Se não há customCondition, usar sourceColumn e targetColumn
    // Para SQL Server, usar colchetes; para MySQL, usar backticks
    const escapeCol = (col: string) => {
      if (dbType === 'sqlserver') {
        return `[${col.replace(/\]/g, ']]')}]`;
      }
      return `\`${col.replace(/`/g, '``')}\``;
    };
    return `${join.sourceAlias}.${escapeCol(join.sourceColumn)} = ${join.targetAlias}.${escapeCol(join.targetColumn)}`;
  };

  // Atualizar expandedJoins quando joins mudarem (adicionar novos como expandidos)
  useEffect(() => {
    if (joins.length > 0) {
      setExpandedJoins(prev => {
        const next = new Set(prev);
        joins.forEach(join => {
          if (!next.has(join.id)) {
            next.add(join.id);
          }
        });
        return next;
      });
    }
  }, [joins]);

  if (joins.length === 0) {
    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900">
        <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            JOINs (0)
          </h3>
          {onAddManual && (
            <button
              onClick={() => setShowManualJoinCreator(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5"
              title="Criar JOIN manualmente"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar JOIN
            </button>
          )}
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="text-gray-500 dark:text-gray-400">
            <p className="text-sm font-medium mb-2">Nenhum JOIN adicionado</p>
            <p className="text-xs">JOINs serão criados automaticamente ao adicionar colunas de outras tabelas</p>
            <p className="text-xs mt-2">ou clique em "Adicionar JOIN" para criar manualmente</p>
          </div>
        </div>

        {/* Manual Join Creator */}
        {showManualJoinCreator && onAddManual && (
          <ManualJoinCreator
            nodes={nodes || []}
            availableSourceTables={availableSourceTables}
            preselectedTargetTableId={preselectedViewTableId || undefined} // VIEW arrastada é o DESTINO
            dbType={dbType}
            onSave={(targetTableId, sourceTableId, conditions, joinType) => {
              onAddManual(targetTableId, sourceTableId, conditions, joinType);
              setShowManualJoinCreator(false);
              setUserClosedManually(true); // Marcar que foi fechado após criar JOIN
            }}
            onCancel={() => {
              setShowManualJoinCreator(false);
              setUserClosedManually(true); // Marcar que foi fechado manualmente
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          JOINs ({joins.length})
        </h3>
        {onAddManual && (
          <button
            onClick={() => setShowManualJoinCreator(true)}
            className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-1.5"
            title="Criar JOIN manualmente"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar JOIN
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
        {/* Mostrar cada JOIN (com tabela base quando for o primeiro) */}
        {joins.map((join, index) => {
          const isExpanded = expandedJoins.has(join.id);
          const sourceName = getTableDisplayName(join.sourceTableId);
          const targetName = getTableDisplayName(join.targetTableId);
          const isFirstJoin = index === 0;
          const showBaseTable = isFirstJoin && !isExpanded;

          return (
            <div key={join.id} className="space-y-2">
              {isExpanded && isFirstJoin && (
                <>
                  {/* Mostrar tabela base separada quando expandido */}
                  <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
                    {fromSubquery ? (
                      <>
                        <Code className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-mono text-sm font-medium text-blue-900 dark:text-blue-100">
                          (SELECT ...) AS {baseTableAlias}
                        </span>
                        <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          SUBQUERY
                        </span>
                        {onSetFromSubquery && (
                          <button
                            onClick={() => setEditingFromSubquery(true)}
                            className="ml-auto px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-1"
                            title="Editar subselect"
                          >
                            <Code className="h-3 w-3" />
                            Editar
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        <span className="font-mono text-sm font-medium text-blue-900 dark:text-blue-100">
                          {getTableDisplayName(baseTableId)} AS {baseTableAlias}
                        </span>
                        <span className="text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded">
                          BASE
                        </span>
                        {onSetFromSubquery && (
                          <button
                            onClick={() => setEditingFromSubquery(true)}
                            className="ml-auto px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                            title="Usar subselect no FROM"
                          >
                            <Code className="h-3 w-3" />
                            Subselect
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400 ml-2" />
                </>
              )}
              <div className="bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                {/* Header do JOIN (sempre visível, compacto quando contraído) */}
                <div className={`flex items-center justify-between ${isExpanded ? 'p-3' : 'px-3 py-2'}`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button
                      onClick={() => toggleJoin(join.id)}
                      className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                      title={isExpanded ? 'Contrair' : 'Expandir'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                    {isExpanded ? (
                      // Layout expandido: badge do tipo + ícone + tabela
                      <>
                        <span className="px-1.5 py-0.5 text-xs font-semibold bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded">
                          {join.type}
                        </span>
                        <Database className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                        <span className="font-mono text-xs font-medium truncate">
                          {targetName} AS {join.targetAlias}
                        </span>
                      </>
                    ) : (
                      // Layout contraído: tabela base + tipo + tabela destino + condição ON (tudo em uma linha)
                      <span className="font-mono text-xs text-gray-900 dark:text-gray-100 truncate">
                        {showBaseTable ? (
                          <>
                            {getTableDisplayName(baseTableId)} AS {baseTableAlias} {join.type} {targetName} AS {join.targetAlias} ON {formatJoinCondition(join)}
                          </>
                        ) : (
                          <>
                            {sourceName} AS {join.sourceAlias} {join.type} {targetName} AS {join.targetAlias} ON {formatJoinCondition(join)}
                          </>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(join);
                      }}
                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
                      title="Editar"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(join.id);
                      }}
                      className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400"
                      title="Remover"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                
                {/* Conteúdo expandido do JOIN */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-0 border-t border-gray-200 dark:border-gray-700">
                    <div className="mt-2">
                      <div className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Condição do JOIN:
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-900 p-2 rounded">
                        ON {formatJoinCondition(join)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Subquery Builder Dialog para FROM */}
      {editingFromSubquery && onSetFromSubquery && (
        <SubqueryBuilder
          initialAST={fromSubquery || null}
          onSave={(subqueryAST) => {
            // Gerar alias único para o subselect
            const alias = `sub${Date.now().toString().slice(-3)}`;
            onSetFromSubquery(subqueryAST, alias);
            setEditingFromSubquery(false);
          }}
          onCancel={() => setEditingFromSubquery(false)}
          nodes={nodes}
          edges={edges}
          dbType={dbType}
          title="Subselect no FROM (Derived Table)"
        />
      )}

      {/* Manual Join Creator */}
      {showManualJoinCreator && onAddManual && (
        <ManualJoinCreator
          nodes={nodes}
          availableSourceTables={availableSourceTables}
          preselectedTargetTableId={editingJoin ? undefined : (preselectedViewTableId || undefined)} // VIEW arrastada é o DESTINO
          editingJoin={editingJoin}
          dbType={dbType}
          edges={edges}
          onSave={(targetTableId, sourceTableId, conditions, joinType, targetSubquery, targetSubqueryAlias) => {
            if (editingJoin) {
              // Modo de edição: atualizar JOIN existente
              // Criar customCondition se houver múltiplas condições
              let customCondition: string | undefined;
              if (conditions.length > 1) {
                const escapeCol = (col: string) => {
                  if (dbType === 'sqlserver') {
                    return `[${col.replace(/\]/g, ']]')}]`;
                  }
                  return `\`${col.replace(/`/g, '``')}\``;
                };
                const conditionParts = conditions.map(c => {
                  const sourceColEscaped = escapeCol(c.sourceColumn);
                  const targetColEscaped = escapeCol(c.targetColumn);
                  return `${editingJoin.sourceAlias}.${sourceColEscaped} = ${editingJoin.targetAlias}.${targetColEscaped}`;
                });
                customCondition = conditionParts.join(' AND ');
              }
              
              onUpdate(editingJoin.id, {
                type: joinType,
                sourceTableId,
                targetTableId,
                sourceColumn: conditions[0]?.sourceColumn || editingJoin.sourceColumn,
                targetColumn: conditions[0]?.targetColumn || editingJoin.targetColumn,
                customCondition: customCondition || (conditions.length === 1 ? undefined : customCondition),
              });
              setEditingJoin(null);
            } else {
              // Modo de criação: criar novo JOIN
              onAddManual(targetTableId, sourceTableId, conditions, joinType, targetSubquery, targetSubqueryAlias);
              // Notificar que um JOIN foi criado (para adicionar coluna pendente)
              if (onJoinCreated) {
                onJoinCreated(targetSubquery && targetSubqueryAlias ? targetSubqueryAlias : targetTableId);
              }
            }
            setShowManualJoinCreator(false);
            setUserClosedManually(true); // Marcar que foi fechado após criar/editar JOIN
          }}
          onCancel={() => {
            setShowManualJoinCreator(false);
            setEditingJoin(null);
            setUserClosedManually(true); // Marcar que foi fechado manualmente
          }}
        />
      )}
    </div>
  );
}

