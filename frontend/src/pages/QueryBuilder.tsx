/**
 * Página principal do Query Builder
 * Interface visual para construção de queries SQL
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
} from '@mui/material';
import { 
  ArrowLeft, Download, Upload, Play, RotateCcw, Code, Database, 
  Loader2, AlertCircle, Check, Copy, Link, Filter, Layers, ArrowUpDown,
  Eye, GitBranch, FileCode, ChevronDown, Star, RefreshCw
} from 'lucide-react';
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
  const exportMenuRef = useRef<HTMLDivElement>(null);
  
  // Pending column para adicionar após JOIN ser criado
  const pendingViewColumnRef = useRef<{ tableId: string; column: Column } | null>(null);
  
  // Callback quando JOIN é criado
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
    addCTE,
    updateCTE,
    removeCTE,
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
    setActiveTab('resultados');
    
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
    // TODO: Implementar importação de SQL
    alert('Funcionalidade de importação em desenvolvimento');
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
            <ArrowLeft size={14} />
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
                  <RefreshCw size={12} />
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
                  <Play size={12} />
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
                  <Eye size={12} />
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
              onClick={() => {
                // TODO: Implementar queries salvas
                alert('Funcionalidade de queries salvas em desenvolvimento');
              }}
              variant="contained"
              size="small"
              startIcon={<Star size={12} />}
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
              startIcon={copied ? <Check size={12} /> : <Copy size={12} />}
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
              startIcon={<Download size={12} />}
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
                startIcon={<Download size={12} />}
                endIcon={<ChevronDown size={10} />}
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
                      startIcon={<Download size={16} />}
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
                      startIcon={<Download size={16} />}
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
                      startIcon={<Download size={16} />}
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
              startIcon={<Upload size={12} />}
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
            {executionResult && executionResult.rows && executionResult.rows.length > 0 && (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  ml: 3,
                  pl: 3,
                  borderLeft: 1,
                  borderColor: 'divider',
                }}
              >
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Limite:
                </Typography>
                <FormControl size="small" sx={{ minWidth: 80 }}>
                  <Select
                    value={resultLimit}
                    onChange={(e) => setResultLimit(Number(e.target.value))}
                    sx={{
                      fontSize: '0.75rem',
                      height: 28,
                    }}
                  >
                    <MenuItem value={50}>50</MenuItem>
                    <MenuItem value={100}>100</MenuItem>
                    <MenuItem value={500}>500</MenuItem>
                    <MenuItem value={1000}>1000</MenuItem>
                    <MenuItem value={-1}>Todos</MenuItem>
                  </Select>
                </FormControl>
              </Box>
            )}
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
                    <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
                      {limitedRows.length} de {executionResult.rows.length} linhas
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
                    <Database size={48} style={{ opacity: 0.5, marginBottom: 16, color: theme.palette.text.disabled }} />
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
                <GitBranch size={48} style={{ opacity: 0.5, marginBottom: 16, color: theme.palette.text.disabled }} />
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Visualização do grafo da query
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  Mostra as tabelas e relacionamentos usados na query
                </Typography>
                {/* TODO: Implementar visualização do grafo */}
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
                    <Eye size={48} style={{ opacity: 0.5, marginBottom: 16, color: theme.palette.text.disabled }} />
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
                // TODO: Adicionar campo personalizado
                alert('Funcionalidade de campo personalizado em desenvolvimento');
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
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <SelectList
              fields={ast.select.fields}
              onReorder={reorderColumns}
              onRemove={removeColumn}
              onEditAlias={updateColumnAlias}
              tableAliases={tableAliases}
            />
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
                <Link size={12} />
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
                <Filter size={12} />
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
                <Layers size={12} />
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
                <ArrowUpDown size={12} />
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
                <FileCode size={12} />
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
                <GitBranch size={12} />
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
                <Code size={12} />
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
        <div className="p-4">
          <div className="text-center py-8 text-gray-500">
            <GitBranch className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium mb-2">Funcionalidade UNION em desenvolvimento</p>
            <p className="text-xs">Em breve você poderá combinar múltiplas queries com UNION/UNION ALL</p>
          </div>
        </div>
      </QueryClauseDialog>
      
      {/* SQL Preview Dialog */}
      <QueryClauseDialog
        isOpen={activeDialog === 'sql'}
        onClose={() => setActiveDialog('none')}
        title="SQL Gerado"
        width="xl"
      >
        <div className="p-4">
          {sql ? (
            <div className="space-y-4">
              <div className="flex justify-end gap-2">
                <button
                  onClick={handleCopy}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300
                           bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600
                           hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors
                           flex items-center gap-1.5"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={handleExportSQL}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600
                           hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Download className="h-4 w-4" />
                  Exportar
                </button>
              </div>
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
                {formatSQL(sql)}
              </pre>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Code className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma query gerada ainda</p>
            </div>
          )}
        </div>
      </QueryClauseDialog>
    </Box>
  );
}
