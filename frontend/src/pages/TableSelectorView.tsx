import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  addEdge,
  ReactFlowProvider,
  useReactFlow,
  ReactFlowInstance,
  Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  Button,
  IconButton,
  Typography,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  useTheme,
  alpha,
  Divider,
} from '@mui/material';
import {
  ArrowBack as ArrowLeftIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Fullscreen as Maximize2Icon,
  RotateLeft as RotateCcwIcon,
  ViewModule as LayoutGridIcon,
  Hub as NetworkIcon,
  GridOn as Grid3x3Icon,
  AccountTree as GitBranchIcon,
  VisibilityOff as EyeOffIcon,
  AutoAwesome as SparklesIcon,
  ViewComfy as BoxesIcon,
  Visibility as EyeIcon,
  List as ListIcon,
} from '@mui/icons-material';
import { schemaApi, connectionsApi } from '../api/client';
import DatabaseSchemaNode from '../components/schema/DatabaseSchemaNode';
import CustomEdge from '../components/schema/CustomEdge';
import { getLayoutedElements, type LayoutType } from '../utils/layout';
import CascadingTableSelector from '../components/CascadingTableSelector';
import RelationshipDetailsDialog from '../components/RelationshipDetailsDialog';
import InformativeLoading from '../components/InformativeLoading';

