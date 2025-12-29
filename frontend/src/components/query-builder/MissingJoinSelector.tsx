/**
 * Componente para selecionar uma tabela intermediária quando não há JOIN compatível
 */

import { useState, useMemo } from 'react';
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
  InputAdornment,
  Paper,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Check as CheckIcon,
  Warning as WarningIcon,
  Link as LinkIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
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
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');

  // Encontrar TODAS as tabelas intermediárias possíveis que conectam sourceTableId com targetTableId
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
    <Dialog
      open={true}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <WarningIcon sx={{ fontSize: 24, color: 'warning.main' }} />
          <Box>
            <Typography variant="h6">JOIN não encontrado</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              Não foi possível encontrar um relacionamento direto entre as tabelas
            </Typography>
          </Box>
        </Box>
        <IconButton
          onClick={onCancel}
          size="small"
          sx={{ color: 'text.secondary' }}
          title="Cancelar"
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ flex: 1, overflow: 'auto' }}>
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            p: 1.5,
            bgcolor: theme.palette.mode === 'dark' ? 'warning.dark' : 'warning.light',
            border: 1,
            borderColor: 'warning.main',
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" sx={{ color: 'warning.contrastText', mb: 0.5 }}>
            <strong>Coluna selecionada:</strong>{' '}
            <Box component="code" sx={{ px: 0.5, py: 0.25, bgcolor: alpha(theme.palette.warning.main, 0.2), borderRadius: 0.5 }}>
              {targetTableName}.{targetColumn.name}
            </Box>
          </Typography>
          <Typography variant="body2" sx={{ color: 'warning.contrastText', mb: 0.5 }}>
            <strong>Tabela atual:</strong>{' '}
            <Box component="code" sx={{ px: 0.5, py: 0.25, bgcolor: alpha(theme.palette.warning.main, 0.2), borderRadius: 0.5 }}>
              {sourceTableName}
            </Box>
          </Typography>
          <Typography variant="body2" sx={{ color: 'warning.contrastText', mt: 1 }}>
            Selecione uma tabela abaixo que tenha relacionamento com ambas as tabelas para criar o JOIN necessário.
          </Typography>
        </Paper>

        {/* Busca */}
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar tabela..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {/* Lista de tabelas */}
        {filteredTables.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
            <WarningIcon sx={{ fontSize: 48, mx: 'auto', mb: 1, opacity: 0.5 }} />
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              {searchTerm ? 'Nenhuma tabela encontrada com o termo de busca.' : 'Nenhuma tabela com relacionamento disponível encontrada.'}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Você pode criar um JOIN manualmente através do editor de JOINs.
            </Typography>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {filteredTables.map(table => {
              const relationshipCount = table.relationshipCount || table.relationships.length;
              const relationshipText = relationshipCount === 1 
                ? '1 relacionamento' 
                : `${relationshipCount} relacionamentos`;

              return (
                <Paper
                  key={table.tableId}
                  component="button"
                  onClick={() => handleSelectTable(table.tableId)}
                  elevation={0}
                  sx={{
                    width: '100%',
                    p: 2,
                    textAlign: 'left',
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    cursor: 'pointer',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: alpha(theme.palette.primary.main, 0.04),
                    },
                    transition: 'all 0.2s',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <LinkIcon sx={{ fontSize: 16, color: 'primary.main', flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {table.tableName}
                        </Typography>
                        <Chip
                          label={relationshipText}
                          size="small"
                          sx={{
                            height: 20,
                            fontSize: '0.625rem',
                            bgcolor: theme.palette.mode === 'dark' ? 'primary.dark' : 'primary.light',
                            color: 'primary.contrastText',
                          }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: 'text.secondary',
                          display: 'block',
                          mb: 1,
                        }}
                      >
                        {table.tableId}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {table.relationships.slice(0, 3).map((rel, idx) => {
                          const relatedTableName = rel.relatedTableId.includes('.')
                            ? rel.relatedTableId.split('.').pop() || rel.relatedTableId
                            : rel.relatedTableId;
                          
                          return (
                            <Box
                              key={idx}
                              sx={{
                                fontSize: '0.75rem',
                                color: 'text.secondary',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 0.5,
                              }}
                            >
                              <Box
                                component="span"
                                sx={{
                                  px: 0.75,
                                  py: 0.25,
                                  bgcolor: theme.palette.mode === 'dark' ? 'grey.700' : 'grey.100',
                                  borderRadius: 0.5,
                                  fontFamily: 'monospace',
                                }}
                              >
                                {rel.direction === 'from' 
                                  ? `${relatedTableName}.${rel.edge.fromColumn} → ${table.tableName}.${rel.edge.toColumn}`
                                  : `${table.tableName}.${rel.edge.fromColumn} → ${relatedTableName}.${rel.edge.toColumn}`
                                }
                              </Box>
                            </Box>
                          );
                        })}
                        {table.relationships.length > 3 && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                            +{table.relationships.length - 3} relacionamento(s) adicional(is)
                          </Typography>
                        )}
                      </Box>
                    </Box>
                    <CheckIcon
                      sx={{
                        fontSize: 20,
                        color: 'primary.main',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                        flexShrink: 0,
                        ml: 1,
                        'button:hover &': {
                          opacity: 1,
                        },
                      }}
                    />
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          Selecione uma tabela para criar o JOIN necessário
        </Typography>
        <Button onClick={onCancel} variant="outlined" size="small">
          Cancelar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
