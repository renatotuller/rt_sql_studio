/**
 * Componente para criar JOINs manualmente
 */

import { useState, useMemo, useEffect } from 'react';
import { X, Plus, Code } from 'lucide-react';
import type { GraphNode, Column, GraphEdge } from '../../api/client';
import type { JoinType, QueryJoin, QueryAST } from '../../types/query-builder';
import SubqueryBuilder from './SubqueryBuilder';

interface JoinCondition {
  id: string;
  sourceColumn: string;
  targetColumn: string;
}

interface ManualJoinCreatorProps {
  nodes: GraphNode[];
  availableSourceTables: string[];
  preselectedSourceTableId?: string; // Tabela pré-selecionada como origem (quando editando)
  preselectedTargetTableId?: string; // VIEW/tabela pré-selecionada como destino (quando arrastada)
  editingJoin?: QueryJoin | null; // JOIN sendo editado (null = modo criação)
  dbType?: 'mysql' | 'sqlserver'; // Tipo de banco para escape de colunas
  edges?: GraphEdge[]; // Arestas para subselects
  onSave: (
    targetTableId: string,
    sourceTableId: string,
    conditions: Array<{ sourceColumn: string; targetColumn: string }>,
    joinType: JoinType,
    targetSubquery?: QueryAST, // Subselect como destino (opcional)
    targetSubqueryAlias?: string // Alias do subselect
  ) => void;
  onCancel: () => void;
}

const JOIN_TYPES: JoinType[] = ['INNER', 'LEFT', 'RIGHT', 'FULL'];

