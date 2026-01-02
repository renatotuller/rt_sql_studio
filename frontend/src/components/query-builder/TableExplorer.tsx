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
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { GraphNode, Column, GraphEdge } from '../../api/client';
import { findTablesWithRelationships } from '../../utils/query-builder/graph-path-finder';

interface TableExplorerProps {
  nodes: GraphNode[];
  edges?: GraphEdge[];
  expandedTables: Set<string>;
  onToggleExpand: (tableId: string) => void;
  onColumnDragStart: (tableId: string, column: Column) => void;
  onDragEnd?: () => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  includedTables?: Set<string>;
  baseTableId?: string;
  useDndKit?: boolean; // Se true, usa @dnd-kit ao invés de drag and drop nativo
}

// Componente para coluna arrastável usando @dnd-kit
function DraggableColumn({
  tableId,
  column,
  useDndKit,
  onColumnDragStart,
  onDragEnd,
}: {
  tableId: string;
  column: Column;
  useDndKit?: boolean;
  onColumnDragStart: (tableId: string, column: Column) => void;
  onDragEnd?: () => void;
}) {
  const theme = useTheme();
  const dragId = `column-${tableId}-${column.name}`;
  
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragId,
    data: {
      type: 'column',
      tableId,
      column: column.name,
    },
    disabled: !useDndKit,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  // Se não usar dnd-kit, usar drag and drop nativo
  if (!useDndKit) {
    const handleDragStart = (e: React.DragEvent) => {
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
      
      const dragImage = document.createElement('div');
      dragImage.textContent = column.name;
      dragImage.style.position = 'absolute';
      dragImage.style.top = '-1000px';
      dragImage.style.left = '-1000px';
      dragImage.style.padding = '4px 8px';
      dragImage.style.backgroundColor = theme.palette.primary.main;
      dragImage.style.color = theme.palette.primary.contrastText;
      dragImage.style.borderRadius = '4px';
      dragImage.style.fontSize = '0.75rem';
      dragImage.style.fontWeight = '500';
      dragImage.style.whiteSpace = 'nowrap';
      dragImage.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, dragImage.offsetWidth / 2, dragImage.offsetHeight / 2);
      setTimeout(() => {
        document.body.removeChild(dragImage);
      }, 0);
      
      onColumnDragStart(tableId, column);
    };

    return (
      <ListItemButton
        draggable
        onDragStart={handleDragStart}
        onDragEnd={onDragEnd}
        sx={{
          px: 1,
          py: 0.25,
          borderRadius: 0.5,
          cursor: 'grab',
          fontSize: '0.65rem !important',
          minHeight: 'auto',
          '& .MuiListItemText-primary': {
            fontSize: '0.65rem !important',
          },
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
              fontSize: 10,
              color: 'text.disabled',
            }}
          />
        </ListItemIcon>
        {column.isPrimaryKey && (
          <ListItemIcon sx={{ minWidth: 16 }}>
            <VpnKeyIcon
              sx={{
                fontSize: 10,
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
                fontSize: 10,
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
              fontSize: '0.65rem !important',
              lineHeight: 1.1,
              fontWeight: 400,
              '& .MuiTypography-root': {
                fontSize: '0.65rem !important',
              },
            },
          }}
        />
        <Typography
          variant="caption"
          noWrap
          sx={{
            color: 'text.secondary',
            fontSize: '0.6rem !important',
            maxWidth: 80,
            lineHeight: 1.1,
            fontWeight: 400,
          }}
          title={column.type}
        >
          {column.type}
        </Typography>
      </ListItemButton>
    );
  }

  // Usar @dnd-kit
  return (
    <ListItemButton
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      sx={{
        px: 1,
        py: 0.25,
        borderRadius: 0.5,
        cursor: isDragging ? 'grabbing' : 'grab',
        fontSize: '0.65rem !important',
        minHeight: 'auto',
        opacity: isDragging ? 0.5 : 1,
        ...(style || {}),
        '& .MuiListItemText-primary': {
          fontSize: '0.65rem !important',
        },
        '&:hover': {
          bgcolor: 'action.hover',
        },
      }}
    >
      <ListItemIcon sx={{ minWidth: 20 }}>
        <DragIndicatorIcon
          sx={{
            fontSize: 10,
            color: 'text.disabled',
          }}
        />
      </ListItemIcon>
      {column.isPrimaryKey && (
        <ListItemIcon sx={{ minWidth: 16 }}>
          <VpnKeyIcon
            sx={{
              fontSize: 10,
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
              fontSize: 10,
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
            fontSize: '0.65rem !important',
            lineHeight: 1.1,
            fontWeight: 400,
            '& .MuiTypography-root': {
              fontSize: '0.65rem !important',
            },
          },
        }}
      />
      <Typography
        variant="caption"
        noWrap
        sx={{
          color: 'text.secondary',
          fontSize: '0.6rem !important',
          maxWidth: 80,
          lineHeight: 1.1,
          fontWeight: 400,
        }}
        title={column.type}
      >
        {column.type}
      </Typography>
    </ListItemButton>
  );
}

export default function TableExplorer({
  nodes,
  edges = [],
  expandedTables,
  onToggleExpand,
  onColumnDragStart,
  onDragEnd,
  searchTerm,
  onSearchChange,
  includedTables = new Set(),
  baseTableId,
  useDndKit = false,
}: TableExplorerProps) {
  const theme = useTheme();
  
  // Calcular tabelas relacionadas
  const relatedTableIds = useMemo(() => {
    if (!edges || edges.length === 0 || includedTables.size === 0) {
      return new Set<string>();
    }
    
    const relatedTables = findTablesWithRelationships(nodes, edges, includedTables);
    return new Set(relatedTables.map(t => t.tableId));
  }, [nodes, edges, includedTables]);
  
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
              const isRelated = relatedTableIds.has(node.id) && !isIncluded;
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
                        sx: {
                          fontSize: '0.7rem !important',
                          lineHeight: 1.2,
                        },
                      }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
                      {/* Badge INCLUÍDA */}
                      {isIncluded && (
                        <Chip
                          label="INCLUÍDA"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            bgcolor: theme.palette.mode === 'dark' 
                              ? theme.palette.success.dark 
                              : theme.palette.success.light,
                            color: theme.palette.mode === 'dark'
                              ? theme.palette.success.contrastText
                              : theme.palette.success.dark,
                            minWidth: 60,
                          }}
                        />
                      )}
                      {/* Badge RELACIONADA */}
                      {isRelated && (
                        <Chip
                          label="RELACIONADA"
                          size="small"
                          sx={{
                            height: 18,
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            bgcolor: theme.palette.mode === 'dark'
                              ? alpha(theme.palette.warning.main, 0.3)
                              : alpha(theme.palette.warning.main, 0.15),
                            color: theme.palette.mode === 'dark'
                              ? theme.palette.warning.light
                              : theme.palette.warning.dark,
                            minWidth: 70,
                          }}
                        />
                      )}
                      {/* Badge com quantidade de colunas */}
                      <Chip
                        label={node.columns?.length || 0}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.6875rem',
                          minWidth: 24,
                        }}
                      />
                    </Box>
                  </ListItemButton>

                  {/* Lista de colunas (quando expandido) */}
                  {isExpanded && node.columns && (
                    <Box sx={{ ml: 3, mt: 0.5 }}>
                      {node.columns.map(column => (
                        <DraggableColumn
                          key={column.name}
                          tableId={node.id}
                          column={column}
                          useDndKit={useDndKit}
                          onColumnDragStart={onColumnDragStart}
                          onDragEnd={onDragEnd}
                        />
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
