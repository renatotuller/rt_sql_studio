/**
 * Componente para visualizar o grafo da query atual
 * Mostra apenas as tabelas e relacionamentos usados na query
 */

import { useEffect, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Box, Typography, useTheme } from '@mui/material';
import { AccountTree as GitBranchIcon } from '@mui/icons-material';
import type { GraphNode, GraphEdge } from '../../api/client';

interface QueryGraphViewerProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  includedTableIds: Set<string>;
}

export default function QueryGraphViewer({
  nodes,
  edges,
  includedTableIds,
}: QueryGraphViewerProps) {
  const theme = useTheme();
  
  // Filtrar apenas as tabelas incluídas na query
  const queryNodes = useMemo(() => {
    return nodes.filter(node => includedTableIds.has(node.id));
  }, [nodes, includedTableIds]);

  // Filtrar apenas os relacionamentos entre as tabelas incluídas
  const queryEdges = useMemo(() => {
    return edges.filter(edge => 
      includedTableIds.has(edge.from) && includedTableIds.has(edge.to)
    );
  }, [edges, includedTableIds]);

  // Converter para formato ReactFlow
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (queryNodes.length === 0) {
      setFlowNodes([]);
      setFlowEdges([]);
      return;
    }

    // Calcular layout simples em grid
    const nodesPerRow = Math.ceil(Math.sqrt(queryNodes.length)) || 1;
    const nodeSpacing = { x: 300, y: 250 };
    const padding = 100;

    const newFlowNodes: Node[] = queryNodes.map((node, index) => ({
      id: node.id,
      type: 'default',
      position: {
        x: (index % nodesPerRow) * nodeSpacing.x + padding,
        y: Math.floor(index / nodesPerRow) * nodeSpacing.y + padding,
      },
      data: {
        label: (
          <Box sx={{ p: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {node.label}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {node.type === 'view' ? 'VIEW' : 'TABLE'}
            </Typography>
          </Box>
        ),
      },
      style: {
        background: theme.palette.mode === 'dark' ? theme.palette.grey[800] : theme.palette.grey[50],
        border: `2px solid ${theme.palette.primary.main}`,
        borderRadius: 8,
        padding: 0,
        minWidth: 150,
      },
    }));

    const newFlowEdges: Edge[] = queryEdges.map(edge => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      label: `${edge.fromColumn} → ${edge.toColumn}`,
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: theme.palette.primary.main,
        strokeWidth: 2,
      },
      labelStyle: {
        fill: theme.palette.text.primary,
        fontWeight: 500,
        fontSize: '0.75rem',
      },
    }));

    setFlowNodes(newFlowNodes);
    setFlowEdges(newFlowEdges);
  }, [queryNodes, queryEdges, theme, setFlowNodes, setFlowEdges]);

  if (queryNodes.length === 0) {
    return (
      <Box 
        sx={{ 
          height: '100%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          flexDirection: 'column',
        }}
      >
        <GitBranchIcon sx={{ fontSize: 48, opacity: 0.5, mb: 2, color: 'text.disabled' }} />
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
          Nenhuma tabela selecionada
        </Typography>
        <Typography variant="caption" color="text.disabled">
          Adicione colunas de tabelas para visualizar o grafo
        </Typography>
      </Box>
    );
  }

  return (
    <ReactFlowProvider>
      <Box sx={{ width: '100%', height: '100%' }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          fitViewOptions={{ padding: 0.2 }}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </Box>
    </ReactFlowProvider>
  );
}

