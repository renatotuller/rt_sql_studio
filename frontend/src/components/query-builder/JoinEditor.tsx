/**
 * Componente para visualizar e editar JOINs
 * Mostra a cadeia de joins e permite editar tipo e condições
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Paper,
  Chip,
  useTheme,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  Storage as StorageIcon,
  Code as CodeIcon,
  Add as AddIcon,
} from '@mui/icons-material';
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
  const theme = useTheme();
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
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            JOINs (0)
          </Typography>
          {onAddManual && (
            <Button
              onClick={() => setShowManualJoinCreator(true)}
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
              title="Criar JOIN manualmente"
            >
              Adicionar JOIN
            </Button>
          )}
        </Box>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', p: 4, textAlign: 'center' }}>
          <Box sx={{ color: 'text.secondary' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
              Nenhum JOIN adicionado
            </Typography>
            <Typography variant="caption" display="block">
              JOINs serão criados automaticamente ao adicionar colunas de outras tabelas
            </Typography>
            <Typography variant="caption" display="block" sx={{ mt: 1 }}>
              ou clique em "Adicionar JOIN" para criar manualmente
            </Typography>
          </Box>
        </Box>

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
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          JOINs ({joins.length})
        </Typography>
        {onAddManual && (
          <Button
            onClick={() => setShowManualJoinCreator(true)}
            variant="contained"
            size="small"
            startIcon={<AddIcon />}
            sx={{ textTransform: 'none', fontSize: '0.75rem', px: 1.5, py: 0.5 }}
            title="Criar JOIN manualmente"
          >
            Adicionar JOIN
          </Button>
        )}
      </Box>
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {/* Mostrar cada JOIN (com tabela base quando for o primeiro) */}
        {joins.map((join, index) => {
          const isExpanded = expandedJoins.has(join.id);
          const sourceName = getTableDisplayName(join.sourceTableId);
          const targetName = getTableDisplayName(join.targetTableId);
          const isFirstJoin = index === 0;
          const showBaseTable = isFirstJoin && !isExpanded;

          return (
            <Box key={join.id} sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {isExpanded && isFirstJoin && (
                <>
                  {/* Mostrar tabela base separada quando expandido */}
                  <Paper
                    elevation={0}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 1,
                      bgcolor: theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                      border: 1,
                      borderColor: 'primary.main',
                      borderRadius: 1,
                    }}
                  >
                    {fromSubquery ? (
                      <>
                        <CodeIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: 'primary.contrastText',
                          }}
                        >
                          (SELECT ...) AS {baseTableAlias}
                        </Typography>
                        <Chip
                          label="SUBQUERY"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.625rem',
                            bgcolor: theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.main',
                            color: 'primary.contrastText',
                          }}
                        />
                        {onSetFromSubquery && (
                          <Button
                            onClick={() => setEditingFromSubquery(true)}
                            size="small"
                            variant="contained"
                            startIcon={<CodeIcon sx={{ fontSize: 12 }} />}
                            sx={{
                              ml: 'auto',
                              px: 1,
                              py: 0.25,
                              fontSize: '0.625rem',
                              textTransform: 'none',
                              minWidth: 'auto',
                            }}
                            title="Editar subselect"
                          >
                            Editar
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <StorageIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            color: 'primary.contrastText',
                          }}
                        >
                          {getTableDisplayName(baseTableId)} AS {baseTableAlias}
                        </Typography>
                        <Chip
                          label="BASE"
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.625rem',
                            bgcolor: theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.main',
                            color: 'primary.contrastText',
                          }}
                        />
                        {onSetFromSubquery && (
                          <Button
                            onClick={() => setEditingFromSubquery(true)}
                            size="small"
                            variant="contained"
                            color="success"
                            startIcon={<CodeIcon sx={{ fontSize: 12 }} />}
                            sx={{
                              ml: 'auto',
                              px: 1,
                              py: 0.25,
                              fontSize: '0.625rem',
                              textTransform: 'none',
                              minWidth: 'auto',
                            }}
                            title="Usar subselect no FROM"
                          >
                            Subselect
                          </Button>
                        )}
                      </>
                    )}
                  </Paper>
                  <ChevronRightIcon sx={{ fontSize: 16, color: 'text.disabled', ml: 1 }} />
                </>
              )}
              <Paper
                elevation={0}
                sx={{
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.800' : 'grey.50',
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                {/* Header do JOIN (sempre visível, compacto quando contraído) */}
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: isExpanded ? 1.5 : 1,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
                    <IconButton
                      onClick={() => toggleJoin(join.id)}
                      size="small"
                      sx={{ p: 0.5, flexShrink: 0 }}
                      title={isExpanded ? 'Contrair' : 'Expandir'}
                    >
                      {isExpanded ? (
                        <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      ) : (
                        <ChevronRightIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      )}
                    </IconButton>
                    {isExpanded ? (
                      // Layout expandido: badge do tipo + ícone + tabela
                      <>
                        <Chip
                          label={join.type}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            bgcolor: theme.palette.mode === 'dark' ? 'secondary.dark' : 'secondary.light',
                            color: theme.palette.mode === 'dark' ? 'secondary.contrastText' : 'secondary.dark',
                          }}
                        />
                        <StorageIcon sx={{ fontSize: 14, color: 'text.secondary', flexShrink: 0 }} />
                        <Typography
                          variant="caption"
                          noWrap
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {targetName} AS {join.targetAlias}
                        </Typography>
                      </>
                    ) : (
                      // Layout contraído: tabela base + tipo + tabela destino + condição ON (tudo em uma linha)
                      <Typography
                        variant="caption"
                        noWrap
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {showBaseTable ? (
                          <>
                            {getTableDisplayName(baseTableId)} AS {baseTableAlias} {join.type} {targetName} AS {join.targetAlias} ON {formatJoinCondition(join)}
                          </>
                        ) : (
                          <>
                            {sourceName} AS {join.sourceAlias} {join.type} {targetName} AS {join.targetAlias} ON {formatJoinCondition(join)}
                          </>
                        )}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 1, flexShrink: 0 }}>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(join);
                      }}
                      size="small"
                      sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                      title="Editar"
                    >
                      <EditIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(join.id);
                      }}
                      size="small"
                      sx={{ p: 0.5, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                      title="Remover"
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                </Box>
                
                {/* Conteúdo expandido do JOIN */}
                {isExpanded && (
                  <Box sx={{ px: 1.5, pb: 1.5, pt: 0, borderTop: 1, borderColor: 'divider' }}>
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="caption" sx={{ fontWeight: 500, display: 'block', mb: 0.5 }}>
                        Condição do JOIN:
                      </Typography>
                      <Paper
                        elevation={0}
                        sx={{
                          p: 1,
                          bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.100',
                          borderRadius: 1,
                        }}
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.75rem',
                            color: 'text.secondary',
                          }}
                        >
                          ON {formatJoinCondition(join)}
                        </Typography>
                      </Paper>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Box>
          );
        })}
      </Box>

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
    </Box>
  );
}
