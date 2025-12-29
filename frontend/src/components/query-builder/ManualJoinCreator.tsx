/**
 * Componente para criar JOINs manualmente
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  Chip,
  Alert,
  useTheme,
  alpha,
  Grid,
} from '@mui/material';
import {
  Close as CloseIcon,
  Add as AddIcon,
  Code as CodeIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
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
  const theme = useTheme();
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
    <Dialog
      open={true}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
        }}
      >
        <Box>
          <Typography variant="h6">
            {isEditing ? 'Editar JOIN Manual' : 'Criar JOIN Manual'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isEditing 
              ? 'Edite o relacionamento entre as tabelas'
              : 'Defina manualmente um relacionamento entre tabelas'}
          </Typography>
        </Box>
        <IconButton
          onClick={onCancel}
          size="small"
          sx={{ color: 'text.secondary' }}
          title="Fechar"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ overflow: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {/* Tipo de JOIN */}
          <FormControl fullWidth size="small">
            <InputLabel>Tipo de JOIN</InputLabel>
            <Select
              value={joinType}
              onChange={e => setJoinType(e.target.value as JoinType)}
              label="Tipo de JOIN"
            >
              {JOIN_TYPES.map(type => (
                <MenuItem key={type} value={type}>
                  {type} JOIN
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Tabela de Origem */}
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
              Tabela de Origem <Typography component="span" color="error">*</Typography>
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Selecione a tabela ou VIEW que já está na query e será a origem do JOIN
            </Typography>
            {preselectedSourceTableId && !isEditing && (
              <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
                <Typography variant="caption">
                  <strong>ℹ️ Tabela pré-selecionada:</strong> A primeira tabela da query foi automaticamente selecionada como origem.
                </Typography>
              </Alert>
            )}
            <FormControl fullWidth size="small">
              <Select
                value={sourceTableId}
                onChange={e => {
                  setSourceTableId(e.target.value);
                  // Resetar todas as condições ao mudar tabela de origem
                  setConditions([{ id: `cond-${Date.now()}`, sourceColumn: '', targetColumn: '' }]);
                }}
                displayEmpty
              >
                {availableSourceTables.length === 0 ? (
                  <MenuItem value="">Nenhuma tabela disponível</MenuItem>
                ) : (
                  availableSourceTables.map(tableId => {
                    const tableName = getTableDisplayName(tableId);
                    return (
                      <MenuItem key={tableId} value={tableId}>
                        {tableName}
                      </MenuItem>
                    );
                  })
                )}
              </Select>
            </FormControl>
          </Box>

          {/* Tabela de Destino */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                  Tabela de Destino <Typography component="span" color="error">*</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Selecione uma tabela/VIEW ou use um subselect como destino
                </Typography>
              </Box>
              <Button
                size="small"
                variant={useSubqueryAsTarget ? 'contained' : 'outlined'}
                color={useSubqueryAsTarget ? 'success' : 'inherit'}
                startIcon={<CodeIcon />}
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
                sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
                title={useSubqueryAsTarget ? 'Usar tabela/VIEW como destino' : 'Usar subselect como destino'}
              >
                {useSubqueryAsTarget ? 'Usar Tabela' : 'Usar Subselect'}
              </Button>
            </Box>
            
            {preselectedTargetTableId && !isEditing && !useSubqueryAsTarget && (
              <Alert severity="info" sx={{ mb: 1, py: 0.5 }}>
                <Typography variant="caption">
                  <strong>ℹ️ VIEW pré-selecionada:</strong> A VIEW que você arrastou foi automaticamente selecionada como destino.
                </Typography>
              </Alert>
            )}

            {useSubqueryAsTarget ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {targetSubquery ? (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      bgcolor: theme.palette.mode === 'dark' ? 'success.dark' : 'success.light',
                      border: 1,
                      borderColor: 'success.main',
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CodeIcon sx={{ fontSize: 16, color: 'success.main' }} />
                        <Typography variant="body2" sx={{ fontWeight: 500, color: 'success.contrastText' }}>
                          Subselect configurado
                        </Typography>
                        <Chip
                          label={`Alias: ${targetSubqueryAlias || 'não definido'}`}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.625rem',
                            bgcolor: theme.palette.mode === 'dark' ? 'success.dark' : 'success.main',
                            color: 'success.contrastText',
                          }}
                        />
                      </Box>
                      <Button
                        size="small"
                        variant="contained"
                        color="success"
                        startIcon={<CodeIcon sx={{ fontSize: 12 }} />}
                        onClick={() => setEditingSubquery(true)}
                        sx={{ textTransform: 'none', fontSize: '0.625rem', px: 1, py: 0.25 }}
                        title="Editar subselect"
                      >
                        Editar
                      </Button>
                    </Box>
                    <Typography variant="caption" sx={{ color: 'success.contrastText' }}>
                      Subselect criado com sucesso. Configure as condições de JOIN abaixo.
                    </Typography>
                  </Paper>
                ) : (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      bgcolor: theme.palette.mode === 'dark' ? 'warning.dark' : 'warning.light',
                      border: 1,
                      borderColor: 'warning.main',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2" sx={{ mb: 1, color: 'warning.contrastText' }}>
                      Nenhum subselect configurado
                    </Typography>
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      startIcon={<CodeIcon />}
                      onClick={() => setEditingSubquery(true)}
                      sx={{ textTransform: 'none', fontSize: '0.75rem' }}
                      title="Criar subselect"
                    >
                      Criar Subselect
                    </Button>
                  </Paper>
                )}
              </Box>
            ) : (
              <FormControl fullWidth size="small">
                <Select
                  value={targetTableId}
                  onChange={e => {
                    setTargetTableId(e.target.value);
                    // Resetar todas as condições ao mudar tabela de destino
                    setConditions([{ id: `cond-${Date.now()}`, sourceColumn: '', targetColumn: '' }]);
                  }}
                  displayEmpty
                >
                  <MenuItem value="">Selecione uma tabela ou VIEW</MenuItem>
                  {availableTargetTables.map(table => {
                    const isPreselected = table.id === preselectedTargetTableId;
                    return (
                      <MenuItem key={table.id} value={table.id}>
                        {isPreselected ? '⭐ ' : ''}{table.name}
                      </MenuItem>
                    );
                  })}
                </Select>
              </FormControl>
            )}
          </Box>

          {/* Condições de JOIN (múltiplas com AND) */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Condições de JOIN (AND) <Typography component="span" color="error">*</Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Defina como as tabelas serão relacionadas. Você pode adicionar múltiplas condições que serão combinadas com AND.
                </Typography>
              </Box>
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={addCondition}
                sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1 }}
                title="Adicionar condição"
              >
                Adicionar Condição
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {conditions.map((condition, index) => (
                <Paper
                  key={condition.id}
                  elevation={0}
                  sx={{
                    p: 1.5,
                    bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 500, color: 'text.secondary', width: 32, flexShrink: 0 }}>
                    {index + 1}.
                  </Typography>
                  <Grid container spacing={1} sx={{ flex: 1 }}>
                    <Grid item xs={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Coluna Origem</InputLabel>
                        <Select
                          value={condition.sourceColumn}
                          onChange={e => updateCondition(condition.id, 'sourceColumn', e.target.value)}
                          disabled={!sourceTableId}
                          label="Coluna Origem"
                        >
                          <MenuItem value="">Selecione...</MenuItem>
                          {sourceColumns.map(col => (
                            <MenuItem key={col.name} value={col.name}>
                              {col.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={6}>
                      <FormControl fullWidth size="small">
                        <InputLabel>Coluna Destino</InputLabel>
                        <Select
                          value={condition.targetColumn}
                          onChange={e => updateCondition(condition.id, 'targetColumn', e.target.value)}
                          disabled={useSubqueryAsTarget ? (!targetSubquery || !targetSubqueryAlias) : !targetTableId}
                          label="Coluna Destino"
                        >
                          <MenuItem value="">Selecione...</MenuItem>
                          {targetColumns.map(col => (
                            <MenuItem key={col.name} value={col.name}>
                              {col.name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                  {conditions.length > 1 && (
                    <IconButton
                      onClick={() => removeCondition(condition.id)}
                      size="small"
                      sx={{ color: 'error.main', flexShrink: 0 }}
                      title="Remover condição"
                    >
                      <DeleteIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  )}
                </Paper>
              ))}
            </Box>
          </Box>

          {/* Preview */}
          {sourceTableId && (targetTableId || (useSubqueryAsTarget && targetSubquery)) && conditions.some(c => c.sourceColumn && c.targetColumn) && (
            <Paper
              elevation={0}
              sx={{
                mt: 2,
                p: 2,
                bgcolor: theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                border: 1,
                borderColor: 'primary.main',
                borderRadius: 1,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: 'primary.contrastText',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {joinType} JOIN {
                  useSubqueryAsTarget && targetSubquery
                    ? `(SELECT ...) AS ${targetSubqueryAlias || 'sub'}`
                    : `${getTableDisplayName(targetTableId)} AS ${generateApproximateAlias(targetTableId)}`
                }
                {'\n'}
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
              </Typography>
            </Paper>
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
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onCancel} variant="outlined" size="small">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="small"
          disabled={
            !sourceTableId || 
            !conditions.some(c => c.sourceColumn && c.targetColumn) ||
            (!useSubqueryAsTarget && !targetTableId) ||
            (useSubqueryAsTarget && (!targetSubquery || !targetSubqueryAlias))
          }
          startIcon={isEditing ? <CloseIcon sx={{ transform: 'rotate(45deg)' }} /> : <AddIcon />}
        >
          {isEditing ? 'Salvar Alterações' : 'Criar JOIN'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
