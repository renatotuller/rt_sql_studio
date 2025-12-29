/**
 * Página principal do Query Builder
 * Interface visual para construção de queries SQL
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Copy, Check, Play, RotateCcw, Code, Database, 
  ChevronRight, Loader2, AlertCircle, Download
} from 'lucide-react';
import { schemaApi, connectionsApi, queryApi, type GraphNode, type GraphEdge, type Column } from '../api/client';
import { useQueryBuilder } from '../hooks/useQueryBuilder';
import { formatSQL } from '../utils/query-builder/sql-formatter';
import TableExplorer from '../components/query-builder/TableExplorer';
import SelectList from '../components/query-builder/SelectList';
import SelectDropZone from '../components/query-builder/SelectDropZone';
import JoinEditor from '../components/query-builder/JoinEditor';
import WhereEditor from '../components/query-builder/WhereEditor';
import GroupByEditor from '../components/query-builder/GroupByEditor';
import OrderByEditor from '../components/query-builder/OrderByEditor';
import QueryClauseButtons from '../components/query-builder/QueryClauseButtons';
import QueryClauseDialog from '../components/query-builder/QueryClauseDialog';
import ViewSwitcher from '../components/ViewSwitcher';
import InformativeLoading from '../components/InformativeLoading';
import type { JoinType, QueryAST, WhereCondition } from '../types/query-builder';

type ActiveDialog = 'none' | 'joins' | 'where' | 'groupBy' | 'orderBy';

export default function QueryBuilder() {
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  
  // Estados de carregamento e erro
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState('');
  const [dbType, setDbType] = useState<'mysql' | 'sqlserver'>('mysql');
  
  // Dados do grafo
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  
  // Estados da UI
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>('none');
  const [copied, setCopied] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  
  // Pending column para adicionar após JOIN ser criado
  const pendingViewColumnRef = useRef<{ tableId: string; column: Column } | null>(null);
  
  // Callback quando JOIN é criado
  const handleJoinCreated = useCallback((targetTableId: string) => {
    // Se há coluna pendente para adicionar
    if (pendingViewColumnRef.current) {
      const { tableId, column } = pendingViewColumnRef.current;
      // Verificar se o JOIN foi criado para a tabela certa
      if (tableId === targetTableId) {
        // Adiar para próximo tick para garantir que o estado foi atualizado
        setTimeout(() => {
          // A coluna será adicionada pelo hook
        }, 0);
      }
      pendingViewColumnRef.current = null;
    }
  }, []);
  
  // Hook do Query Builder
  const queryBuilder = useQueryBuilder({
    nodes,
    edges,
    dbType,
    onJoinCreated: handleJoinCreated,
  });
  
  const {
    ast,
    sql,
    tableAliases,
    includedTables,
    setBaseTable,
    addColumn,
    removeColumn,
    updateColumnAlias,
    reorderColumns,
    addManualJoin,
    updateJoin,
    removeJoin,
    addWhereCondition,
    updateWhereCondition,
    removeWhereCondition,
    reorderWhereConditions,
    addGroupBy,
    removeGroupBy,
    reorderGroupBy,
    addOrderBy,
    removeOrderBy,
    updateOrderBy,
    reorderOrderBy,
    reset,
  } = queryBuilder;
  
  // Carregar dados
  useEffect(() => {
    if (connId) {
      loadData();
    }
  }, [connId]);
  
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Carregar conexão
      const connResponse = await connectionsApi.get(connId!);
      setConnectionName(connResponse.data.name);
      setDbType(connResponse.data.type);
      
      // Carregar grafo
      const graphResponse = await schemaApi.getGraph(connId!);
      setNodes(graphResponse.data.nodes);
      setEdges(graphResponse.data.edges);
      
    } catch (err: any) {
      console.error('Erro ao carregar dados:', err);
      setError(err.response?.data?.error || err.message || 'Erro ao carregar schema');
    } finally {
      setLoading(false);
    }
  };
  
  // Handlers
  const handleToggleExpand = (tableId: string) => {
    setExpandedTables(prev => {
      const next = new Set(prev);
      if (next.has(tableId)) {
        next.delete(tableId);
      } else {
        next.add(tableId);
      }
      return next;
    });
  };
  
  const handleColumnDragStart = (tableId: string, column: Column) => {
    // Armazenar informação da coluna sendo arrastada
    console.log('Drag start:', tableId, column.name);
  };
  
  const handleColumnDrop = (tableId: string, columnName: string) => {
    // Se não há tabela base, definir esta como base
    if (!ast.from.table) {
      setBaseTable(tableId);
    }
    
    // Adicionar coluna
    addColumn(tableId, columnName);
  };
  
  const handleCopy = async () => {
    if (!sql) return;
    await navigator.clipboard.writeText(formatSQL(sql));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  const handleExecute = async () => {
    if (!sql || !connId) return;
    
    setExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);
    
    try {
      const response = await queryApi.execute(connId, sql);
      setExecutionResult(response.data);
    } catch (err: any) {
      console.error('Erro ao executar query:', err);
      setExecutionError(err.response?.data?.error || err.message || 'Erro ao executar query');
    } finally {
      setExecuting(false);
    }
  };
  
  const handleReset = () => {
    if (confirm('Tem certeza que deseja limpar a query atual?')) {
      reset();
      setExecutionResult(null);
      setExecutionError(null);
    }
  };
  
  const handleExportSQL = () => {
    if (!sql) return;
    
    const blob = new Blob([formatSQL(sql)], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_${new Date().toISOString().slice(0, 10)}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  // Loading state
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <InformativeLoading 
          message="Carregando schema do banco de dados"
          type="schema"
          estimatedTime={10}
        />
      </div>
    );
  }
  
  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Erro ao carregar schema
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <div className="flex gap-2 justify-center">
            <button onClick={loadData} className="btn btn-primary">
              Tentar Novamente
            </button>
            <button onClick={() => navigate('/connections')} className="btn btn-secondary">
              Voltar
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              Query Builder: {connectionName}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              title="Limpar query"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              onClick={handleExportSQL}
              disabled={!sql}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 
                       hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar SQL"
            >
              <Download className="h-4 w-4" />
            </button>
            <button
              onClick={handleCopy}
              disabled={!sql}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                       bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300
                       hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button
              onClick={handleExecute}
              disabled={!sql || executing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium
                       bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors
                       disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {executing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {executing ? 'Executando...' : 'Executar'}
            </button>
          </div>
        </div>
        
        {/* View Switcher e Clause Buttons */}
        <div className="flex items-center justify-between">
          <ViewSwitcher currentView="query-builder" />
          <QueryClauseButtons
            whereCount={ast.where?.conditions.length || 0}
            groupByCount={ast.groupBy?.fields.length || 0}
            orderByCount={ast.orderBy?.fields.length || 0}
            joinsCount={ast.joins.length}
            onOpenWhere={() => setActiveDialog('where')}
            onOpenGroupBy={() => setActiveDialog('groupBy')}
            onOpenOrderBy={() => setActiveDialog('orderBy')}
            onOpenJoins={() => setActiveDialog('joins')}
          />
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Table Explorer */}
        <div className="w-72 flex-shrink-0 border-r border-gray-200 dark:border-gray-700 overflow-hidden">
          <TableExplorer
            nodes={nodes}
            expandedTables={expandedTables}
            onToggleExpand={handleToggleExpand}
            onColumnDragStart={handleColumnDragStart}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            includedTables={includedTables}
            baseTableId={ast.from.table}
          />
        </div>
        
        {/* Center Panel - SELECT and Drop Zone */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Drop Zone */}
          <div className="flex-shrink-0 p-4 border-b border-gray-200 dark:border-gray-700">
            <SelectDropZone
              onDrop={handleColumnDrop}
              hasBaseTable={!!ast.from.table}
            />
          </div>
          
          {/* SELECT List */}
          <div className="flex-1 overflow-hidden">
            <SelectList
              fields={ast.select.fields}
              onReorder={reorderColumns}
              onRemove={removeColumn}
              onEditAlias={updateColumnAlias}
              tableAliases={tableAliases}
            />
          </div>
        </div>
        
        {/* Right Panel - SQL Preview */}
        <div className="w-96 flex-shrink-0 border-l border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Code className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              SQL Gerado
            </h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {sql ? (
              <pre className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                {formatSQL(sql)}
              </pre>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Arraste colunas para gerar SQL</p>
              </div>
            )}
          </div>
          
          {/* Execution Result */}
          {(executionResult || executionError) && (
            <div className="border-t border-gray-200 dark:border-gray-700 max-h-48 overflow-y-auto">
              {executionError ? (
                <div className="p-3 bg-red-50 dark:bg-red-900/20">
                  <p className="text-sm text-red-600 dark:text-red-400">{executionError}</p>
                </div>
              ) : executionResult && (
                <div className="p-3">
                  <p className="text-xs text-gray-500 mb-2">
                    {executionResult.totalRows} resultado(s)
                  </p>
                  {executionResult.rows.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800">
                            {executionResult.columns.map((col: string) => (
                              <th key={col} className="px-2 py-1 text-left font-medium text-gray-600 dark:text-gray-400">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {executionResult.rows.slice(0, 10).map((row: any, idx: number) => (
                            <tr key={idx} className="border-t border-gray-100 dark:border-gray-700">
                              {executionResult.columns.map((col: string) => (
                                <td key={col} className="px-2 py-1 text-gray-800 dark:text-gray-200">
                                  {row[col] !== null && row[col] !== undefined ? String(row[col]) : 
                                    <span className="text-gray-400 italic">NULL</span>}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Dialogs */}
      <QueryClauseDialog
        isOpen={activeDialog === 'joins'}
        onClose={() => setActiveDialog('none')}
        title="Gerenciar JOINs"
        width="xl"
      >
        <JoinEditor
          joins={ast.joins}
          onUpdate={updateJoin}
          onRemove={removeJoin}
          onAddManual={addManualJoin}
          baseTableId={ast.from.table}
          baseTableAlias={ast.from.alias}
          nodes={nodes}
          edges={edges}
          dbType={dbType}
        />
      </QueryClauseDialog>
      
      <QueryClauseDialog
        isOpen={activeDialog === 'where'}
        onClose={() => setActiveDialog('none')}
        title="Condições WHERE"
        width="xl"
      >
        <WhereEditor
          conditions={ast.where?.conditions || []}
          onAdd={addWhereCondition}
          onUpdate={updateWhereCondition}
          onRemove={removeWhereCondition}
          onReorder={reorderWhereConditions}
          nodes={nodes}
          edges={edges}
          dbType={dbType}
          availableTables={includedTables}
          tableAliases={tableAliases}
        />
      </QueryClauseDialog>
      
      <QueryClauseDialog
        isOpen={activeDialog === 'groupBy'}
        onClose={() => setActiveDialog('none')}
        title="Agrupamento (GROUP BY)"
      >
        <GroupByEditor
          fields={ast.groupBy?.fields || []}
          onAdd={addGroupBy}
          onRemove={removeGroupBy}
          onReorder={reorderGroupBy}
          nodes={nodes}
          availableTables={includedTables}
          tableAliases={tableAliases}
        />
      </QueryClauseDialog>
      
      <QueryClauseDialog
        isOpen={activeDialog === 'orderBy'}
        onClose={() => setActiveDialog('none')}
        title="Ordenação (ORDER BY)"
      >
        <OrderByEditor
          fields={ast.orderBy?.fields || []}
          onAdd={addOrderBy}
          onRemove={removeOrderBy}
          onUpdate={updateOrderBy}
          onReorder={reorderOrderBy}
          nodes={nodes}
          availableTables={includedTables}
          tableAliases={tableAliases}
        />
      </QueryClauseDialog>
    </div>
  );
}
