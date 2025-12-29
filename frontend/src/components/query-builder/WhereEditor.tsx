/**
 * Componente para visualizar e editar condições WHERE
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Select,
  MenuItem,
  FormControl,
  TextField,
  Paper,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Storage as StorageIcon,
} from '@mui/icons-material';
import type { WhereCondition, WhereOperator, WhereLogicalOperator, QueryAST } from '../../types/query-builder';
import type { GraphNode, GraphEdge } from '../../api/client';
import SubqueryBuilder from './SubqueryBuilder';

interface WhereEditorProps {
  conditions: WhereCondition[];
  onAdd: (condition: WhereCondition) => void;
  onUpdate: (conditionId: string, updates: Partial<WhereCondition>) => void;
  onRemove: (conditionId: string) => void;
  onReorder: (conditions: WhereCondition[]) => void;
  nodes: GraphNode[];
  edges: GraphEdge[]; // Arestas para subselects
  dbType: 'mysql' | 'sqlserver'; // Tipo do banco para subselects
  availableTables: Set<string>; // Tabelas disponíveis (FROM + JOINs)
  tableAliases: Map<string, string>; // Mapa de tableId -> alias
}

const WHERE_OPERATORS: WhereOperator[] = ['=', '!=', '<>', '>', '>=', '<', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'IS NULL', 'IS NOT NULL', 'BETWEEN', 'NOT BETWEEN', 'EXISTS', 'NOT EXISTS'];
const LOGICAL_OPERATORS: WhereLogicalOperator[] = ['AND', 'OR'];

export default function WhereEditor({
  conditions,
  onAdd,
  onUpdate,
  onRemove,
  onReorder,
  nodes,
  edges,
  dbType,
  availableTables,
  tableAliases,
}: WhereEditorProps) {
  const theme = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSubqueryId, setEditingSubqueryId] = useState<string | null>(null);
  const [newCondition, setNewCondition] = useState<Partial<WhereCondition>>({
    tableId: '',
    column: '',
    operator: '=',
    value: '',
    logicalOperator: 'AND',
  });

  // Obter colunas disponíveis de uma tabela
  const getColumnsForTable = (tableId: string): string[] => {
    const node = nodes.find(n => n.id === tableId);
    return node?.columns?.map(c => c.name) || [];
  };

  // Obter alias de uma tabela
  const getTableAlias = (tableId: string): string => {
    return tableAliases.get(tableId) || (tableId.includes('.') ? tableId.split('.').pop()! : tableId);
  };

  const handleAdd = () => {
    // EXISTS e NOT EXISTS não precisam de coluna
    const needsColumn = !['EXISTS', 'NOT EXISTS'].includes(newCondition.operator || '');
    if (needsColumn && (!newCondition.tableId || !newCondition.column || !newCondition.operator)) return;
    if (!newCondition.operator) return;
    // Se é IN/EXISTS e não tem subquery nem value, não pode adicionar
    if (needsSubquery(newCondition.operator) && !newCondition.subquery && !newCondition.value) return;

    const condition: WhereCondition = {
      id: `where-${Date.now()}-${Math.random()}`,
      tableId: newCondition.tableId || '',
      column: newCondition.column || '',
      operator: newCondition.operator || '=',
      value: newCondition.value,
      subquery: newCondition.subquery,
      logicalOperator: newCondition.logicalOperator || 'AND',
      order: conditions.length,
    };

    onAdd(condition);
    setIsAdding(false);
    setNewCondition({
      tableId: '',
      column: '',
      operator: '=',
      value: '',
      logicalOperator: 'AND',
    });
  };

  const handleUpdate = (id: string, updates: Partial<WhereCondition>) => {
    onUpdate(id, updates);
    setEditingId(null);
  };

  const needsValue = (operator: WhereOperator): boolean => {
    return !['IS NULL', 'IS NOT NULL', 'EXISTS', 'NOT EXISTS'].includes(operator);
  };

  const needsSubquery = (operator: WhereOperator): boolean => {
    return ['IN', 'NOT IN', 'EXISTS', 'NOT EXISTS'].includes(operator);
  };

  const needsMultipleValues = (operator: WhereOperator): boolean => {
    return ['IN', 'NOT IN', 'BETWEEN', 'NOT BETWEEN'].includes(operator);
  };

  const formatValue = (value: string | number | string[] | number[] | undefined, operator: WhereOperator): string => {
    if (value === undefined || value === null) return '';
    
    if (needsMultipleValues(operator)) {
      if (Array.isArray(value)) {
        return value.join(', ');
      }
      return String(value);
    }
    
    return String(value);
  };

  const parseValue = (value: string, operator: WhereOperator): string | number | string[] | number[] => {
    if (needsMultipleValues(operator)) {
      return value.split(',').map(v => v.trim()).filter(v => v);
    }
    
    // Tentar converter para número se possível
    const numValue = Number(value);
    if (!isNaN(numValue) && value.trim() !== '') {
      return numValue;
    }
    
    return value;
  };

  const sortedConditions = [...conditions].sort((a, b) => a.order - b.order);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      <Box
        sx={{
          p: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          WHERE ({conditions.length})
        </Typography>
        <Tooltip title="Adicionar condição">
          <IconButton
            onClick={() => setIsAdding(true)}
            size="small"
            sx={{
              color: 'primary.main',
              '&:hover': {
                bgcolor: alpha(theme.palette.primary.main, 0.08),
              },
            }}
          >
            <AddIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1.5,
        }}
      >
        {sortedConditions.length === 0 && !isAdding ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">Nenhuma condição WHERE</Typography>
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              Clique no botão + para adicionar
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {sortedConditions.map((condition, index) => {
              const isEditing = editingId === condition.id;
              const tableName = condition.tableId.includes('.') 
                ? condition.tableId.split('.').pop() || condition.tableId
                : condition.tableId;
              const alias = getTableAlias(condition.tableId);
              const columns = getColumnsForTable(condition.tableId);

              return (
                <Paper
                  key={condition.id}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: 'action.hover',
                  }}
                >
                  {isEditing ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        {index > 0 && (
                          <FormControl size="small" sx={{ minWidth: 80 }}>
                            <Select
                              value={condition.logicalOperator || 'AND'}
                              onChange={e => handleUpdate(condition.id, { logicalOperator: e.target.value as WhereLogicalOperator })}
                              sx={{ fontSize: '0.75rem', height: 32 }}
                            >
                              {LOGICAL_OPERATORS.map(op => (
                                <MenuItem key={op} value={op} sx={{ fontSize: '0.75rem' }}>
                                  {op}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        )}
                        <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
                          <Select
                            value={condition.tableId}
                            onChange={e => {
                              const newTableId = e.target.value;
                              handleUpdate(condition.id, { 
                                tableId: newTableId,
                                column: '', // Resetar coluna ao mudar tabela
                              });
                            }}
                            sx={{ fontSize: '0.75rem', height: 32 }}
                          >
                            <MenuItem value="" sx={{ fontSize: '0.75rem' }}>Selecione tabela</MenuItem>
                            {Array.from(availableTables).map(tableId => {
                              const tableName = tableId.includes('.') 
                                ? tableId.split('.').pop() || tableId
                                : tableId;
                              return (
                                <MenuItem key={tableId} value={tableId} sx={{ fontSize: '0.75rem' }}>
                                  {tableName} AS {getTableAlias(tableId)}
                                </MenuItem>
                              );
                            })}
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ flex: 1, minWidth: 120 }} disabled={!condition.tableId}>
                          <Select
                            value={condition.column}
                            onChange={e => handleUpdate(condition.id, { column: e.target.value })}
                            sx={{ fontSize: '0.75rem', height: 32 }}
                          >
                            <MenuItem value="" sx={{ fontSize: '0.75rem' }}>Selecione coluna</MenuItem>
                            {columns.map(col => (
                              <MenuItem key={col} value={col} sx={{ fontSize: '0.75rem' }}>
                                {col}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 120 }}>
                          <Select
                            value={condition.operator}
                            onChange={e => handleUpdate(condition.id, { operator: e.target.value as WhereOperator })}
                            sx={{ fontSize: '0.75rem', height: 32 }}
                          >
                            {WHERE_OPERATORS.map(op => (
                              <MenuItem key={op} value={op} sx={{ fontSize: '0.75rem' }}>
                                {op}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Box>
                      {needsValue(condition.operator) && !needsSubquery(condition.operator) && (
                        <TextField
                          size="small"
                          fullWidth
                          value={formatValue(condition.value, condition.operator)}
                          onChange={e => {
                            const parsed = parseValue(e.target.value, condition.operator);
                            handleUpdate(condition.id, { value: parsed });
                          }}
                          placeholder={needsMultipleValues(condition.operator) ? 'valor1, valor2, ...' : 'valor'}
                          sx={{
                            '& .MuiInputBase-root': {
                              fontSize: '0.75rem',
                              fontFamily: 'monospace',
                              height: 32,
                            },
                          }}
                        />
                      )}
                      {needsSubquery(condition.operator) && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Paper
                            elevation={0}
                            sx={{
                              flex: 1,
                              px: 1,
                              py: 0.5,
                              border: 1,
                              borderColor: condition.subquery ? 'success.main' : 'divider',
                              bgcolor: condition.subquery ? alpha(theme.palette.success.main, 0.08) : 'action.hover',
                              borderRadius: 0.5,
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                fontFamily: 'monospace',
                                fontSize: '0.75rem',
                                color: condition.subquery ? 'success.main' : 'text.secondary',
                              }}
                            >
                              {condition.subquery ? 'Subselect configurado' : 'Nenhum subselect configurado'}
                            </Typography>
                          </Paper>
                          <Button
                            onClick={() => setEditingSubqueryId(condition.id)}
                            size="small"
                            variant="contained"
                            startIcon={<StorageIcon sx={{ fontSize: 14 }} />}
                            sx={{
                              fontSize: '0.75rem',
                              px: 1,
                              py: 0.5,
                              minHeight: 'auto',
                            }}
                          >
                            {condition.subquery ? 'Editar' : 'Criar'} Subselect
                          </Button>
                        </Box>
                      )}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                        <Button
                          onClick={() => setEditingId(null)}
                          size="small"
                          sx={{ fontSize: '0.75rem', minHeight: 'auto' }}
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={() => setEditingId(null)}
                          size="small"
                          variant="contained"
                          sx={{ fontSize: '0.75rem', minHeight: 'auto' }}
                        >
                          Salvar
                        </Button>
                      </Box>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {index > 0 && (
                        <Typography
                          variant="caption"
                          sx={{
                            fontWeight: 600,
                            color: 'text.secondary',
                            px: 0.5,
                          }}
                        >
                          {condition.logicalOperator || 'AND'}
                        </Typography>
                      )}
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          flex: 1,
                        }}
                      >
                        {condition.operator === 'EXISTS' || condition.operator === 'NOT EXISTS' 
                          ? `${condition.operator} (subselect)`
                          : `${alias}.${condition.column} ${condition.operator} ${condition.subquery ? '(subselect)' : needsValue(condition.operator) ? formatValue(condition.value, condition.operator) : ''}`
                        }
                      </Typography>
                      <Tooltip title="Editar">
                        <IconButton
                          onClick={() => setEditingId(condition.id)}
                          size="small"
                          sx={{
                            color: 'text.secondary',
                            '&:hover': {
                              color: 'primary.main',
                            },
                          }}
                        >
                          <EditIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Remover">
                        <IconButton
                          onClick={() => onRemove(condition.id)}
                          size="small"
                          sx={{
                            color: 'text.secondary',
                            '&:hover': {
                              color: 'error.main',
                            },
                          }}
                        >
                          <DeleteIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}
                </Paper>
              );
            })}

            {isAdding && (
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  border: 1,
                  borderColor: 'primary.main',
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <FormControl size="small" sx={{ minWidth: 80 }}>
                      <Select
                        value={newCondition.logicalOperator || 'AND'}
                        onChange={e => setNewCondition({ ...newCondition, logicalOperator: e.target.value as WhereLogicalOperator })}
                        sx={{ fontSize: '0.75rem', height: 32 }}
                      >
                        {LOGICAL_OPERATORS.map(op => (
                          <MenuItem key={op} value={op} sx={{ fontSize: '0.75rem' }}>
                            {op}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ flex: 1, minWidth: 120 }}>
                      <Select
                        value={newCondition.tableId || ''}
                        onChange={e => setNewCondition({ ...newCondition, tableId: e.target.value, column: '' })}
                        sx={{ fontSize: '0.75rem', height: 32 }}
                      >
                        <MenuItem value="" sx={{ fontSize: '0.75rem' }}>Selecione tabela</MenuItem>
                        {Array.from(availableTables).map(tableId => {
                          const tableName = tableId.includes('.') 
                            ? tableId.split('.').pop() || tableId
                            : tableId;
                          return (
                            <MenuItem key={tableId} value={tableId} sx={{ fontSize: '0.75rem' }}>
                              {tableName} AS {getTableAlias(tableId)}
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ flex: 1, minWidth: 120 }} disabled={!newCondition.tableId}>
                      <Select
                        value={newCondition.column || ''}
                        onChange={e => setNewCondition({ ...newCondition, column: e.target.value })}
                        sx={{ fontSize: '0.75rem', height: 32 }}
                      >
                        <MenuItem value="" sx={{ fontSize: '0.75rem' }}>Selecione coluna</MenuItem>
                        {newCondition.tableId && getColumnsForTable(newCondition.tableId).map(col => (
                          <MenuItem key={col} value={col} sx={{ fontSize: '0.75rem' }}>
                            {col}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <Select
                        value={newCondition.operator || '='}
                        onChange={e => setNewCondition({ ...newCondition, operator: e.target.value as WhereOperator })}
                        sx={{ fontSize: '0.75rem', height: 32 }}
                      >
                        {WHERE_OPERATORS.map(op => (
                          <MenuItem key={op} value={op} sx={{ fontSize: '0.75rem' }}>
                            {op}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>
                  {needsValue(newCondition.operator || '=') && !needsSubquery(newCondition.operator || '=') && (
                    <TextField
                      size="small"
                      fullWidth
                      value={formatValue(newCondition.value, newCondition.operator || '=')}
                      onChange={e => {
                        const parsed = parseValue(e.target.value, newCondition.operator || '=');
                        setNewCondition({ ...newCondition, value: parsed });
                      }}
                      placeholder={needsMultipleValues(newCondition.operator || '=') ? 'valor1, valor2, ...' : 'valor'}
                      sx={{
                        '& .MuiInputBase-root': {
                          fontSize: '0.75rem',
                          fontFamily: 'monospace',
                          height: 32,
                        },
                      }}
                    />
                  )}
                  {needsSubquery(newCondition.operator || '=') && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Paper
                        elevation={0}
                        sx={{
                          flex: 1,
                          px: 1,
                          py: 0.5,
                          border: 1,
                          borderColor: newCondition.subquery ? 'success.main' : 'divider',
                          bgcolor: newCondition.subquery ? alpha(theme.palette.success.main, 0.08) : 'action.hover',
                          borderRadius: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            color: newCondition.subquery ? 'success.main' : 'text.secondary',
                          }}
                        >
                          {newCondition.subquery ? 'Subselect configurado' : 'Nenhum subselect configurado'}
                        </Typography>
                      </Paper>
                      <Button
                        onClick={() => setEditingSubqueryId('new')}
                        size="small"
                        variant="contained"
                        startIcon={<StorageIcon sx={{ fontSize: 14 }} />}
                        sx={{
                          fontSize: '0.75rem',
                          px: 1,
                          py: 0.5,
                          minHeight: 'auto',
                        }}
                      >
                        {newCondition.subquery ? 'Editar' : 'Criar'} Subselect
                      </Button>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: 'flex-end' }}>
                    <Button
                      onClick={() => {
                        setIsAdding(false);
                        setNewCondition({
                          tableId: '',
                          column: '',
                          operator: '=',
                          value: '',
                          logicalOperator: 'AND',
                        });
                      }}
                      size="small"
                      sx={{ fontSize: '0.75rem', minHeight: 'auto' }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleAdd}
                      disabled={!newCondition.tableId || !newCondition.column || !newCondition.operator}
                      size="small"
                      variant="contained"
                      sx={{ fontSize: '0.75rem', minHeight: 'auto' }}
                    >
                      Adicionar
                    </Button>
                  </Box>
                </Box>
              </Paper>
            )}
          </Box>
        )}
      </Box>

      {/* Subquery Builder Dialog */}
      {editingSubqueryId && (
        <SubqueryBuilder
          initialAST={
            editingSubqueryId === 'new'
              ? newCondition.subquery || null
              : conditions.find(c => c.id === editingSubqueryId)?.subquery || null
          }
          onSave={(subqueryAST) => {
            if (editingSubqueryId === 'new') {
              setNewCondition({ ...newCondition, subquery: subqueryAST });
            } else {
              handleUpdate(editingSubqueryId, { subquery: subqueryAST });
            }
            setEditingSubqueryId(null);
          }}
          onCancel={() => setEditingSubqueryId(null)}
          nodes={nodes}
          edges={edges}
          dbType={dbType}
          title={
            editingSubqueryId === 'new'
              ? 'Criar Subselect'
              : 'Editar Subselect'
          }
        />
      )}
    </Box>
  );
}