const nodeTypes = {
  databaseSchema: DatabaseSchemaNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

function TableSelectorViewContent() {
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [zoomLevel, setZoomLevel] = useState(0.8);
  const [allNodes, setAllNodes] = useState<Node[]>([]);
  const [allEdges, setAllEdges] = useState<Edge[]>([]);
  const [layoutType, setLayoutType] = useState<LayoutType>('hierarchical');
  const [simplifiedView, setSimplifiedView] = useState(false);
  const [semanticZoomEnabled, setSemanticZoomEnabled] = useState(true); // Zoom semântico ativo/desativo
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [showRelationshipDialog, setShowRelationshipDialog] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [selectedRelatedTables, setSelectedRelatedTables] = useState<Set<string>>(new Set());
  const [showTableSelector, setShowTableSelector] = useState(true); // Abrir automaticamente
  const [isSelectorCollapsed, setIsSelectorCollapsed] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false); // Snap to grid ativo/desativo
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const { getZoom, setViewport, zoomIn, zoomOut, fitView } = useReactFlow();

  useEffect(() => {
    if (connId) {
      loadConnection();
      loadGraph();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connId]);

  // Atualizar zoom nos nós quando o zoom mudar
  useEffect(() => {
    const handleZoomChange = () => {
      try {
        const zoom = getZoom();
        setZoomLevel(zoom);
        setNodes((nds) =>
          nds.map((node) => ({
            ...node,
            data: { ...node.data, zoomLevel: zoom, simplified: simplifiedView, semanticZoomEnabled },
          }))
        );
      } catch (e) {
        // Ignorar erros se o ReactFlow ainda não estiver inicializado
      }
    };
    
    const interval = setInterval(handleZoomChange, 200);
    return () => clearInterval(interval);
  }, [getZoom, setNodes, simplifiedView, semanticZoomEnabled]);

  // Atualizar modo simplificado nos nós
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: { ...node.data, simplified: simplifiedView, semanticZoomEnabled },
        width: simplifiedView ? 180 : 280,
        height: simplifiedView ? 60 : undefined,
      }))
    );
  }, [simplifiedView, semanticZoomEnabled, setNodes]);

  const loadConnection = async () => {
    try {
      const response = await connectionsApi.get(connId!);
      setConnectionName(response.data.name);
    } catch (error) {
      console.error('Erro ao carregar conexão:', error);
    }
  };

  const loadGraph = async () => {
    try {
      setLoading(true);
      const response = await schemaApi.getGraph(connId!);
      const graphData = response.data;

      const initialNodes: Node[] = graphData.nodes.map((node: any) => ({
        id: node.id,
        type: 'databaseSchema',
        position: { x: 0, y: 0 },
        data: {
          label: node.label,
          schema: node.schema,
          columns: node.columns || [],
          primaryKeys: node.primaryKeys || [],
          type: node.type,
          zoomLevel: 0.8,
          simplified: false,
          semanticZoomEnabled,
        },
      }));

      const initialEdges: Edge[] = graphData.edges.map((edge: any) => ({
        id: edge.id,
        source: edge.from,
        target: edge.to,
        type: 'custom',
        sourceHandle: edge.fromColumn ? `${edge.fromColumn}-source` : 'default-source',
        targetHandle: edge.toColumn ? `${edge.toColumn}-target` : 'default-target',
        data: {
          label: edge.label,
          fromTable: edge.from,
          fromColumn: edge.fromColumn || '',
          toTable: edge.to,
          toColumn: edge.toColumn || '',
          relationshipLabel: edge.label,
          relationshipType: edge.type || 'foreign_key',
        },
      }));

      setAllNodes(initialNodes);
      setAllEdges(initialEdges);
      
      // Inicialmente não mostrar nada até que uma tabela seja selecionada
      setNodes([]);
      setEdges([]);
      
      setLoading(false);
    } catch (err: any) {
      console.error('Erro ao carregar schema:', err);
      setError(err.response?.data?.error || 'Erro ao obter schema do banco de dados');
      setLoading(false);
    }
  };

  // Handler para seleção em cascata - mostrar apenas tabela principal + relacionadas selecionadas
  const handleCascadingTableSelect = useCallback((mainTable: string | null, selectedRelated: Set<string>) => {
    setSelectedTableId(mainTable);
    setSelectedRelatedTables(selectedRelated);
    
    if (!mainTable) {
      // Limpar seleção
      setNodes([]);
      setEdges([]);
      return;
    }

    // Criar conjunto de tabelas a exibir: APENAS tabela principal + tabelas relacionadas selecionadas
    const tablesToShow = new Set<string>([mainTable]);
    selectedRelated.forEach(tableId => tablesToShow.add(tableId));
    
    // Filtrar nós: apenas a tabela principal e as relacionadas selecionadas
    const filteredNodes = allNodes.filter(n => tablesToShow.has(n.id));
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    
    // Filtrar arestas: apenas as que conectam a tabela principal com as relacionadas selecionadas
    // OU as que conectam duas tabelas relacionadas selecionadas entre si
    const filteredEdges = allEdges.filter(e => {
      const fromId = e.source;
      const toId = e.target;
      
      // Aresta deve conectar a tabela principal com uma relacionada selecionada
      // OU conectar duas tabelas relacionadas selecionadas entre si
      const connectsToMain = (fromId === mainTable && selectedRelated.has(toId)) ||
                             (toId === mainTable && selectedRelated.has(fromId));
      const connectsRelated = selectedRelated.has(fromId) && selectedRelated.has(toId);
      
      return connectsToMain || connectsRelated;
    });

    // Aplicar layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      filteredNodes,
      filteredEdges,
      layoutType
    );

    // Garantir unicidade
    const uniqueNodesMap = new Map<string, Node>();
    layoutedNodes.forEach(node => {
      if (!uniqueNodesMap.has(node.id)) {
        uniqueNodesMap.set(node.id, node);
      }
    });
    const uniqueLayoutedNodes = Array.from(uniqueNodesMap.values());

    // Recriar arestas com handles corretos
    const nodeIds = new Set(uniqueLayoutedNodes.map(n => n.id));
    const recreatedEdges = layoutedEdges
      .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
      .map((edge) => {
        const sourceNode = uniqueLayoutedNodes.find(n => n.id === edge.source);
        const targetNode = uniqueLayoutedNodes.find(n => n.id === edge.target);
        
        const fromColumn = edge.data?.fromColumn || 
                         (edge.sourceHandle && edge.sourceHandle !== 'default-source' 
                           ? edge.sourceHandle.replace('-source', '') 
                           : '');
        const toColumn = edge.data?.toColumn || 
                       (edge.targetHandle && edge.targetHandle !== 'default-target' 
                         ? edge.targetHandle.replace('-target', '') 
                         : '');
        
        let sourceHandle = 'default-source';
        let targetHandle = 'default-target';
        
        if (fromColumn && sourceNode?.data?.columns) {
          const sourceHasColumn = sourceNode.data.columns.some((col: any) => col.name === fromColumn);
          if (sourceHasColumn) {
            sourceHandle = `${fromColumn}-source`;
          }
        }
        
        if (toColumn && targetNode?.data?.columns) {
          const targetHasColumn = targetNode.data.columns.some((col: any) => col.name === toColumn);
          if (targetHasColumn) {
            targetHandle = `${toColumn}-target`;
          }
        }
        
        return {
          ...edge,
          sourceHandle,
          targetHandle,
          data: {
            ...edge.data,
            fromTable: edge.data?.fromTable || edge.source,
            fromColumn: fromColumn || edge.data?.fromColumn || '',
            toTable: edge.data?.toTable || edge.target,
            toColumn: toColumn || edge.data?.toColumn || '',
            relationshipLabel: edge.data?.relationshipLabel || edge.data?.label,
            relationshipType: edge.data?.relationshipType || (edge.id.startsWith('fk_') ? 'foreign_key' : edge.id.startsWith('view_') ? 'view_relationship' : 'relationship'),
          },
        };
      });

    // Garantir que semanticZoomEnabled seja preservado
    const nodesWithSemanticZoom = uniqueLayoutedNodes.map(node => ({
      ...node,
      data: { ...node.data, semanticZoomEnabled },
    }));

    setNodes(nodesWithSemanticZoom);
    
    requestAnimationFrame(() => {
      setEdges(recreatedEdges);
      
      if (nodesWithSemanticZoom.length > 0 && reactFlowInstance.current) {
        setTimeout(() => {
          reactFlowInstance.current?.fitView({
            nodes: nodesWithSemanticZoom,
            padding: 0.5,
            duration: 500,
            maxZoom: 1.5,
            minZoom: 0.3,
          });
        }, 300);
      }
    });
  }, [allNodes, allEdges, layoutType, semanticZoomEnabled, setNodes, setEdges]);

  const handleApplyLayout = useCallback(async (type: LayoutType) => {
    setLayoutType(type);
    
    if (nodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        type
      );

      const uniqueNodesMap = new Map<string, Node>();
      layoutedNodes.forEach(node => {
        if (!uniqueNodesMap.has(node.id)) {
          uniqueNodesMap.set(node.id, node);
        }
      });
      const uniqueLayoutedNodes = Array.from(uniqueNodesMap.values());

      const nodeIds = new Set(uniqueLayoutedNodes.map(n => n.id));
      const recreatedEdges = layoutedEdges
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .map((edge) => {
          const sourceNode = uniqueLayoutedNodes.find(n => n.id === edge.source);
          const targetNode = uniqueLayoutedNodes.find(n => n.id === edge.target);
          
          let sourceHandle = edge.sourceHandle || 'default-source';
          let targetHandle = edge.targetHandle || 'default-target';
          
          if (sourceHandle !== 'default-source' && sourceNode?.data?.columns) {
            const columnName = sourceHandle.replace('-source', '');
            const sourceHasColumn = sourceNode.data.columns.some((col: any) => col.name === columnName);
            if (!sourceHasColumn) {
              sourceHandle = 'default-source';
            }
          }
          
          if (targetHandle !== 'default-target' && targetNode?.data?.columns) {
            const columnName = targetHandle.replace('-target', '');
            const targetHasColumn = targetNode.data.columns.some((col: any) => col.name === columnName);
            if (!targetHasColumn) {
              targetHandle = 'default-target';
            }
          }
          
          return {
            ...edge,
            sourceHandle,
            targetHandle,
            data: {
              ...edge.data,
              fromTable: edge.data?.fromTable || edge.source,
              fromColumn: edge.data?.fromColumn || '',
              toTable: edge.data?.toTable || edge.target,
              toColumn: edge.data?.toColumn || '',
              relationshipLabel: edge.data?.relationshipLabel || edge.data?.label,
              relationshipType: edge.data?.relationshipType || (edge.id.startsWith('fk_') ? 'foreign_key' : edge.id.startsWith('view_') ? 'view_relationship' : 'relationship'),
            },
          };
        });

      // Garantir que semanticZoomEnabled seja preservado
      const nodesWithSemanticZoom = uniqueLayoutedNodes.map(node => ({
        ...node,
        data: { ...node.data, semanticZoomEnabled },
      }));

      setNodes(nodesWithSemanticZoom);
      
      requestAnimationFrame(() => {
        setEdges(recreatedEdges);
        
        if (nodesWithSemanticZoom.length > 0 && reactFlowInstance.current) {
          setTimeout(() => {
            reactFlowInstance.current?.fitView({
              nodes: nodesWithSemanticZoom,
              padding: 0.5,
              duration: 500,
              maxZoom: 1.5,
              minZoom: 0.3,
            });
          }, 150);
        }
      });
    }
  }, [nodes, edges, semanticZoomEnabled, setNodes, setEdges]);

  // ============================================================================
  // Snap to Grid: Função para arredondar posições para a grade
  // ============================================================================
  const GRID_SIZE = 50; // Tamanho da grade em pixels
  
  const snapPosition = useCallback((position: { x: number; y: number }): { x: number; y: number } => {
    return {
      x: Math.round(position.x / GRID_SIZE) * GRID_SIZE,
      y: Math.round(position.y / GRID_SIZE) * GRID_SIZE,
    };
  }, []);
  
  // Interceptar onNodesChange para aplicar snap quando ativo
  const handleNodesChange = useCallback((changes: any[]) => {
    if (!snapToGrid) {
      // Se snap não está ativo, usar o handler padrão
      onNodesChange(changes);
      return;
    }
    
    // Aplicar snap apenas em mudanças de posição (drag)
    const modifiedChanges = changes.map((change) => {
      if (change.type === 'position' && change.position) {
        return {
          ...change,
          position: snapPosition(change.position),
        };
      }
      return change;
    });
    
    onNodesChange(modifiedChanges);
  }, [snapToGrid, onNodesChange, snapPosition]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onInit = useCallback((rfInstance: ReactFlowInstance) => {
    reactFlowInstance.current = rfInstance;
    setZoomLevel(rfInstance.getViewport().zoom);
  }, []);

  const onMove = useCallback((event: any, viewport: Viewport) => {
    setZoomLevel(viewport.zoom);
  }, []);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setSelectedEdge(edge);
    setShowRelationshipDialog(true);
  }, []);

  const handleZoomIn = useCallback(() => {
    reactFlowInstance.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    reactFlowInstance.current?.zoomOut();
  }, []);

  const handleFitView = useCallback(() => {
    reactFlowInstance.current?.fitView({ padding: 0.2, duration: 300 });
  }, []);

  const handleResetView = useCallback(() => {
    reactFlowInstance.current?.setViewport({ x: 0, y: 0, zoom: 0.8 }, { duration: 300 });
  }, []);

  const theme = useTheme();

  if (loading) {
    return (
      <Paper sx={{ p: 3 }}>
        <InformativeLoading 
          message="Carregando lista de tabelas"
          type="table"
          estimatedTime={8}
        />
      </Paper>
    );
  }

  if (error) {
    return (
      <Box>
        <Box sx={{ mb: 3 }}>
          <Button
            onClick={() => navigate('/connections')}
            variant="outlined"
            startIcon={<ArrowLeftIcon />}
            sx={{ mb: 2 }}
          >
            Voltar
          </Button>
        </Box>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>
            <Button onClick={() => navigate('/connections')} variant="outlined">
              Voltar para Conexões
            </Button>
          </Box>
        </Paper>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Top Bar com título e botões de ação */}
      <Box 
        sx={{ 
          flexShrink: 0, 
          px: 0.75,
          py: 0.125,
          backgroundColor: 'background.paper',
          borderBottom: 1, 
          borderColor: 'divider',
          boxShadow: 1,
          zIndex: 50,
          position: 'sticky',
          top: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 'auto',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8125rem', lineHeight: 1.2, py: 0.5 }}>
            Seletor de Tabelas: {connectionName}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'nowrap', overflowX: 'auto', pr: 2 }}>
          {/* Botão de Snap to Grid (Toggle) */}
          {nodes.length > 0 && (
            <Tooltip title={snapToGrid ? 'Desativar ajuste à grade' : 'Ativar ajuste à grade (arraste os nós para alinhar)'}>
              <Button
                onClick={() => setSnapToGrid(!snapToGrid)}
                variant={snapToGrid ? 'contained' : 'outlined'}
                size="small"
                startIcon={<Grid3x3Icon sx={{ fontSize: '0.75rem' }} />}
                sx={{ flexShrink: 0, fontSize: '0.75rem', px: 1.5, py: 0.5, minHeight: 32 }}
              >
                {snapToGrid ? 'Alinhar: ON' : 'Alinhar: OFF'}
              </Button>
            </Tooltip>
          )}
          {/* Controles de Layout */}
          {nodes.length > 0 && (
            <Paper
              elevation={2}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                p: 0.5,
                border: 1,
                borderColor: 'divider',
                flexShrink: 0,
              }}
            >
              <ToggleButtonGroup
                value={layoutType}
                exclusive
                onChange={(_, value) => value && handleApplyLayout(value)}
                size="small"
              >
                <Tooltip title="Layout Hierárquico">
                  <ToggleButton value="hierarchical" size="small" sx={{ p: 0.5 }}>
                    <GitBranchIcon sx={{ fontSize: '0.75rem' }} />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title="Layout Circular">
                  <ToggleButton value="circular" size="small" sx={{ p: 0.5 }}>
                    <NetworkIcon sx={{ fontSize: '0.75rem' }} />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title="Layout em Grade">
                  <ToggleButton value="grid" size="small" sx={{ p: 0.5 }}>
                    <Grid3x3Icon sx={{ fontSize: '0.75rem' }} />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title="Layout de Força">
                  <ToggleButton value="force" size="small" sx={{ p: 0.5 }}>
                    <LayoutGridIcon sx={{ fontSize: '0.75rem' }} />
                  </ToggleButton>
                </Tooltip>
                <Tooltip title="Layout Ortogonal (90 graus)">
                  <ToggleButton value="orthogonal" size="small" sx={{ p: 0.5 }}>
                    <BoxesIcon sx={{ fontSize: '0.75rem' }} />
                  </ToggleButton>
                </Tooltip>
              </ToggleButtonGroup>
            </Paper>
          )}
          {/* Modo Simplificado */}
          {nodes.length > 0 && (
            <Tooltip title={simplifiedView ? 'Modo Detalhado' : 'Modo Simplificado'}>
              <Button
                onClick={() => setSimplifiedView(!simplifiedView)}
                variant={simplifiedView ? 'contained' : 'outlined'}
                size="small"
                startIcon={simplifiedView ? <EyeIcon sx={{ fontSize: '0.75rem' }} /> : <EyeOffIcon sx={{ fontSize: '0.75rem' }} />}
                sx={{ flexShrink: 0, fontSize: '0.75rem', px: 1.5, py: 0.5, minHeight: 32 }}
              >
                {simplifiedView ? 'Detalhado' : 'Simplificado'}
              </Button>
            </Tooltip>
          )}
          {/* Zoom Semântico */}
          {nodes.length > 0 && (
            <Tooltip title={semanticZoomEnabled ? 'Desativar Zoom Semântico' : 'Ativar Zoom Semântico'}>
              <Button
                onClick={() => setSemanticZoomEnabled(!semanticZoomEnabled)}
                variant={semanticZoomEnabled ? 'contained' : 'outlined'}
                size="small"
                startIcon={<ZoomInIcon sx={{ fontSize: '0.75rem' }} />}
                sx={{ flexShrink: 0, fontSize: '0.75rem', px: 1.5, py: 0.5, minHeight: 32 }}
              >
                {semanticZoomEnabled ? 'Zoom Semântico' : 'Zoom Fixo'}
              </Button>
            </Tooltip>
          )}
          {/* Controles de Zoom */}
          {nodes.length > 0 && (
            <Paper
              elevation={2}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                p: 0.5,
                border: 1,
                borderColor: 'divider',
                flexShrink: 0,
              }}
            >
              <Tooltip title="Zoom In">
                <IconButton onClick={handleZoomIn} size="small" sx={{ p: 0.5 }}>
                  <ZoomInIcon sx={{ fontSize: '0.75rem' }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Zoom Out">
                <IconButton onClick={handleZoomOut} size="small" sx={{ p: 0.5 }}>
                  <ZoomOutIcon sx={{ fontSize: '0.75rem' }} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.25, height: 16 }} />
              <Tooltip title="Ajustar à Tela">
                <IconButton onClick={handleFitView} size="small" sx={{ p: 0.5 }}>
                  <Maximize2Icon sx={{ fontSize: '0.75rem' }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Resetar Visualização">
                <IconButton onClick={handleResetView} size="small" sx={{ p: 0.5 }}>
                  <RotateCcwIcon sx={{ fontSize: '0.75rem' }} />
                </IconButton>
              </Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 0.25, height: 16 }} />
              <Typography variant="caption" sx={{ px: 1, minWidth: 35, textAlign: 'center', fontWeight: 500, fontSize: '0.75rem' }}>
                {Math.round(zoomLevel * 100)}%
              </Typography>
            </Paper>
          )}
        </Box>
      </Box>

      {/* Container Principal: Seletor + Canvas */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Seletor de Tabelas em Cascata */}
        {showTableSelector && (
          <CascadingTableSelector
            nodes={allNodes}
            edges={allEdges}
            onSelectTables={handleCascadingTableSelect}
            mainTableId={selectedTableId}
            selectedRelatedTables={selectedRelatedTables}
            isOpen={showTableSelector}
            onToggle={() => setShowTableSelector(!showTableSelector)}
            onCollapsedChange={setIsSelectorCollapsed}
          />
        )}

        {/* Canvas para visualização */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {nodes.length > 0 ? (
            <Box
              sx={{
                flex: 1,
                bgcolor: 'background.default',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={onInit}
            onMove={onMove}
            onEdgeClick={onEdgeClick}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView={false}
            fitViewOptions={{
              padding: 0.2,
              includeHiddenNodes: false,
              maxZoom: 3,
              minZoom: 0.1,
              duration: 300,
            }}
            defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
            style={{
              width: '100%',
              height: '100%',
            }}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            panOnScroll={true}
            zoomOnScroll={true}
            zoomOnPinch={true}
            preventScrolling={false}
            panOnDrag={[1, 2]}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls
              showInteractive={false}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
              }}
            />
            <MiniMap
              style={{
                height: 150,
                width: 200,
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid rgba(0, 0, 0, 0.1)',
              }}
              nodeColor={(node) => {
                return node.type === 'view' ? '#f59e0b' : '#3b82f6';
              }}
            />
          </ReactFlow>
            </Box>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Box sx={{ textAlign: 'center', py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <ListIcon sx={{ fontSize: 64, mb: 2, color: 'text.secondary' }} />
                <Typography variant="h4" fontWeight={700} sx={{ mb: 1 }}>
                  Seletor de Tabelas
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                  Selecione uma tabela principal no painel lateral para visualizar suas tabelas relacionadas
                </Typography>
              </Box>
            </Box>
          )}
        </Box>
      </Box>

      {/* Dialog de Detalhes do Relacionamento */}
      <RelationshipDetailsDialog
        isOpen={showRelationshipDialog}
        onClose={() => {
          setShowRelationshipDialog(false);
          setSelectedEdge(null);
        }}
        relationship={selectedEdge ? {
          id: selectedEdge.id,
          fromTable: selectedEdge.data?.fromTable || selectedEdge.source || '',
          fromColumn: selectedEdge.data?.fromColumn || '',
          toTable: selectedEdge.data?.toTable || selectedEdge.target || '',
          toColumn: selectedEdge.data?.toColumn || '',
          label: selectedEdge.data?.relationshipLabel || selectedEdge.data?.label,
          type: selectedEdge.data?.relationshipType,
        } : null}
      />
    </Box>
  );
}

export default function TableSelectorView() {
  return (
    <ReactFlowProvider>
      <TableSelectorViewContent />
    </ReactFlowProvider>
  );
}

