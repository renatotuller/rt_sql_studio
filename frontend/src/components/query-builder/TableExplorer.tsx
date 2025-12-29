/**
 * Componente de exploração de tabelas (catálogo)
 * Permite visualizar e arrastar colunas para o Query Builder
 */

import { useState, useMemo } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  ChevronRight as ChevronRightIcon,
  ExpandMore as ExpandMoreIcon,
  TableChart as TableChartIcon,
  Visibility as VisibilityIcon,
  Search as SearchIcon,
  DragIndicator as DragIndicatorIcon,
  VpnKey as VpnKeyIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import type { GraphNode, Column } from '../../api/client';

interface TableExplorerProps {
  nodes: GraphNode[];
  expandedTables: Set<string>;
  onToggleExpand: (tableId: string) => void;
  onColumnDragStart: (tableId: string, column: Column) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  includedTables?: Set<string>;
  baseTableId?: string;
}

export default function TableExplorer({
  nodes,
  expandedTables,
  onToggleExpand,
  onColumnDragStart,
  searchTerm,
  onSearchChange,
  includedTables = new Set(),
  baseTableId,
}: TableExplorerProps) {
  const theme = useTheme();
  
  // Filtrar e ordenar nós
  const filteredNodes = useMemo(() => {
    let filtered = nodes;
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = nodes.filter(node => 
        node.label.toLowerCase().includes(term) ||
        node.columns?.some(col => col.name.toLowerCase().includes(term))
      );
    }
    
    // Ordenar: tabelas incluídas primeiro, depois por nome
    return [...filtered].sort((a, b) => {
      const aIncluded = includedTables.has(a.id) || a.id === baseTableId;
      const bIncluded = includedTables.has(b.id) || b.id === baseTableId;
      
      if (aIncluded && !bIncluded) return -1;
      if (!aIncluded && bIncluded) return 1;
      
      return a.label.localeCompare(b.label);
    });
  }, [nodes, searchTerm, includedTables, baseTableId]);

  const handleDragStart = (e: React.DragEvent, tableId: string, column: Column) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'column',
      tableId,
      column: {
        name: column.name,
        type: column.type,
        isPrimaryKey: column.isPrimaryKey,
        isForeignKey: column.isForeignKey,
      },
    }));
    e.dataTransfer.effectAllowed = 'copy';
    onColumnDragStart(tableId, column);
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
      }}
    >
      {/* Header com busca */}
      <Box
        sx={{
          px: 1,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="Buscar tabelas ou colunas..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiInputBase-root': {
              fontSize: '0.75rem',
              height: '28px',
            },
            '& .MuiInputBase-input': {
              py: 0.5,
            },
          }}
        />
      </Box>

      {/* Lista de tabelas */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 1,
        }}
      >
        {filteredNodes.length === 0 ? (
          <Box
            sx={{
              textAlign: 'center',
              py: 4,
              color: 'text.secondary',
            }}
          >
            <Typography variant="body2">Nenhuma tabela encontrada</Typography>
          </Box>
        ) : (
          <List dense sx={{ p: 0 }}>
            {filteredNodes.map(node => {
              const isExpanded = expandedTables.has(node.id);
              const isIncluded = includedTables.has(node.id) || node.id === baseTableId;
              const isView = node.type === 'view';

              return (
                <Box key={node.id}>
                  {/* Header da tabela */}
                  <ListItemButton
                    onClick={() => onToggleExpand(node.id)}
                    sx={{
                      px: 1,
                      py: 0.5,
                      borderRadius: 1,
                      bgcolor: isIncluded
                        ? alpha(theme.palette.primary.main, 0.08)
                        : 'transparent',
                      '&:hover': {
                        bgcolor: isIncluded
                          ? alpha(theme.palette.primary.main, 0.12)
                          : 'action.hover',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 24 }}>
                      {isExpanded ? (
                        <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      ) : (
                        <ChevronRightIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      )}
                    </ListItemIcon>
                    <ListItemIcon sx={{ minWidth: 20 }}>
                      {isView ? (
                        <VisibilityIcon
                          sx={{
                            fontSize: 16,
                            color: isIncluded ? 'primary.main' : 'warning.main',
                          }}
                        />
                      ) : (
                        <TableChartIcon
                          sx={{
                            fontSize: 16,
                            color: isIncluded ? 'primary.main' : 'text.secondary',
                          }}
                        />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={node.label}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: 500,
                        color: isIncluded ? 'primary.dark' : 'text.primary',
                        noWrap: true,
                      }}
                    />
                    <Chip
                      label={node.columns?.length || 0}
                      size="small"
                      sx={{
                        height: 18,
                        fontSize: '0.6875rem',
                        minWidth: 24,
                      }}
                    />
                  </ListItemButton>

                  {/* Lista de colunas (quando expandido) */}
                  {isExpanded && node.columns && (
                    <Box sx={{ ml: 3, mt: 0.5 }}>
                      {node.columns.map(column => (
                        <ListItemButton
                          key={column.name}
                          draggable
                          onDragStart={(e) => handleDragStart(e, node.id, column)}
                          sx={{
                            px: 1,
                            py: 0.25,
                            borderRadius: 0.5,
                            cursor: 'grab',
                            '&:active': {
                              cursor: 'grabbing',
                            },
                            '&:hover': {
                              bgcolor: 'action.hover',
                            },
                          }}
                        >
                          <ListItemIcon sx={{ minWidth: 20 }}>
                            <DragIndicatorIcon
                              sx={{
                                fontSize: 12,
                                color: 'text.disabled',
                              }}
                            />
                          </ListItemIcon>
                          {column.isPrimaryKey && (
                            <ListItemIcon sx={{ minWidth: 16 }}>
                              <VpnKeyIcon
                                sx={{
                                  fontSize: 12,
                                  color: 'warning.main',
                                }}
                                titleAccess="Primary Key"
                              />
                            </ListItemIcon>
                          )}
                          {column.isForeignKey && !column.isPrimaryKey && (
                            <ListItemIcon sx={{ minWidth: 16 }}>
                              <LinkIcon
                                sx={{
                                  fontSize: 12,
                                  color: 'primary.main',
                                }}
                                titleAccess="Foreign Key"
                              />
                            </ListItemIcon>
                          )}
                          <ListItemText
                            primary={column.name}
                            primaryTypographyProps={{
                              variant: 'body2',
                              noWrap: true,
                              sx: {
                                fontSize: '0.7rem',
                              },
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{
                              color: 'text.secondary',
                              fontSize: '0.625rem',
                              maxWidth: 80,
                              noWrap: true,
                            }}
                            title={column.type}
                          >
                            {column.type}
                          </Typography>
                        </ListItemButton>
                      ))}
                    </Box>
                  )}
                </Box>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
}