export default function ManualJoinCreator({
  nodes,
  availableSourceTables,
  preselectedSourceTableId,
  preselectedTargetTableId,
  editingJoin = null,
  dbType = 'mysql',
  edges = [],
  onSave,
  onCancel,
}: ManualJoinCreatorProps) {
  const isEditing = !!editingJoin;
  const [useSubqueryAsTarget, setUseSubqueryAsTarget] = useState(false);
  const [targetSubquery, setTargetSubquery] = useState<QueryAST | null>(null);
  const [targetSubqueryAlias, setTargetSubqueryAlias] = useState<string>('');
  const [editingSubquery, setEditingSubquery] = useState(false);

  // Função para parsear customCondition em condições individuais
  const parseCustomCondition = (customCondition: string): Array<{ sourceColumn: string; targetColumn: string }> => {
    if (!customCondition || !customCondition.trim()) {
      return [];
    }

    // Dividir por AND e extrair condições
    const parts = customCondition.split(/\s+AND\s+/i);
    const conditions: Array<{ sourceColumn: string; targetColumn: string }> = [];

    for (const part of parts) {
      const trimmed = part.trim();
      // Procurar padrão: alias.[coluna] = alias.[coluna] ou alias.`coluna` = alias.`coluna` ou alias.coluna = alias.coluna
      // Regex mais flexível para lidar com diferentes formatos de escape
      const patterns = [
        // SQL Server: [coluna]
        /(\w+)\.\[([^\]]+)\]\s*=\s*(\w+)\.\[([^\]]+)\]/,
        // MySQL: `coluna`
        /(\w+)\.`([^`]+)`\s*=\s*(\w+)\.`([^`]+)`/,
        // Sem escape: coluna
        /(\w+)\.(\w+)\s*=\s*(\w+)\.(\w+)/,
      ];

      let matched = false;
      for (const pattern of patterns) {
        const match = trimmed.match(pattern);
        if (match) {
          const [, , sourceCol, , targetCol] = match;
          conditions.push({
            sourceColumn: sourceCol,
            targetColumn: targetCol,
          });
          matched = true;
          break;
        }
      }

      // Se nenhum padrão funcionou, tentar extrair manualmente
      if (!matched) {
        // Tentar dividir por = e extrair colunas
        const equalParts = trimmed.split('=');
        if (equalParts.length === 2) {
          const left = equalParts[0].trim();
          const right = equalParts[1].trim();
          
          // Extrair coluna do lado esquerdo (remover alias e escape)
          const leftCol = left.replace(/^\w+\./, '').replace(/^\[|\]$/g, '').replace(/^`|`$/g, '');
          const rightCol = right.replace(/^\w+\./, '').replace(/^\[|\]$/g, '').replace(/^`|`$/g, '');
          
          if (leftCol && rightCol) {
            conditions.push({
              sourceColumn: leftCol,
              targetColumn: rightCol,
            });
          }
        }
      }
    }

    return conditions;
  };

  // Inicializar estados
  const [targetTableId, setTargetTableId] = useState<string>('');
  const [sourceTableId, setSourceTableId] = useState<string>('');
  const [joinType, setJoinType] = useState<JoinType>(editingJoin?.type || 'LEFT');
  const [isInitialized, setIsInitialized] = useState(false); // Flag para controlar inicialização única
  
  // Inicializar condições: se há customCondition, parsear; senão, usar sourceColumn/targetColumn
  const initialConditions = useMemo(() => {
    if (editingJoin) {
      if (editingJoin.customCondition && editingJoin.customCondition.trim()) {
        const parsed = parseCustomCondition(editingJoin.customCondition);
        if (parsed.length > 0) {
          return parsed.map((c, idx) => ({
            id: `cond-edit-${idx}`,
            sourceColumn: c.sourceColumn,
            targetColumn: c.targetColumn,
          }));
        }
      }
      // Se não há customCondition ou não foi possível parsear, usar sourceColumn/targetColumn
      if (editingJoin.sourceColumn && editingJoin.targetColumn) {
        return [{
          id: `cond-edit-0`,
          sourceColumn: editingJoin.sourceColumn,
          targetColumn: editingJoin.targetColumn,
        }];
      }
    }
    return [{ id: `cond-${Date.now()}`, sourceColumn: '', targetColumn: '' }];
  }, [editingJoin]);

  const [conditions, setConditions] = useState<JoinCondition[]>(initialConditions);

  // Inicializar estados quando o componente montar ou quando editingJoin mudar
  useEffect(() => {
    if (isInitialized && !editingJoin) return; // Já inicializou e não está editando, não sobrescrever
    
    if (editingJoin) {
      // Modo de edição: usar dados do JOIN
      setTargetTableId(editingJoin.targetTableId);
      setSourceTableId(editingJoin.sourceTableId);
      setJoinType(editingJoin.type);
      
      if (editingJoin.customCondition && editingJoin.customCondition.trim()) {
        const parsed = parseCustomCondition(editingJoin.customCondition);
        if (parsed.length > 0) {
          setConditions(parsed.map((c, idx) => ({
            id: `cond-edit-${idx}`,
            sourceColumn: c.sourceColumn,
            targetColumn: c.targetColumn,
          })));
        } else if (editingJoin.sourceColumn && editingJoin.targetColumn) {
          setConditions([{
            id: `cond-edit-0`,
            sourceColumn: editingJoin.sourceColumn,
            targetColumn: editingJoin.targetColumn,
          }]);
        }
      } else if (editingJoin.sourceColumn && editingJoin.targetColumn) {
        setConditions([{
          id: `cond-edit-0`,
          sourceColumn: editingJoin.sourceColumn,
          targetColumn: editingJoin.targetColumn,
        }]);
      }
      setIsInitialized(true);
    } else if (!isInitialized) {
      // Modo de criação: inicializar apenas uma vez
      // Destino: VIEW arrastada (se houver)
      if (preselectedTargetTableId) {
        console.log('✅ [ManualJoinCreator] Inicializando destino com VIEW pré-selecionada:', preselectedTargetTableId);
        setTargetTableId(preselectedTargetTableId);
      }
      
      // Origem: primeira tabela disponível (base ou última tabela em JOIN)
      if (availableSourceTables.length > 0) {
        const firstAvailable = availableSourceTables[0];
        console.log('✅ [ManualJoinCreator] Inicializando origem com primeira tabela disponível:', firstAvailable);
        setSourceTableId(firstAvailable);
      } else if (preselectedSourceTableId) {
        console.log('✅ [ManualJoinCreator] Inicializando origem com tabela pré-selecionada:', preselectedSourceTableId);
        setSourceTableId(preselectedSourceTableId);
      }
      setIsInitialized(true);
    }
  }, [editingJoin, preselectedTargetTableId, preselectedSourceTableId, availableSourceTables, isInitialized]);

  // Obter tabelas disponíveis para JOIN (todas exceto a tabela de origem selecionada)
  // Permite selecionar tabelas já adicionadas como destino para criar JOINs encadeados
  const availableTargetTables = useMemo(() => {
    return nodes
      .filter(node => node.id !== sourceTableId) // Apenas excluir a tabela de origem selecionada
      .map(node => ({
        id: node.id,
        name: node.id.includes('.') ? node.id.split('.').pop()! : node.id,
      }));
  }, [nodes, sourceTableId]);

  // Obter colunas da tabela de origem
  const sourceColumns = useMemo(() => {
    if (!sourceTableId) return [];
    const sourceNode = nodes.find(n => n.id === sourceTableId);
    return sourceNode?.columns || [];
  }, [nodes, sourceTableId]);

  // Obter colunas da tabela de destino ou do subselect
  const targetColumns = useMemo(() => {
    if (useSubqueryAsTarget && targetSubquery) {
      // Se está usando subselect, extrair colunas do SELECT do subselect
      return targetSubquery.select
        .filter(field => {
          // Filtrar apenas campos normais (não subselects aninhados)
          if ('type' in field && field.type === 'subquery') return false;
          const normalField = field as { tableId?: string; column?: string; alias?: string };
          return normalField.column || normalField.alias;
        })
        .map(field => {
          const normalField = field as { tableId?: string; column?: string; alias?: string };
          return {
            name: normalField.alias || normalField.column || 'coluna',
            type: 'varchar', // Tipo padrão, pode ser melhorado
          };
        });
    }
    if (!targetTableId) return [];
    const targetNode = nodes.find(n => n.id === targetTableId);
    return targetNode?.columns || [];
  }, [nodes, targetTableId, useSubqueryAsTarget, targetSubquery]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      { id: `cond-${Date.now()}-${Math.random()}`, sourceColumn: '', targetColumn: '' }
    ]);
  };

  const removeCondition = (conditionId: string) => {
    if (conditions.length > 1) {
      setConditions(conditions.filter(c => c.id !== conditionId));
    }
  };

  const updateCondition = (conditionId: string, field: 'sourceColumn' | 'targetColumn', value: string) => {
    setConditions(conditions.map(c => 
      c.id === conditionId ? { ...c, [field]: value } : c
    ));
  };

  const handleSave = () => {
    // Validar que há pelo menos uma condição preenchida
    const validConditions = conditions.filter(c => c.sourceColumn && c.targetColumn);
    
    // Se está usando subselect como destino, validar que o subselect foi criado
    if (useSubqueryAsTarget) {
      if (!targetSubquery || !targetSubqueryAlias || validConditions.length === 0) {
        alert('Preencha todos os campos obrigatórios: crie o subselect e defina pelo menos uma condição de JOIN');
        return;
      }
      // Para subselects, o targetTableId pode ser vazio ou um placeholder
      // O importante é ter o subquery e o alias
      onSave('', sourceTableId, validConditions, joinType, targetSubquery, targetSubqueryAlias);
      return;
    }
    
    // Validação normal para tabela/VIEW
    if (!targetTableId || !sourceTableId || validConditions.length === 0) {
      alert('Preencha todos os campos obrigatórios e pelo menos uma condição de JOIN');
      return;
    }

    onSave(targetTableId, sourceTableId, validConditions, joinType);
  };

  const getTableDisplayName = (tableId: string) => {
    return tableId.includes('.') ? tableId.split('.').pop()! : tableId;
  };

  // Função para gerar alias aproximado (mesma lógica do useQueryBuilder)
  const generateApproximateAlias = (tableId: string): string => {
    const tableName = getTableDisplayName(tableId);
    return tableName.toLowerCase().substring(0, 3);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isEditing ? 'Editar JOIN Manual' : 'Criar JOIN Manual'}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {isEditing 
                ? 'Edite o relacionamento entre as tabelas'
                : 'Defina manualmente um relacionamento entre tabelas'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
          {/* Tipo de JOIN */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tipo de JOIN
            </label>
            <select
              value={joinType}
              onChange={e => setJoinType(e.target.value as JoinType)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {JOIN_TYPES.map(type => (
                <option key={type} value={type}>
                  {type} JOIN
                </option>
              ))}
            </select>
          </div>

          {/* Tabela de Origem */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Tabela de Origem <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Selecione a tabela ou VIEW que já está na query e será a origem do JOIN
            </p>
            {preselectedSourceTableId && !isEditing && (
              <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-900 dark:text-blue-100">
                <strong>ℹ️ Tabela pré-selecionada:</strong> A primeira tabela da query foi automaticamente selecionada como origem.
              </div>
            )}
            <select
              value={sourceTableId}
              onChange={e => {
                setSourceTableId(e.target.value);
                // Resetar todas as condições ao mudar tabela de origem
                setConditions([{ id: `cond-${Date.now()}`, sourceColumn: '', targetColumn: '' }]);
              }}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableSourceTables.length === 0 ? (
                <option value="">Nenhuma tabela disponível</option>
              ) : (
                availableSourceTables.map(tableId => {
                  const tableName = getTableDisplayName(tableId);
                  return (
                    <option key={tableId} value={tableId}>
                      {tableName}
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {/* Tabela de Destino */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tabela de Destino <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Selecione uma tabela/VIEW ou use um subselect como destino
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setUseSubqueryAsTarget(!useSubqueryAsTarget);
                  if (!useSubqueryAsTarget) {
                    // Ao ativar subselect, limpar seleção de tabela
                    setTargetTableId('');
                    setConditions([{ id: `cond-${Date.now()}`, sourceColumn: '', targetColumn: '' }]);
                  } else {
                    // Ao desativar subselect, limpar subselect
                    setTargetSubquery(null);
                    setTargetSubqueryAlias('');
                  }
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  useSubqueryAsTarget
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
                title={useSubqueryAsTarget ? 'Usar tabela/VIEW como destino' : 'Usar subselect como destino'}
              >
                <Code className="h-3.5 w-3.5" />
                {useSubqueryAsTarget ? 'Usar Tabela' : 'Usar Subselect'}
              </button>
            </div>
            
            {preselectedTargetTableId && !isEditing && !useSubqueryAsTarget && (
              <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-900 dark:text-blue-100">
                <strong>ℹ️ VIEW pré-selecionada:</strong> A VIEW que você arrastou foi automaticamente selecionada como destino.
              </div>
            )}

            {useSubqueryAsTarget ? (
              <div className="space-y-3">
                {targetSubquery ? (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-medium text-green-900 dark:text-green-100">
                          Subselect configurado
                        </span>
                        <span className="text-xs bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                          Alias: {targetSubqueryAlias || 'não definido'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingSubquery(true)}
                        className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-1"
                        title="Editar subselect"
                      >
                        <Code className="h-3 w-3" />
                        Editar
                      </button>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Subselect criado com sucesso. Configure as condições de JOIN abaixo.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200 mb-2">
                      Nenhum subselect configurado
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditingSubquery(true)}
                      className="px-3 py-2 text-sm font-medium bg-yellow-600 text-white rounded hover:bg-yellow-700 flex items-center gap-2"
                      title="Criar subselect"
                    >
                      <Code className="h-4 w-4" />
                      Criar Subselect
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <select
                value={targetTableId}
                onChange={e => {
                  setTargetTableId(e.target.value);
                  // Resetar todas as condições ao mudar tabela de destino
                  setConditions([{ id: `cond-${Date.now()}`, sourceColumn: '', targetColumn: '' }]);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Selecione uma tabela ou VIEW</option>
                {availableTargetTables.map(table => {
                  const isPreselected = table.id === preselectedTargetTableId;
                  return (
                    <option key={table.id} value={table.id}>
                      {isPreselected ? '⭐ ' : ''}{table.name}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          {/* Condições de JOIN (múltiplas com AND) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Condições de JOIN (AND) <span className="text-red-500">*</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Defina como as tabelas serão relacionadas. Você pode adicionar múltiplas condições que serão combinadas com AND.
                </p>
              </div>
              <button
                onClick={addCondition}
                className="px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
                title="Adicionar condição"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar Condição
              </button>
            </div>
            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={condition.id} className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-8 flex-shrink-0">
                    {index + 1}.
                  </span>
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Coluna Origem <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={condition.sourceColumn}
                        onChange={e => updateCondition(condition.id, 'sourceColumn', e.target.value)}
                        disabled={!sourceTableId}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Selecione...</option>
                        {sourceColumns.map(col => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Coluna Destino <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={condition.targetColumn}
                        onChange={e => updateCondition(condition.id, 'targetColumn', e.target.value)}
                        disabled={useSubqueryAsTarget ? (!targetSubquery || !targetSubqueryAlias) : !targetTableId}
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">Selecione...</option>
                        {targetColumns.map(col => (
                          <option key={col.name} value={col.name}>
                            {col.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {conditions.length > 1 && (
                    <button
                      onClick={() => removeCondition(condition.id)}
                      className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex-shrink-0"
                      title="Remover condição"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Preview */}
          {sourceTableId && (targetTableId || (useSubqueryAsTarget && targetSubquery)) && conditions.some(c => c.sourceColumn && c.targetColumn) && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-mono text-blue-900 dark:text-blue-100">
                {joinType} JOIN {
                  useSubqueryAsTarget && targetSubquery
                    ? `(SELECT ...) AS ${targetSubqueryAlias || 'sub'}`
                    : `${getTableDisplayName(targetTableId)} AS ${generateApproximateAlias(targetTableId)}`
                }
                <br />
                ON {conditions.filter(c => c.sourceColumn && c.targetColumn).map((c, idx) => {
                  const sourceAlias = generateApproximateAlias(sourceTableId);
                  const targetAlias = useSubqueryAsTarget && targetSubquery
                    ? (targetSubqueryAlias || 'sub')
                    : generateApproximateAlias(targetTableId);
                  const sourceColEscaped = c.sourceColumn.includes('[') || c.sourceColumn.includes('`') 
                    ? c.sourceColumn 
                    : `[${c.sourceColumn}]`;
                  const targetColEscaped = c.targetColumn.includes('[') || c.targetColumn.includes('`')
                    ? c.targetColumn
                    : `[${c.targetColumn}]`;
                  return (
                    <span key={c.id}>
                      {idx > 0 && ' AND '}
                      {sourceAlias}.{sourceColEscaped} = {targetAlias}.{targetColEscaped}
                    </span>
                  );
                })}
              </p>
            </div>
          )}

          {/* Subquery Builder Dialog */}
          {editingSubquery && (
            <SubqueryBuilder
              initialAST={targetSubquery || null}
              onSave={(subqueryAST) => {
                // Gerar alias único para o subselect
                const alias = targetSubqueryAlias || `sub${Date.now().toString().slice(-3)}`;
                setTargetSubquery(subqueryAST);
                setTargetSubqueryAlias(alias);
                setEditingSubquery(false);
              }}
              onCancel={() => setEditingSubquery(false)}
              nodes={nodes}
              edges={edges}
              dbType={dbType}
              title="Subselect no JOIN (Tabela de Destino)"
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={
              !sourceTableId || 
              !conditions.some(c => c.sourceColumn && c.targetColumn) ||
              (!useSubqueryAsTarget && !targetTableId) ||
              (useSubqueryAsTarget && (!targetSubquery || !targetSubqueryAlias))
            }
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isEditing ? (
              <>
                <X className="h-4 w-4 rotate-45" />
                Salvar Alterações
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Criar JOIN
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

