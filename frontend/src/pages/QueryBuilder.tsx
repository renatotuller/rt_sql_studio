/**
 * Página principal do Query Builder
 * Interface visual para construção de queries SQL
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Button, 
  Box, 
  useTheme, 
  alpha, 
  CircularProgress,
  Typography,
  IconButton,
  Paper,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import {
  Check as CheckIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Code as CodeIcon,
  ArrowBack as ArrowBackIcon,
  Upload as UploadIcon,
  PlayArrow as PlayIcon,
  RotateLeft as RotateLeftIcon,
  Storage as DatabaseIcon,
  ErrorOutline as AlertCircleIcon,
  Link as LinkIcon,
  FilterList as FilterIcon,
  Layers as LayersIcon,
  SwapVert as ArrowUpDownIcon,
  Visibility as EyeIcon,
  AccountTree as GitBranchIcon,
  Description as FileCodeIcon,
  KeyboardArrowDown as ChevronDownIcon,
  Star as StarIcon,
  Refresh as RefreshIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import * as XLSX from 'xlsx';
import { schemaApi, connectionsApi, queryApi, type GraphNode, type GraphEdge, type Column } from '../api/client';
import { useQueryBuilder } from '../hooks/useQueryBuilder';
import { formatSQL } from '../utils/query-builder/sql-formatter';
import TableExplorer from '../components/query-builder/TableExplorer';
import SelectList from '../components/query-builder/SelectList';
import JoinEditor from '../components/query-builder/JoinEditor';
import WhereEditor from '../components/query-builder/WhereEditor';
import GroupByEditor from '../components/query-builder/GroupByEditor';
import OrderByEditor from '../components/query-builder/OrderByEditor';
import CTEEditor from '../components/query-builder/CTEEditor';
import QueryClauseDialog from '../components/query-builder/QueryClauseDialog';
import SavedQueriesDialog from '../components/query-builder/SavedQueriesDialog';
import QueryGraphViewer from '../components/query-builder/QueryGraphViewer';
import ViewSwitcher from '../components/ViewSwitcher';
import InformativeLoading from '../components/InformativeLoading';
import type { JoinType, QueryAST, WhereCondition, CTEClause } from '../types/query-builder';

type ActiveDialog = 'none' | 'joins' | 'where' | 'groupBy' | 'orderBy' | 'sql' | 'cte' | 'union';
type ResultTab = 'resultados' | 'grafo' | 'explain';

export default function QueryBuilder() {
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  
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
  const [activeTab, setActiveTab] = useState<ResultTab>('resultados');
  const [copied, setCopied] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [explainResult, setExplainResult] = useState<any>(null);
  const [explainError, setExplainError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [resultLimit, setResultLimit] = useState(100);
  const [refreshing, setRefreshing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [customFieldDialogOpen, setCustomFieldDialogOpen] = useState(false);
  const [customExpression, setCustomExpression] = useState('');
  const [customAlias, setCustomAlias] = useState('');
  const [savedQueriesDialogOpen, setSavedQueriesDialogOpen] = useState(false);
  const [importSQLDialogOpen, setImportSQLDialogOpen] = useState(false);
  const [importSQL, setImportSQL] = useState('');
  const [autoExecuteOnDrop, setAutoExecuteOnDrop] = useState(false);
  const autoExecuteCounterRef = useRef(0);
  const isProcessingDropRef = useRef(false);
  const lastFieldsCountRef = useRef(0);
  const lastSQLRef = useRef('');
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  // Pending column para adicionar após JOIN ser criado
  const pendingViewColumnRef = useRef<{ tableId: string; column: Column } | null>(null);
  const pendingColumnRef = useRef<{ tableId: string; column: string } | null>(null);
  const [pendingJoinTableId, setPendingJoinTableId] = useState<string | null>(null);
  
  // Callback quando não encontra relacionamento
  const handleMissingJoin = useCallback((targetTableId: string, sourceTableId: string) => {
    setPendingJoinTableId(targetTableId);
    // Abrir o dialog de JOINs automaticamente
    setActiveDialog('joins');
  }, []);
  
  // Hook do Query Builder
  const queryBuilder = useQueryBuilder({
    nodes,
    edges,
    dbType,
    onMissingJoin: handleMissingJoin,
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
    addExpression,
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
    addCTE,
    updateCTE,
    removeCTE,
    reset,
    loadAST,
  } = queryBuilder;
  
  // Callback quando JOIN é criado (definido após addColumn estar disponível)
  const handleJoinCreated = useCallback((targetTableId: string) => {
    if (pendingViewColumnRef.current) {
      const { tableId, column } = pendingViewColumnRef.current;
      if (tableId === targetTableId) {
        setTimeout(() => {
          // A coluna será adicionada pelo hook
        }, 0);
      }
      pendingViewColumnRef.current = null;
    }
    // Adicionar coluna pendente quando JOIN é criado
    if (pendingColumnRef.current && pendingColumnRef.current.tableId === targetTableId) {
      const { tableId, column } = pendingColumnRef.current;
      setTimeout(() => {
        addColumn(tableId, column);
        pendingColumnRef.current = null;
      }, 100);
    }
    // Limpar tabela pendente quando JOIN é criado
    if (pendingJoinTableId === targetTableId) {
      setPendingJoinTableId(null);
    }
  }, [pendingJoinTableId, addColumn]);

  // Estado para queries salvas
  const [savedQueries, setSavedQueries] = useState<Array<{
    id: string;
    name: string;
    description?: string;
    sql: string;
    ast: QueryAST;
    createdAt: Date;
    updatedAt: Date;
  }>>([]);

  // Carregar queries salvas do localStorage
  useEffect(() => {
    if (connId) {
      const key = `saved_queries_${connId}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setSavedQueries(parsed.map((q: any) => ({
            ...q,
            createdAt: new Date(q.createdAt),
            updatedAt: new Date(q.updatedAt),
          })));
        } catch (e) {
          console.error('Erro ao carregar queries salvas:', e);
        }
      }
    }
  }, [connId]);

  // Funções para gerenciar queries salvas
  const handleSaveQuery = (name: string, description?: string) => {
    if (!connId || !sql || !ast) return;
    
    const newQuery = {
      id: `query_${Date.now()}_${Math.random()}`,
      name,
      description,
      sql,
      ast: JSON.parse(JSON.stringify(ast)), // Deep copy
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    const updated = [...savedQueries, newQuery];
    setSavedQueries(updated);
    
    const key = `saved_queries_${connId}`;
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleLoadQuery = (queryAST: QueryAST) => {
    loadAST(queryAST);
    setSavedQueriesDialogOpen(false);
  };

  const handleDeleteQuery = (id: string) => {
    if (!connId) return;
    
    const updated = savedQueries.filter(q => q.id !== id);
    setSavedQueries(updated);
    
    const key = `saved_queries_${connId}`;
    localStorage.setItem(key, JSON.stringify(updated));
  };

  const handleUpdateQuery = (id: string, name: string, description?: string) => {
    if (!connId || !sql || !ast) return;
    
    const updated = savedQueries.map(q => 
      q.id === id 
        ? { ...q, name, description, sql, ast: JSON.parse(JSON.stringify(ast)), updatedAt: new Date() }
        : q
    );
    setSavedQueries(updated);
    
    const key = `saved_queries_${connId}`;
    localStorage.setItem(key, JSON.stringify(updated));
  };
  
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
    console.log('Drag start:', tableId, column.name);
  };
  
  const handleColumnDrop = (tableId: string, columnName: string) => {
    // Proteção contra múltiplas chamadas simultâneas
    if (isProcessingDropRef.current) {
      console.log('Drop já está sendo processado, ignorando...');
      return;
    }
    
    isProcessingDropRef.current = true;
    
    // Se não há tabela base, definir esta como base
    if (!ast.from.table) {
      setBaseTable(tableId);
      // Se acabou de definir a tabela base, adicionar a coluna diretamente
      setTimeout(() => {
        addColumn(tableId, columnName);
        // Incrementar contador para forçar nova execução
        autoExecuteCounterRef.current += 1;
        // Aguardar mais tempo para garantir que o SQL foi gerado pelo useMemo
        setTimeout(() => {
          // Verificar novamente se o SQL foi gerado antes de setar a flag
          if (sql && sql.trim().length > 0) {
            setAutoExecuteOnDrop(true);
          }
          isProcessingDropRef.current = false;
        }, 300);
      }, 100);
      return;
    }
    
    // Armazenar coluna pendente caso precise de JOIN manual
    pendingColumnRef.current = { tableId, column: columnName };
    
    // Verificar se a coluna já existe antes de adicionar
    const columnExists = ast.select.fields.some(f => f.tableId === tableId && f.column === columnName);
    
    // Adicionar coluna (pode retornar sem adicionar se precisar de JOIN manual)
    addColumn(tableId, columnName);
    
    // Marcar para executar automaticamente após o SQL ser gerado (se coluna foi adicionada)
    // Usar um delay maior para garantir que o SQL foi atualizado
    setTimeout(() => {
      const wasAdded = ast.select.fields.some(f => f.tableId === tableId && f.column === columnName);
      if (wasAdded && !columnExists) {
        // Incrementar contador para forçar nova execução
        autoExecuteCounterRef.current += 1;
        // Aguardar mais tempo para garantir que o SQL foi gerado pelo useMemo
        setTimeout(() => {
          setAutoExecuteOnDrop(true);
          isProcessingDropRef.current = false;
        }, 300);
      } else {
        isProcessingDropRef.current = false;
      }
    }, 150);
  };

  // Executar automaticamente quando SQL for gerado após um drop
  useEffect(() => {
    if (autoExecuteOnDrop && sql && sql.trim().length > 0 && connId && !executing && ast.select.fields.length > 0) {
      const currentCounter = autoExecuteCounterRef.current;
      const currentSQL = sql; // Capturar SQL atual
      
      console.log('🔄 [Auto-exec] Disparando execução automática...', {
        counter: currentCounter,
        sqlLength: currentSQL.length,
        fieldsCount: ast.select.fields.length,
      });
      
      // Resetar flag imediatamente para permitir próximas execuções
      setAutoExecuteOnDrop(false);
      
      // Pequeno delay para garantir que o SQL foi completamente gerado
      const timer = setTimeout(async () => {
        // Verificar se ainda é a mesma execução (evitar execuções duplicadas)
        if (currentCounter !== autoExecuteCounterRef.current) {
          console.log('⏭️ [Auto-exec] Execução cancelada - contador mudou');
          return;
        }
        
        // Verificar novamente as condições antes de executar
        if (!currentSQL || !connId || executing) {
          console.log('⏭️ [Auto-exec] Execução cancelada - condições não atendidas');
          return;
        }
        
        console.log('▶️ [Auto-exec] Executando query...');
        setExecuting(true);
        setExecutionError(null);
        setExecutionResult(null);
        setActiveTab('resultados');
        
        try {
          const limit = resultLimit === -1 ? undefined : resultLimit;
          const response = await queryApi.execute(connId, currentSQL, limit);
          setExecutionResult(response.data);
          console.log('✅ [Auto-exec] Query executada com sucesso');
        } catch (err: any) {
          console.error('❌ [Auto-exec] Erro ao executar query:', err);
          setExecutionError(err.response?.data?.error || err.message || 'Erro ao executar query');
        } finally {
          setExecuting(false);
        }
      }, 400);
      
      return () => clearTimeout(timer);
    }
  }, [autoExecuteOnDrop, sql, connId, executing, ast.select.fields.length, resultLimit]);
  
  // Monitorar mudanças no AST e SQL para detectar quando uma coluna foi adicionada
  useEffect(() => {
    const fieldsCount = ast.select.fields.length;
    const currentSQL = sql;
    
    // Se uma nova coluna foi adicionada e o SQL mudou
    if (fieldsCount > lastFieldsCountRef.current && currentSQL !== lastSQLRef.current && currentSQL.trim().length > 0) {
      // Verificar se estamos processando um drop
      if (isProcessingDropRef.current) {
        console.log('🔍 [Auto-exec] Nova coluna detectada, aguardando flag...', {
          fieldsCount,
          lastCount: lastFieldsCountRef.current,
          sqlLength: currentSQL.length,
        });
        
        // Aguardar um pouco e verificar se a flag foi setada
        setTimeout(() => {
          if (!autoExecuteOnDrop && isProcessingDropRef.current) {
            console.log('🚀 [Auto-exec] Flag não foi setada, setando agora...');
            autoExecuteCounterRef.current += 1;
            setAutoExecuteOnDrop(true);
          }
        }, 100);
      }
    }
    
    lastFieldsCountRef.current = fieldsCount;
    lastSQLRef.current = currentSQL;
  }, [ast.select.fields.length, sql, autoExecuteOnDrop]);
  
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
    setActiveTab('resultados');
    
    try {
      // Se resultLimit for -1 (Todos), não passar limite (ou passar um valor muito alto)
      const limit = resultLimit === -1 ? undefined : resultLimit;
      const response = await queryApi.execute(connId, sql, limit);
      setExecutionResult(response.data);
    } catch (err: any) {
      console.error('Erro ao executar query:', err);
      setExecutionError(err.response?.data?.error || err.message || 'Erro ao executar query');
    } finally {
      setExecuting(false);
    }
  };
  
  const handleExplain = async () => {
    if (!sql || !connId) return;
    
    setExplaining(true);
    setExplainError(null);
    setExplainResult(null);
    setActiveTab('explain');
    
    try {
      const explainSQL = dbType === 'mysql' 
        ? `EXPLAIN ${sql}`
        : `SET SHOWPLAN_ALL ON; ${sql}`;
      
      const response = await queryApi.execute(connId, explainSQL);
      setExplainResult(response.data);
    } catch (err: any) {
      console.error('Erro ao executar EXPLAIN:', err);
      setExplainError(err.response?.data?.error || err.message || 'Erro ao executar EXPLAIN');
    } finally {
      setExplaining(false);
    }
  };
  
  const handleReset = () => {
    if (confirm('Tem certeza que deseja limpar a query atual?')) {
      reset();
      setExecutionResult(null);
      setExecutionError(null);
      setExplainResult(null);
      setExplainError(null);
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
  
  const handleImportSQL = () => {
    setImportSQLDialogOpen(true);
    setImportSQL('');
  };

  const handleExecuteImportedSQL = async () => {
    if (!importSQL.trim() || !connId) return;
    
    setImportSQLDialogOpen(false);
    setActiveTab('resultados');
    setExecuting(true);
    setExecutionError(null);
    setExecutionResult(null);
    
    try {
      // Se resultLimit for -1 (Todos), não passar limite (ou passar um valor muito alto)
      const limit = resultLimit === -1 ? undefined : resultLimit;
      const response = await queryApi.execute(connId, importSQL.trim(), limit);
      setExecutionResult(response.data);
    } catch (err: any) {
      console.error('Erro ao executar SQL importado:', err);
      setExecutionError(err.response?.data?.error || err.message || 'Erro ao executar query');
    } finally {
      setExecuting(false);
    }
  };

  const handleRefreshSchema = async () => {
    if (!connId || refreshing) return;
    
    setRefreshing(true);
    try {
      const response = await schemaApi.refresh(connId);
      if (response.data.cacheMetadata) {
        // Recarregar os dados do grafo
        const graphResponse = await schemaApi.getGraph(connId);
        setNodes(graphResponse.data.nodes);
        setEdges(graphResponse.data.edges);
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Erro ao atualizar estrutura');
    } finally {
      setRefreshing(false);
    }
  };
  
  // Fechar menu de exportação ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    
    if (exportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [exportMenuOpen]);
  
  const handleExportCSV = () => {
    if (!executionResult || !executionResult.rows || executionResult.rows.length === 0) {
      alert('Nenhum resultado para exportar');
      return;
    }
    
    const headers = executionResult.columns;
    const rows = executionResult.rows.map((row: any) => 
      headers.map((col: string) => {
        const value = row[col];
        // Escapar valores que contêm ponto e vírgula ou aspas
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      })
    );
    
    const csvContent = [
      headers.join(';'),
      ...rows.map((row: string[]) => row.join(';'))
    ].join('\n');
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  };
  
  const handleExportExcel = (format: 'xlsx' | 'xls') => {
    if (!executionResult || !executionResult.rows || executionResult.rows.length === 0) {
      alert('Nenhum resultado para exportar');
      return;
    }
    
    const headers = executionResult.columns;
    const data = [
      headers,
      ...executionResult.rows.map((row: any) => 
        headers.map((col: string) => row[col] ?? '')
      )
    ];
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resultados');
    
    const excelType = format === 'xlsx' ? 'xlsx' : 'xls';
    const mimeType = format === 'xlsx' 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.ms-excel';
    
    XLSX.writeFile(wb, `query_results_${new Date().toISOString().slice(0, 10)}.${excelType}`);
    setExportMenuOpen(false);
  };
  
  // Loading state
  if (loading) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <InformativeLoading 
          message="Carregando schema do banco de dados"
          type="schema"
          estimatedTime={10}
        />
      </Box>
    );
  }
  
  // Error state
  if (error) {
    return (
      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ textAlign: 'center', maxWidth: 500, px: 2 }}>
          <AlertCircleIcon sx={{ fontSize: 48, color: 'error.main', mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
            Erro ao carregar schema
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {error}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
            <Button onClick={loadData} variant="contained" size="small">
              Tentar Novamente
            </Button>
            <Button onClick={() => navigate('/connections')} variant="outlined" size="small">
              Voltar
            </Button>
          </Box>
        </Box>
      </Box>
    );
  }
  
  const baseTableAlias = ast.from.alias || (ast.from.table ? tableAliases.get(ast.from.table) : '');
  
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top Bar com título e botões de ação */}
      <Box 
        sx={{ 
          flexShrink: 0, 
          px: 2, 
          py: 0.5, 
          borderBottom: 1, 
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <IconButton
            onClick={() => navigate(`/schema/${connId}`)}
            size="small"
            sx={{
              p: 0.5,
              color: 'text.secondary',
              '&:hover': {
                color: 'text.primary',
                bgcolor: 'action.hover',
              },
            }}
          >
            <ArrowBackIcon sx={{ fontSize: 14 }} />
          </IconButton>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.2 }}>
            Query Builder: {connectionName}
          </Typography>
        </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              onClick={handleRefreshSchema}
              disabled={refreshing}
              variant="outlined"
              size="small"
              startIcon={
                refreshing ? (
                  <CircularProgress size={12} color="inherit" />
                ) : (
                  <RefreshIcon sx={{ fontSize: 12 }} />
                )
              }
              sx={{
                px: 1.5,
                py: 0.25,
                minHeight: 'auto',
                fontSize: '0.6875rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 1.5,
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.divider,
                  backgroundColor: alpha(theme.palette.action.hover, 0.04),
                },
                '&.Mui-disabled': {
                  borderColor: theme.palette.action.disabledBackground,
                  color: theme.palette.action.disabled,
                },
              }}
            >
              Atualizar Schema
            </Button>
            <Button
              onClick={handleExecute}
              disabled={executing || !sql}
              variant="contained"
              size="small"
                startIcon={
                executing ? (
                  <CircularProgress size={12} color="inherit" />
                ) : (
                  <PlayIcon sx={{ fontSize: 12 }} />
                )
              }
              sx={{
                px: 1.5,
                py: 0.25,
                minHeight: 'auto',
                fontSize: '0.6875rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 1.5,
                backgroundColor: theme.palette.primary.main,
                color: theme.palette.primary.contrastText,
                '&:hover': {
                  backgroundColor: theme.palette.primary.dark,
                },
                '&.Mui-disabled': {
                  backgroundColor: theme.palette.action.disabledBackground,
                  color: theme.palette.action.disabled,
                },
              }}
            >
              Executar
            </Button>
            <Button
              onClick={handleExplain}
              disabled={explaining || !sql}
              variant="contained"
              size="small"
              startIcon={
                explaining ? (
                  <CircularProgress size={12} color="inherit" />
                ) : (
                  <EyeIcon sx={{ fontSize: 12 }} />
                )
              }
              sx={{
                px: 1.5,
                py: 0.25,
                minHeight: 'auto',
                fontSize: '0.6875rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 1.5,
                backgroundColor: '#60A5FA',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#3B82F6',
                },
                '&.Mui-disabled': {
                  backgroundColor: theme.palette.action.disabledBackground,
                  color: theme.palette.action.disabled,
                },
              }}
            >
              EXPLAIN
            </Button>
            <Button
              onClick={() => setSavedQueriesDialogOpen(true)}
              variant="contained"
              size="small"
              startIcon={<StarIcon sx={{ fontSize: 12 }} />}
              sx={{
                px: 1.5,
                py: 0.25,
                minHeight: 'auto',
                fontSize: '0.6875rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 1.5,
                backgroundColor: '#F97316',
                color: 'white',
                '&:hover': {
                  backgroundColor: '#EA580C',
                },
              }}
            >
              Salvas
            </Button>
            <Button
              onClick={handleCopy}
              disabled={!sql}
              variant="outlined"
              size="small"
              startIcon={copied ? <CheckIcon sx={{ fontSize: 12 }} /> : <CopyIcon sx={{ fontSize: 12 }} />}
              sx={{
                px: 1.5,
                py: 0.25,
                minHeight: 'auto',
                fontSize: '0.6875rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 1.5,
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.divider,
                  backgroundColor: alpha(theme.palette.action.hover, 0.04),
                },
                '&.Mui-disabled': {
                  borderColor: theme.palette.action.disabledBackground,
                  color: theme.palette.action.disabled,
                },
              }}
            >
              {copied ? 'Copiado!' : 'Copiar'}
            </Button>
            <Button
              onClick={handleExportSQL}
              disabled={!sql}
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon sx={{ fontSize: 12 }} />}
              sx={{
                px: 1.5,
                py: 0.25,
                minHeight: 'auto',
                fontSize: '0.6875rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 1.5,
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.divider,
                  backgroundColor: alpha(theme.palette.action.hover, 0.04),
                },
                '&.Mui-disabled': {
                  borderColor: theme.palette.action.disabledBackground,
                  color: theme.palette.action.disabled,
                },
              }}
            >
              Baixar
            </Button>
            <Box sx={{ position: 'relative' }} ref={exportMenuRef}>
              <Button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                disabled={!executionResult || !executionResult.rows || executionResult.rows.length === 0}
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon sx={{ fontSize: 12 }} />}
                endIcon={<ChevronDownIcon sx={{ fontSize: 10 }} />}
                sx={{
                  px: 1.5,
                  py: 0.25,
                  minHeight: 'auto',
                  fontSize: '0.6875rem',
                  fontWeight: 500,
                  textTransform: 'none',
                  borderRadius: 1.5,
                  borderColor: theme.palette.divider,
                  color: theme.palette.text.primary,
                  '&:hover': {
                    borderColor: theme.palette.divider,
                    backgroundColor: alpha(theme.palette.action.hover, 0.04),
                  },
                  '&.Mui-disabled': {
                    borderColor: theme.palette.action.disabledBackground,
                    color: theme.palette.action.disabled,
                  },
                }}
              >
                Exportar
              </Button>
              
              {exportMenuOpen && (
                <Box
                  sx={{
                    position: 'absolute',
                    right: 0,
                    mt: 2,
                    width: 224,
                    bgcolor: 'background.paper',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 2,
                    boxShadow: 3,
                    zIndex: 50,
                  }}
                >
                  <Box sx={{ py: 1 }}>
                    <Button
                      onClick={handleExportCSV}
                      fullWidth
                      sx={{
                        justifyContent: 'flex-start',
                        px: 2,
                        py: 1,
                        textTransform: 'none',
                        color: 'text.primary',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                      startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                    >
                      CSV (separado por ;)
                    </Button>
                    <Button
                      onClick={() => handleExportExcel('xlsx')}
                      fullWidth
                      sx={{
                        justifyContent: 'flex-start',
                        px: 2,
                        py: 1,
                        textTransform: 'none',
                        color: 'text.primary',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                      startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                    >
                      Excel (.xlsx)
                    </Button>
                    <Button
                      onClick={() => handleExportExcel('xls')}
                      fullWidth
                      sx={{
                        justifyContent: 'flex-start',
                        px: 2,
                        py: 1,
                        textTransform: 'none',
                        color: 'text.primary',
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                      startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                    >
                      Excel 97-2003 (.xls)
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
            <Button
              onClick={handleImportSQL}
              variant="outlined"
              size="small"
              startIcon={<UploadIcon sx={{ fontSize: 12 }} />}
              sx={{
                px: 1.5,
                py: 0.25,
                minHeight: 'auto',
                fontSize: '0.6875rem',
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: 1.5,
                borderColor: theme.palette.divider,
                color: theme.palette.text.primary,
                '&:hover': {
                  borderColor: theme.palette.divider,
                  backgroundColor: alpha(theme.palette.action.hover, 0.04),
                },
              }}
            >
              Importar
            </Button>
          </Box>
      </Box>
      
      {/* Main Content - 3 Columns */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left Section - Table Explorer */}
        <Box 
          sx={{ 
            width: 288, 
            flexShrink: 0, 
            borderRight: 1, 
            borderColor: 'divider',
            overflow: 'hidden',
          }}
        >
          <TableExplorer
            nodes={nodes}
            edges={edges}
            expandedTables={expandedTables}
            onToggleExpand={handleToggleExpand}
            onColumnDragStart={handleColumnDragStart}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            includedTables={includedTables}
            baseTableId={ast.from.table}
          />
        </Box>
        
        {/* Middle Section - Query Results com Tabs */}
        <Box 
          sx={{ 
            flex: 1, 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden', 
            borderRight: 1, 
            borderColor: 'divider',
          }}
        >
          {/* Header com Tabs - mesma altura do campo de busca */}
          <Box 
            sx={{ 
              flexShrink: 0, 
              borderBottom: 1, 
              borderColor: 'divider',
              bgcolor: 'action.hover',
              px: 1,
              py: 0.5,
              minHeight: 29, // Mesma altura do campo de busca (28px + padding)
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                sx={{
                  minHeight: 'auto',
                  height: '100%',
                  '& .MuiTab-root': {
                    minHeight: 'auto',
                    py: 0.5,
                    px: 2,
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    textTransform: 'none',
                    height: 28, // Mesma altura do TextField de busca
                  },
                  '& .MuiTabs-indicator': {
                    height: 2,
                  },
                }}
              >
                <Tab label="Resultados" value="resultados" />
                <Tab label="Grafo" value="grafo" />
                <Tab label="EXPLAIN" value="explain" />
              </Tabs>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  pr: 1,
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}>
                  Limite:
                </Typography>
                <TextField
                  type="number"
                  value={resultLimit === -1 ? '' : resultLimit}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '') {
                      setResultLimit(-1); // Todos
                    } else {
                      const num = parseInt(value, 10);
                      if (!isNaN(num) && num > 0) {
                        setResultLimit(Math.min(num, 10000)); // Máximo de 10000
                      }
                    }
                  }}
                  placeholder="100"
                  size="small"
                  inputProps={{
                    min: 1,
                    max: 10000,
                    style: { textAlign: 'center', padding: '4px 8px' },
                  }}
                  sx={{
                    width: 80,
                    '& .MuiInputBase-root': {
                      fontSize: '0.75rem',
                      height: 28,
                    },
                    '& .MuiInputBase-input': {
                      py: 0.5,
                      textAlign: 'center',
                    },
                  }}
                />
              </Box>
            </Box>
          </Box>
          
          {/* Tab Content */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
            {activeTab === 'resultados' && (
              <>
                {executionError ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {executionError}
                  </Alert>
                ) : executionResult ? (
                  <>
                    {(() => {
                      const limitedRows = resultLimit === -1 
                        ? executionResult.rows 
                        : executionResult.rows.slice(0, resultLimit);
                      return (
                        <>
                          <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                            {resultLimit === -1 
                              ? `${executionResult.rows.length} linhas (todas)`
                              : `${limitedRows.length} de ${executionResult.rows.length} linhas`
                            }
                          </Typography>
                          {executionResult.rows.length > 0 ? (
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small" sx={{ minWidth: 650 }}>
                                <TableHead>
                                  <TableRow>
                                    {executionResult.columns.map((col: string) => (
                                      <TableCell
                                        key={col}
                                        sx={{
                                          fontWeight: 600,
                                          textTransform: 'uppercase',
                                          fontSize: '0.75rem',
                                        }}
                                      >
                                        {col}
                                      </TableCell>
                                    ))}
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {limitedRows.map((row: any, idx: number) => (
                              <TableRow 
                                key={idx}
                                sx={{
                                  '&:hover': {
                                    bgcolor: 'action.hover',
                                  },
                                }}
                              >
                                {executionResult.columns.map((col: string) => (
                                  <TableCell
                                    key={col}
                                    sx={{
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {row[col] !== null && row[col] !== undefined
                                      ? String(row[col])
                                      : <Typography component="span" sx={{ fontStyle: 'italic', color: 'text.disabled' }}>
                                          NULL
                                        </Typography>}
                                  </TableCell>
                                ))}
                              </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          ) : (
                            <Box sx={{ textAlign: 'center', py: 8 }}>
                              <Typography variant="body2" color="text.secondary">
                                Nenhum resultado encontrado
                              </Typography>
                            </Box>
                          )}
                        </>
                      );
                    })()}
                  </>
                ) : (
                  <Box 
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexDirection: 'column',
                    }}
                  >
                    <DatabaseIcon sx={{ fontSize: 48, opacity: 0.5, mb: 2, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary">
                      Execute a query para ver os resultados
                    </Typography>
                  </Box>
                )}
              </>
            )}
            
            {activeTab === 'grafo' && (
              <Box 
                sx={{ 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexDirection: 'column',
                }}
              >
                {includedTables.size === 0 ? (
                  <>
                    <GitBranchIcon sx={{ fontSize: 48, opacity: 0.5, mb: 2, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      Nenhuma tabela selecionada
                    </Typography>
                    <Typography variant="caption" color="text.disabled">
                      Adicione colunas de tabelas para visualizar o grafo
                    </Typography>
                  </>
                ) : (
                  <QueryGraphViewer
                    nodes={nodes}
                    edges={edges}
                    includedTableIds={includedTables}
                  />
                )}
              </Box>
            )}
            
            {activeTab === 'explain' && (
              <>
                {explainError ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {explainError}
                  </Alert>
                ) : explainResult ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small" sx={{ minWidth: 650 }}>
                      <TableHead>
                        <TableRow>
                          {explainResult.columns?.map((col: string) => (
                            <TableCell
                              key={col}
                              sx={{
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                fontSize: '0.75rem',
                              }}
                            >
                              {col}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {explainResult.rows?.map((row: any, idx: number) => (
                          <TableRow 
                            key={idx}
                            sx={{
                              '&:hover': {
                                bgcolor: 'action.hover',
                              },
                            }}
                          >
                            {explainResult.columns?.map((col: string) => (
                              <TableCell key={col}>
                                {row[col] !== null && row[col] !== undefined
                                  ? String(row[col])
                                  : <Typography component="span" sx={{ fontStyle: 'italic', color: 'text.disabled' }}>
                                      NULL
                                    </Typography>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Box 
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      flexDirection: 'column',
                    }}
                  >
                    <EyeIcon sx={{ fontSize: 48, opacity: 0.5, mb: 2, color: 'text.disabled' }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Clique em "EXPLAIN" para ver o plano de execução
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Box>
        </Box>
        
        {/* Right Section - SELECT Fields */}
        <Box 
          sx={{ 
            width: 320, 
            flexShrink: 0, 
            display: 'flex', 
            flexDirection: 'column', 
            overflow: 'hidden',
          }}
        >
          {/* Header - mesma altura do campo de busca */}
          <Box 
            sx={{ 
              flexShrink: 0, 
              px: 1, 
              py: 0.5, 
              borderBottom: 1, 
              borderColor: 'divider',
              bgcolor: 'action.hover',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 29, // Mesma altura do campo de busca (28px + padding)
            }}
          >
            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.75rem', lineHeight: '28px' }}>
              Campos SELECT ({ast.select.fields.length})
            </Typography>
            <Button
              onClick={() => {
                setCustomFieldDialogOpen(true);
                setCustomExpression('');
                setCustomAlias('');
              }}
              size="small"
              sx={{
                px: 1,
                py: 0.25,
                minHeight: 28, // Mesma altura do TextField de busca
                fontSize: '0.75rem',
                fontWeight: 500,
                textTransform: 'none',
                color: 'primary.main',
                '&:hover': {
                  bgcolor: alpha(theme.palette.primary.main, 0.12),
                },
              }}
            >
              + Personalizada
            </Button>
          </Box>
          <Box 
            sx={{ 
              flex: 1, 
              overflow: 'hidden',
              position: 'relative',
              border: isDraggingOver ? 2 : 0,
              borderColor: isDraggingOver ? 'primary.main' : 'transparent',
              borderStyle: isDraggingOver ? 'dashed' : 'solid',
              borderRadius: 1,
              bgcolor: isDraggingOver ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
              transition: 'all 0.2s',
            }}
            onDragEnter={(e) => {
              e.preventDefault();
              // Verificar se é uma coluna sendo arrastada pelos tipos de dados
              const types = Array.from(e.dataTransfer.types);
              if (types.includes('application/json')) {
                setIsDraggingOver(true);
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }}
            onDragLeave={(e) => {
              // Só remove o estado se realmente saiu da área (não apenas de um filho)
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsDraggingOver(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation(); // Prevenir propagação do evento
              setIsDraggingOver(false);
              try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                if (data.type === 'column' && data.tableId && data.column?.name) {
                  handleColumnDrop(data.tableId, data.column.name);
                }
              } catch (error) {
                console.error('Erro ao processar drop:', error);
              }
            }}
          >
            <SelectList
              fields={ast.select.fields}
              onReorder={reorderColumns}
              onRemove={removeColumn}
              onEditAlias={updateColumnAlias}
              tableAliases={tableAliases}
            />
            {isDraggingOver && ast.select.fields.length === 0 && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <Paper
                  elevation={4}
                  sx={{
                    px: 2,
                    py: 1,
                    bgcolor: 'primary.main',
                    color: 'primary.contrastText',
                  }}
                >
                  <Typography variant="body2" fontWeight={500}>
                    Solte aqui para adicionar ao SELECT
                  </Typography>
                </Paper>
              </Box>
            )}
          </Box>
          
          {/* Bottom Bar - Clause Buttons */}
          <Box 
            sx={{ 
              flexShrink: 0, 
              px: 1, 
              py: 1, 
              borderTop: 1, 
              borderColor: 'divider',
            }}
          >
            <Box 
              sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                gap: 0.5,
                flexWrap: 'nowrap',
              }}
            >
              <IconButton
                onClick={() => setActiveDialog('joins')}
                size="small"
                sx={{
                  flexDirection: 'column',
                  gap: 0.25,
                  px: 0.75,
                  py: 0.5,
                  minWidth: 'auto',
                  position: 'relative',
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <LinkIcon sx={{ fontSize: 12 }} />
                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.5625rem', lineHeight: 1 }}>
                  JOIN
                </Typography>
                {ast.joins.length > 0 && (
                  <Chip
                    label={ast.joins.length}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      height: 14,
                      minWidth: 14,
                      fontSize: '0.5rem',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                    }}
                  />
                )}
              </IconButton>
              <IconButton
                onClick={() => setActiveDialog('where')}
                size="small"
                sx={{
                  flexDirection: 'column',
                  gap: 0.25,
                  px: 0.75,
                  py: 0.5,
                  minWidth: 'auto',
                  position: 'relative',
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <FilterIcon sx={{ fontSize: 12 }} />
                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.5625rem', lineHeight: 1 }}>
                  WHERE
                </Typography>
                {(ast.where?.conditions.length || 0) > 0 && (
                  <Chip
                    label={ast.where?.conditions.length || 0}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      height: 14,
                      minWidth: 14,
                      fontSize: '0.5rem',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                    }}
                  />
                )}
              </IconButton>
              <IconButton
                onClick={() => setActiveDialog('groupBy')}
                size="small"
                sx={{
                  flexDirection: 'column',
                  gap: 0.25,
                  px: 0.75,
                  py: 0.5,
                  minWidth: 'auto',
                  position: 'relative',
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <LayersIcon sx={{ fontSize: 12 }} />
                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.5625rem', lineHeight: 1 }}>
                  GROUP BY
                </Typography>
                {(ast.groupBy?.fields.length || 0) > 0 && (
                  <Chip
                    label={ast.groupBy?.fields.length || 0}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      height: 14,
                      minWidth: 14,
                      fontSize: '0.5rem',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                    }}
                  />
                )}
              </IconButton>
              <IconButton
                onClick={() => setActiveDialog('orderBy')}
                size="small"
                sx={{
                  flexDirection: 'column',
                  gap: 0.25,
                  px: 0.75,
                  py: 0.5,
                  minWidth: 'auto',
                  position: 'relative',
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <ArrowUpDownIcon sx={{ fontSize: 12 }} />
                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.5625rem', lineHeight: 1 }}>
                  ORDER BY
                </Typography>
                {(ast.orderBy?.fields.length || 0) > 0 && (
                  <Chip
                    label={ast.orderBy?.fields.length || 0}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      height: 14,
                      minWidth: 14,
                      fontSize: '0.5rem',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                    }}
                  />
                )}
              </IconButton>
              <IconButton
                onClick={() => setActiveDialog('cte')}
                size="small"
                sx={{
                  flexDirection: 'column',
                  gap: 0.25,
                  px: 0.75,
                  py: 0.5,
                  minWidth: 'auto',
                  position: 'relative',
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <FileCodeIcon sx={{ fontSize: 12 }} />
                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.5625rem', lineHeight: 1 }}>
                  CTE
                </Typography>
                {(ast.ctes?.length || 0) > 0 && (
                  <Chip
                    label={ast.ctes?.length || 0}
                    size="small"
                    sx={{
                      position: 'absolute',
                      top: -2,
                      right: -2,
                      height: 14,
                      minWidth: 14,
                      fontSize: '0.5rem',
                      bgcolor: 'primary.main',
                      color: 'primary.contrastText',
                    }}
                  />
                )}
              </IconButton>
              <IconButton
                onClick={() => setActiveDialog('union')}
                size="small"
                sx={{
                  flexDirection: 'column',
                  gap: 0.25,
                  px: 0.75,
                  py: 0.5,
                  minWidth: 'auto',
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <GitBranchIcon sx={{ fontSize: 12 }} />
                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.5625rem', lineHeight: 1 }}>
                  UNION
                </Typography>
              </IconButton>
              <IconButton
                onClick={() => setActiveDialog('sql')}
                size="small"
                sx={{
                  flexDirection: 'column',
                  gap: 0.25,
                  px: 0.75,
                  py: 0.5,
                  minWidth: 'auto',
                  color: 'text.secondary',
                  '&:hover': {
                    color: 'primary.main',
                  },
                }}
              >
                <CodeIcon sx={{ fontSize: 12 }} />
                <Typography variant="caption" sx={{ fontWeight: 500, fontSize: '0.5625rem', lineHeight: 1 }}>
                  SQL
                </Typography>
              </IconButton>
            </Box>
          </Box>
        </Box>
      </Box>
      
      {/* Dialogs */}
      <QueryClauseDialog
        isOpen={activeDialog === 'joins'}
        onClose={() => {
          setActiveDialog('none');
          // Limpar coluna pendente se dialog foi fechado sem criar JOIN
          if (pendingJoinTableId && !ast.joins.some(j => j.targetTableId === pendingJoinTableId)) {
            pendingColumnRef.current = null;
            setPendingJoinTableId(null);
          }
        }}
        title="Gerenciar JOINs"
        width="xl"
      >
        <JoinEditor
          joins={ast.joins}
          onUpdate={updateJoin}
          onRemove={removeJoin}
          onAddManual={(targetTableId, sourceTableId, conditions, joinType, targetSubquery, targetSubqueryAlias) => {
            addManualJoin(targetTableId, sourceTableId, conditions, joinType, targetSubquery, targetSubqueryAlias);
            // Chamar callback de JOIN criado após criar o JOIN
            const finalTableId = targetSubquery && targetSubqueryAlias ? targetSubqueryAlias : targetTableId;
            handleJoinCreated(finalTableId);
          }}
          baseTableId={ast.from.table}
          baseTableAlias={ast.from.alias}
          nodes={nodes}
          edges={edges}
          dbType={dbType}
          preselectedViewTableId={pendingJoinTableId}
          onJoinCreated={handleJoinCreated}
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
      
      <QueryClauseDialog
        isOpen={activeDialog === 'cte'}
        onClose={() => setActiveDialog('none')}
        title="CTEs (Common Table Expressions)"
        width="xl"
      >
        <CTEEditor
          ctes={ast.ctes || []}
          onAdd={(cte) => addCTE(cte as CTEClause)}
          onUpdate={(index, cte) => {
            const ctes = ast.ctes || [];
            if (ctes[index]) {
              updateCTE(ctes[index].id, cte as Partial<CTEClause>);
            }
          }}
          onRemove={(index) => {
            const ctes = ast.ctes || [];
            if (ctes[index]) {
              removeCTE(ctes[index].id);
            }
          }}
          nodes={nodes}
          edges={edges}
          dbType={dbType}
        />
      </QueryClauseDialog>
      
      <QueryClauseDialog
        isOpen={activeDialog === 'union'}
        onClose={() => setActiveDialog('none')}
        title="UNION"
        width="lg"
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <GitBranchIcon sx={{ fontSize: 48, opacity: 0.5, mb: 2 }} />
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
              Funcionalidade UNION em desenvolvimento
            </Typography>
            <Typography variant="caption">
              Em breve você poderá combinar múltiplas queries com UNION/UNION ALL
            </Typography>
          </Box>
        </Box>
      </QueryClauseDialog>
      
      {/* SQL Preview Dialog */}
      <QueryClauseDialog
        isOpen={activeDialog === 'sql'}
        onClose={() => setActiveDialog('none')}
        title="SQL Gerado"
        width="xl"
      >
        <Box sx={{ p: 2 }}>
          {sql ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                <Button
                  onClick={handleCopy}
                  variant="outlined"
                  size="small"
                  startIcon={copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <CopyIcon sx={{ fontSize: 16 }} />}
                  sx={{ textTransform: 'none' }}
                >
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
                <Button
                  onClick={handleExportSQL}
                  variant="contained"
                  size="small"
                  startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
                  sx={{ textTransform: 'none' }}
                >
                  Exportar
                </Button>
              </Box>
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.900',
                  borderRadius: 1,
                  overflow: 'auto',
                }}
              >
                <Typography
                  component="pre"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                    color: theme.palette.mode === 'dark' ? 'grey.100' : 'grey.100',
                    margin: 0,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {formatSQL(sql)}
                </Typography>
              </Paper>
            </Box>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
              <CodeIcon sx={{ fontSize: 48, opacity: 0.5, mb: 2 }} />
              <Typography variant="body2">Nenhuma query gerada ainda</Typography>
            </Box>
          )}
        </Box>
      </QueryClauseDialog>

      {/* Dialog para adicionar campo personalizado */}
      <Dialog
        open={customFieldDialogOpen}
        onClose={() => setCustomFieldDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Adicionar Campo Personalizado</Typography>
            <IconButton
              onClick={() => setCustomFieldDialogOpen(false)}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Expressão SQL"
              placeholder="Ex: COUNT(*), SUM(coluna), CONCAT(nome, ' ', sobrenome)"
              value={customExpression}
              onChange={(e) => setCustomExpression(e.target.value)}
              multiline
              rows={3}
              fullWidth
              helperText="Digite uma expressão SQL válida (funções, cálculos, etc.)"
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                },
              }}
            />
            <TextField
              label="Alias (opcional)"
              placeholder="Ex: total_vendas, nome_completo"
              value={customAlias}
              onChange={(e) => setCustomAlias(e.target.value)}
              fullWidth
              helperText="Nome que aparecerá na coluna de resultados"
            />
            <Alert severity="info" sx={{ mt: 1 }}>
              <Typography variant="caption">
                <strong>Dica:</strong> Você pode usar colunas das tabelas usando seus aliases (ex: t1.nome, t2.valor)
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={() => setCustomFieldDialogOpen(false)} variant="outlined" size="small">
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (customExpression.trim()) {
                addExpression(customExpression.trim(), customAlias.trim() || undefined);
                setCustomFieldDialogOpen(false);
                setCustomExpression('');
                setCustomAlias('');
              }
            }}
            disabled={!customExpression.trim()}
            variant="contained"
            size="small"
          >
            Adicionar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog de queries salvas */}
      <SavedQueriesDialog
        isOpen={savedQueriesDialogOpen}
        onClose={() => setSavedQueriesDialogOpen(false)}
        savedQueries={savedQueries}
        currentSQL={sql || ''}
        currentAST={ast || { select: { fields: [] }, from: { table: '', alias: '' }, joins: [], where: { conditions: [] }, groupBy: { fields: [] }, orderBy: { fields: [] }, limit: null }}
        onLoad={handleLoadQuery}
        onSave={handleSaveQuery}
        onDelete={handleDeleteQuery}
        onUpdate={handleUpdateQuery}
      />

      {/* Dialog para importar SQL */}
      <Dialog
        open={importSQLDialogOpen}
        onClose={() => setImportSQLDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">Importar e Executar SQL</Typography>
            <IconButton
              onClick={() => setImportSQLDialogOpen(false)}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="SQL"
              placeholder="Cole ou digite sua query SQL aqui..."
              value={importSQL}
              onChange={(e) => setImportSQL(e.target.value)}
              multiline
              rows={10}
              fullWidth
              helperText="Cole uma query SQL para executar diretamente (não será convertida para o Query Builder)"
              sx={{
                '& .MuiInputBase-root': {
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                },
              }}
            />
            <Alert severity="info">
              <Typography variant="caption">
                <strong>Nota:</strong> Esta funcionalidade executa o SQL diretamente sem convertê-lo para o Query Builder. 
                Os resultados serão exibidos na aba "Resultados".
              </Typography>
            </Alert>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <Button onClick={() => setImportSQLDialogOpen(false)} variant="outlined" size="small">
            Cancelar
          </Button>
          <Button
            onClick={handleExecuteImportedSQL}
            disabled={!importSQL.trim()}
            variant="contained"
            size="small"
            startIcon={<PlayIcon sx={{ fontSize: 16 }} />}
          >
            Executar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
