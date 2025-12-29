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
  MarkerType,
  ReactFlowInstance,
  Viewport,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Download, ArrowLeft, Eye, FileText, X, ZoomIn, ZoomOut, Maximize2, RotateCcw, LayoutGrid, Network, Grid3x3, GitBranch, EyeOff, Sparkles, Boxes, List } from 'lucide-react';
import { schemaApi, connectionsApi, type GraphNode, type GraphEdge } from '../api/client';
import DatabaseSchemaNode, { type Column } from '../components/schema/DatabaseSchemaNode';
import CustomEdge from '../components/schema/CustomEdge';
import { useSQLAnalysis } from '../hooks/useSQLAnalysis';
import { getLayoutedElements, type LayoutType } from '../utils/layout';
import SQLAnalysisDialog from '../components/SQLAnalysisDialog';
import RelationshipDetailsDialog from '../components/RelationshipDetailsDialog';
import CascadingTableSelector from '../components/CascadingTableSelector';
import InformativeLoading from '../components/InformativeLoading';
import ViewSwitcher from '../components/ViewSwitcher';

const nodeTypes = {
  databaseSchema: DatabaseSchemaNode,
};

const edgeTypes = {
  custom: CustomEdge,
};

function SchemaViewerAdvancedContent() {
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showSQLInput, setShowSQLInput] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(0.8);
  const [filterMode, setFilterMode] = useState(false); // Modo filtro: mostrar apenas tabelas da query
  const [allNodes, setAllNodes] = useState<Node[]>([]); // Backup de todos os nós
  const [allEdges, setAllEdges] = useState<Edge[]>([]); // Backup de todas as arestas
  const [layoutType, setLayoutType] = useState<LayoutType>('hierarchical');
  const [simplifiedView, setSimplifiedView] = useState(false); // Modo simplificado: apenas nomes
  const [showEdgeLabels, setShowEdgeLabels] = useState(false); // Mostrar/ocultar labels das arestas
  const [semanticZoomEnabled, setSemanticZoomEnabled] = useState(true); // Zoom semântico ativo/desativo
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null); // Tamanho dinâmico do canvas
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null); // Aresta selecionada para mostrar detalhes
  const [showRelationshipDialog, setShowRelationshipDialog] = useState(false); // Controlar exibição do dialog
  const [snapToGrid, setSnapToGrid] = useState(false); // Snap to grid ativo/desativo
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const { getZoom, setViewport, zoomIn, zoomOut, fitView } = useReactFlow();
  const { highlightQuery, clearHighlight, highlightedTables, highlightedEdges, analysisResult } = useSQLAnalysis();

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
        data: { ...node.data, simplified: simplifiedView },
        width: simplifiedView ? 180 : 280,
        height: simplifiedView ? 60 : undefined,
      }))
    );
  }, [simplifiedView, setNodes]);

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

      const padding = 100;

      // Não usar posições calculadas manualmente, o layout será aplicado depois
      // Garantir unicidade dos nós desde o início
      const nodeIdSet = new Set<string>();
      const flowNodes: Node[] = graphData.nodes
        .filter((node) => {
          // Remover duplicatas por ID
          if (nodeIdSet.has(node.id)) {
            return false;
          }
          nodeIdSet.add(node.id);
          return true;
        })
        .map((node) => {
          const columns: Column[] = node.columns || [];
          const primaryKeys = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
          
          return {
            id: node.id,
            type: 'databaseSchema',
            position: { x: 0, y: 0 }, // Será calculado pelo layout
            data: {
              label: node.label,
              schema: node.schema,
              columns: columns,
              primaryKeys: primaryKeys,
              type: node.type,
              zoomLevel: 1,
              simplified: simplifiedView,
              semanticZoomEnabled,
            },
            selected: false,
            width: simplifiedView ? 180 : 280,
            height: simplifiedView ? 60 : undefined,
          };
        });

      const nodeIds = new Set(flowNodes.map((n) => n.id));
      const flowEdges: Edge[] = graphData.edges
        .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
        .map((edge) => {
          // Verificar se os nós source e target existem e têm as colunas necessárias
          const sourceNode = flowNodes.find(n => n.id === edge.from);
          const targetNode = flowNodes.find(n => n.id === edge.to);
          
          // Verificar se as colunas existem nos nós
          const sourceHasColumn = sourceNode?.data?.columns?.some((col: any) => col.name === edge.fromColumn);
          const targetHasColumn = targetNode?.data?.columns?.some((col: any) => col.name === edge.toColumn);
          
          // Usar handles específicos se as colunas existirem, senão usar handles genéricos
          const sourceHandle = sourceHasColumn ? `${edge.fromColumn}-source` : 'default-source';
          const targetHandle = targetHasColumn ? `${edge.toColumn}-target` : 'default-target';
          
          return {
            id: edge.id,
            source: edge.from,
            target: edge.to,
            type: 'custom',
            sourceHandle: sourceHandle,
            targetHandle: targetHandle,
            data: {
              label: showEdgeLabels ? (edge.label || `${edge.fromColumn} → ${edge.toColumn}`) : undefined,
              cardinality: 'many-to-one',
              highlighted: highlightedEdges.has(edge.id),
              // Armazenar dados completos do relacionamento para o dialog
              fromTable: edge.from,
              fromColumn: edge.fromColumn,
              toTable: edge.to,
              toColumn: edge.toColumn,
              relationshipLabel: edge.label,
              relationshipType: edge.id.startsWith('fk_') ? 'foreign_key' : edge.id.startsWith('view_') ? 'view_relationship' : 'relationship',
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 20,
              height: 20,
            },
          };
        });

      // Aplicar layout automático
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        flowNodes,
        flowEdges,
        layoutType
      );

      // Garantir unicidade dos nós (evitar duplicação)
      const uniqueNodesMap = new Map<string, Node>();
      layoutedNodes.forEach(node => {
        if (!uniqueNodesMap.has(node.id)) {
          uniqueNodesMap.set(node.id, node);
        }
      });
      const uniqueLayoutedNodes = Array.from(uniqueNodesMap.values());

      // Garantir unicidade das arestas
      const uniqueEdgesMap = new Map<string, Edge>();
      layoutedEdges.forEach(edge => {
        if (!uniqueEdgesMap.has(edge.id)) {
          uniqueEdgesMap.set(edge.id, edge);
        }
      });
      const uniqueLayoutedEdges = Array.from(uniqueEdgesMap.values());

      // Salvar backup de todos os nós e arestas (únicos)
      setAllNodes(uniqueLayoutedNodes);
      setAllEdges(uniqueLayoutedEdges);
      setNodes(uniqueLayoutedNodes);
      setEdges(uniqueLayoutedEdges);
      setError(null);
    } catch (error: any) {
      console.error('Erro ao carregar grafo:', error);
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.details ||
        error.message ||
        'Erro ao carregar schema';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSQLAnalysis = (query?: string) => {
    // Usar query passada como parâmetro ou sqlQuery do estado
    const queryToAnalyze = query || sqlQuery;
    
    if (!queryToAnalyze.trim()) {
      alert('Por favor, cole uma query SQL para analisar.');
      return;
    }
    
    // Usar allNodes/allEdges se disponíveis, senão usar nodes/edges atuais
    const nodesToAnalyze = allNodes.length > 0 ? allNodes : nodes;
    const edgesToAnalyze = allEdges.length > 0 ? allEdges : edges;
    const allTableIds = nodesToAnalyze.map((n) => n.id);
    
    // Ativar modo filtro antes de analisar
    setFilterMode(true);
    
    highlightQuery(queryToAnalyze, allTableIds, edgesToAnalyze);
  };
  

  const handleDownloadDDL = async () => {
    try {
      const response = await schemaApi.getDDL(connId!);
      const blob = new Blob([response.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${connectionName}_schema.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erro ao gerar DDL');
    }
  };

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

  // Função para aplicar layout
  const handleApplyLayout = useCallback(async (type: LayoutType) => {
    setLayoutType(type);
    
    // Função auxiliar para recriar arestas com handles corretos
    // IMPORTANTE: Recria handles baseando-se nos dados originais (fromColumn, toColumn)
    // da mesma forma que é feito no SQLAnalyzer
    const recreateEdges = (nodes: Node[], edges: Edge[]): Edge[] => {
      const nodeIds = new Set(nodes.map(n => n.id));
      return edges
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .map((edge) => {
          // Verificar se os nós source e target existem e têm as colunas necessárias
          const sourceNode = nodes.find(n => n.id === edge.source);
          const targetNode = nodes.find(n => n.id === edge.target);
          
          // Obter colunas originais dos dados da aresta (prioridade) ou tentar do handle atual
          const fromColumn = edge.data?.fromColumn || 
                           (edge.sourceHandle && edge.sourceHandle !== 'default-source' 
                             ? edge.sourceHandle.replace('-source', '') 
                             : '');
          const toColumn = edge.data?.toColumn || 
                         (edge.targetHandle && edge.targetHandle !== 'default-target' 
                           ? edge.targetHandle.replace('-target', '') 
                           : '');
          
          // Recriar handles baseando-se nas colunas originais
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
              // Preservar dados completos do relacionamento
              fromTable: edge.data?.fromTable || edge.source,
              fromColumn: fromColumn || edge.data?.fromColumn || '',
              toTable: edge.data?.toTable || edge.target,
              toColumn: toColumn || edge.data?.toColumn || '',
              relationshipLabel: edge.data?.relationshipLabel || edge.data?.label,
              relationshipType: edge.data?.relationshipType || (edge.id.startsWith('fk_') ? 'foreign_key' : edge.id.startsWith('view_') ? 'view_relationship' : 'relationship'),
            },
          };
        });
    };
    
    // Se estiver em modo filtro, aplicar layout apenas nas tabelas filtradas
    if (filterMode && highlightedTables.size > 0) {
      const nodesToFilter = allNodes.length > 0 ? allNodes : nodes;
      const edgesToFilter = allEdges.length > 0 ? allEdges : edges;
      
      // Filtrar apenas nós que estão em highlightedTables
      const filteredNodes = nodesToFilter.filter(n => highlightedTables.has(n.id));
      
      // Filtrar apenas arestas onde AMBAS as tabelas estão em highlightedTables
      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
      const filteredEdges = edgesToFilter.filter(e => 
        filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
      );
      
      // Aplicar layout nas tabelas filtradas
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        filteredNodes,
        filteredEdges,
        type
      );
      
      // Recriar arestas com handles corretos após o layout
      const recreatedEdges = recreateEdges(layoutedNodes, layoutedEdges);
      
      // Atualizar nós primeiro
      setNodes(layoutedNodes);
      
      // Aguardar um frame para garantir que os nós foram atualizados antes de atualizar as arestas
      requestAnimationFrame(() => {
        setEdges(recreatedEdges);
        
        // Ajustar visualização após atualizar arestas
        if (reactFlowInstance.current && layoutedNodes.length > 0) {
          setTimeout(() => {
            reactFlowInstance.current?.fitView({
              nodes: layoutedNodes,
              padding: 0.5,
              duration: 500,
              maxZoom: 1.5,
              minZoom: 0.3,
            });
          }, 150);
        }
      });
    } else {
      // Modo normal: aplicar layout em todas as tabelas
      const nodesToLayout = allNodes.length > 0 ? allNodes : nodes;
      const edgesToLayout = allEdges.length > 0 ? allEdges : edges;
      
      // Aplicar layout
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodesToLayout,
        edgesToLayout,
        type
      );
      
      // Recriar arestas com handles corretos após o layout
      const recreatedEdges = recreateEdges(layoutedNodes, layoutedEdges);
      
      // Atualizar nós primeiro
      setNodes(layoutedNodes);
      
      // Aguardar um frame para garantir que os nós foram atualizados antes de atualizar as arestas
      requestAnimationFrame(() => {
        setEdges(recreatedEdges);
        
        // Atualizar backup
        setAllNodes(layoutedNodes);
        setAllEdges(recreatedEdges);
        
        // Ajustar visualização após atualizar arestas
        if (reactFlowInstance.current && layoutedNodes.length > 0) {
          setTimeout(() => {
            reactFlowInstance.current?.fitView({
              padding: 0.2,
              duration: 300,
            });
          }, 150);
        }
      });
    }
  }, [nodes, edges, allNodes, allEdges, filterMode, highlightedTables, setNodes, setEdges]);

  // Efeito para filtrar nós e arestas quando highlightedTables mudar no modo filtro
  useEffect(() => {
    if (filterMode && highlightedTables.size > 0) {
      const nodesToFilter = allNodes.length > 0 ? allNodes : nodes;
      const edgesToFilter = allEdges.length > 0 ? allEdges : edges;
      
      // Filtrar apenas nós que estão em highlightedTables e garantir unicidade por ID
      const nodeIdSet = new Set<string>();
      const filteredNodes = nodesToFilter
        .filter(n => {
          if (highlightedTables.has(n.id) && !nodeIdSet.has(n.id)) {
            nodeIdSet.add(n.id);
            return true;
          }
          return false;
        });
      
      // Filtrar apenas arestas onde AMBAS as tabelas estão em highlightedTables
      const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
      const filteredEdges = edgesToFilter.filter(e => 
        filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
      );
      
      // Usar o layout atual (não forçar hierárquico) para permitir flexibilidade
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        filteredNodes,
        filteredEdges,
        layoutType // Usar layout atual selecionado
      );
      
      // Garantir que não há nós duplicados após o layout
      const uniqueNodesMap = new Map<string, Node>();
      layoutedNodes.forEach(node => {
        if (!uniqueNodesMap.has(node.id)) {
          uniqueNodesMap.set(node.id, node);
        }
      });
      const uniqueLayoutedNodes = Array.from(uniqueNodesMap.values());
      
      // Recriar arestas com handles corretos baseando-se nos dados originais
      const nodeIds = new Set(uniqueLayoutedNodes.map(n => n.id));
      const recreatedEdges = layoutedEdges
        .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
        .map((edge) => {
          const sourceNode = uniqueLayoutedNodes.find(n => n.id === edge.source);
          const targetNode = uniqueLayoutedNodes.find(n => n.id === edge.target);
          
          // Obter colunas originais dos dados da aresta (prioridade) ou tentar do handle atual
          const fromColumn = edge.data?.fromColumn || 
                           (edge.sourceHandle && edge.sourceHandle !== 'default-source' 
                             ? edge.sourceHandle.replace('-source', '') 
                             : '');
          const toColumn = edge.data?.toColumn || 
                         (edge.targetHandle && edge.targetHandle !== 'default-target' 
                           ? edge.targetHandle.replace('-target', '') 
                           : '');
          
          // Recriar handles baseando-se nas colunas originais
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
              // Preservar dados completos do relacionamento
              fromTable: edge.data?.fromTable || edge.source,
              fromColumn: fromColumn || edge.data?.fromColumn || '',
              toTable: edge.data?.toTable || edge.target,
              toColumn: toColumn || edge.data?.toColumn || '',
              relationshipLabel: edge.data?.relationshipLabel || edge.data?.label,
              relationshipType: edge.data?.relationshipType || (edge.id.startsWith('fk_') ? 'foreign_key' : edge.id.startsWith('view_') ? 'view_relationship' : 'relationship'),
            },
          };
        });
      
      // Atualizar nós primeiro (garantindo unicidade)
      setNodes(uniqueLayoutedNodes);
      
      // Aguardar um frame para garantir que os nós foram atualizados antes de atualizar as arestas
      requestAnimationFrame(() => {
        setEdges(recreatedEdges);
        
        // Focar nas tabelas destacadas após análise com padding maior
        if (uniqueLayoutedNodes.length > 0 && reactFlowInstance.current) {
          setTimeout(() => {
            reactFlowInstance.current?.fitView({
              nodes: uniqueLayoutedNodes,
              padding: 0.5, // Padding maior para melhor visualização
              duration: 500,
              maxZoom: 1.5, // Limitar zoom máximo para não ficar muito próximo
              minZoom: 0.3, // Permitir zoom mínimo para ver tudo
            });
          }, 300);
        }
      });
    }
  }, [highlightedTables, filterMode, allNodes, allEdges, layoutType, setNodes, setEdges]);

  // Calcular tamanho do canvas baseado nos nós quando em modo filtro
  useEffect(() => {
    if (filterMode && nodes.length > 0) {
      // Calcular bounding box dos nós
      const padding = 150; // Padding extra ao redor do conteúdo
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      nodes.forEach((node) => {
        const nodeWidth = node.width || 280;
        const nodeHeight = node.height || 200;
        const x = node.position.x;
        const y = node.position.y;
        
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x + nodeWidth);
        maxY = Math.max(maxY, y + nodeHeight);
      });
      
      // Calcular tamanho necessário com padding
      const calculatedWidth = Math.max(800, maxX - minX + padding * 2);
      const calculatedHeight = Math.max(600, maxY - minY + padding * 2);
      
      setCanvasSize({
        width: calculatedWidth,
        height: calculatedHeight,
      });
    } else {
      // Modo normal: usar tamanho padrão (null = 100%)
      setCanvasSize(null);
    }
  }, [filterMode, nodes]);

  // Atualizar destaque visual dos nós e arestas (apenas quando não estiver em modo filtro ou quando não houver mudança estrutural)
  useEffect(() => {
    // Não atualizar destaque visual se estiver em modo filtro (o filtro já cuida disso)
    if (filterMode) {
      return;
    }
    
    // Modo normal: mostrar todas as tabelas com destaque
    if (highlightedTables.size === 0 && highlightedEdges.size === 0) {
      // Limpar destaque
      setNodes((nds) => {
        // Garantir unicidade antes de atualizar
        const uniqueNodes = new Map<string, Node>();
        nds.forEach(node => {
          if (!uniqueNodes.has(node.id)) {
            uniqueNodes.set(node.id, {
              ...node,
              selected: false,
              style: {
                ...node.style,
                opacity: 1,
                transition: 'opacity 0.5s ease-in-out, transform 0.3s ease-in-out',
                transform: 'scale(1)',
              },
            });
          }
        });
        return Array.from(uniqueNodes.values());
      });
      
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          data: {
            ...edge.data,
            highlighted: false,
          },
        }))
      );
    } else {
      // Aplicar destaque
      setNodes((nds) => {
        // Garantir unicidade antes de atualizar
        const uniqueNodes = new Map<string, Node>();
        nds.forEach(node => {
          if (!uniqueNodes.has(node.id)) {
            const isHighlighted = highlightedTables.has(node.id);
            uniqueNodes.set(node.id, {
              ...node,
              selected: isHighlighted,
              style: {
                ...node.style,
                opacity: highlightedTables.size > 0 && !isHighlighted ? 0.2 : 1,
                transition: 'opacity 0.5s ease-in-out, transform 0.3s ease-in-out',
                transform: isHighlighted ? 'scale(1.02)' : 'scale(1)',
              },
            });
          }
        });
        return Array.from(uniqueNodes.values());
      });
      
      setEdges((eds) =>
        eds.map((edge) => ({
          ...edge,
          data: {
            ...edge.data,
            highlighted: highlightedEdges.has(edge.id),
          },
        }))
      );
    }
  }, [highlightedTables, highlightedEdges, filterMode, setNodes, setEdges]);

  // Função para voltar à visualização completa
  const handleShowAll = () => {
    setFilterMode(false);
    setNodes(allNodes);
    setEdges(allEdges);
    setCanvasSize(null); // Resetar tamanho do canvas para modo normal
    clearHighlight();
    
    // Ajustar visualização para mostrar tudo
    if (reactFlowInstance.current && allNodes.length > 0) {
      setTimeout(() => {
        reactFlowInstance.current?.fitView({
          padding: 0.2,
          duration: 500,
        });
      }, 100);
    }
  };

  if (loading) {
    return (
      <div className="card">
        <InformativeLoading 
          message="Carregando schema do banco de dados"
          type="schema"
          estimatedTime={15}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => navigate('/connections')}
            className="btn btn-secondary mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2 inline" />
            Voltar
          </button>
        </div>
        <div className="card">
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button onClick={() => navigate('/connections')} className="btn btn-secondary">
              Voltar para Conexões
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      <div 
        className="flex justify-between items-center bg-white dark:bg-gray-900 z-50 shadow-md border-b border-gray-200 dark:border-gray-700" 
        style={{ 
          width: '100%', 
          position: 'sticky',
          top: 0,
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
          paddingLeft: '1rem',
          paddingRight: '1rem',
        }}
      >
        <div className="pl-4 pr-4 flex items-center gap-3 flex-wrap">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Schema Avançado: {connectionName}
          </h1>
          <ViewSwitcher currentView="advanced" />
          {/* Botão de Snap to Grid (Toggle) */}
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            className={`btn ${snapToGrid ? 'btn-primary' : 'btn-secondary'} flex items-center h-10`}
            title={snapToGrid ? 'Desativar ajuste à grade' : 'Ativar ajuste à grade (arraste os nós para alinhar)'}
          >
            <Grid3x3 className="h-4 w-4 mr-2" />
            {snapToGrid ? 'Alinhar: ON' : 'Alinhar: OFF'}
          </button>
          {/* Controles de Layout */}
          <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-1 border border-gray-200 dark:border-gray-700">
            <button
              onClick={() => handleApplyLayout('hierarchical')}
              className={`p-2 rounded transition-colors ${
                layoutType === 'hierarchical'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              title="Layout Hierárquico"
            >
              <GitBranch className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleApplyLayout('circular')}
              className={`p-2 rounded transition-colors ${
                layoutType === 'circular'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              title="Layout Circular"
            >
              <Network className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleApplyLayout('grid')}
              className={`p-2 rounded transition-colors ${
                layoutType === 'grid'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              title="Layout em Grade"
            >
              <Grid3x3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleApplyLayout('force')}
              className={`p-2 rounded transition-colors ${
                layoutType === 'force'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              title="Layout de Força"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleApplyLayout('orthogonal')}
              className={`p-2 rounded transition-colors ${
                layoutType === 'orthogonal'
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
              title="Layout Ortogonal (90 graus) - Padrão ouro para ERDs"
            >
              <Boxes className="h-4 w-4" />
            </button>
          </div>
          {/* Modo Simplificado */}
          <button
            onClick={() => setSimplifiedView(!simplifiedView)}
            className={`btn ${simplifiedView ? 'btn-primary' : 'btn-secondary'} flex items-center h-10`}
            title={simplifiedView ? 'Modo Detalhado' : 'Modo Simplificado'}
          >
            {simplifiedView ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
            {simplifiedView ? 'Detalhado' : 'Simplificado'}
          </button>
          {/* Zoom Semântico */}
          <button
            onClick={() => setSemanticZoomEnabled(!semanticZoomEnabled)}
            className={`btn ${semanticZoomEnabled ? 'btn-primary' : 'btn-secondary'} flex items-center h-10`}
            title={semanticZoomEnabled ? 'Desativar Zoom Semântico' : 'Ativar Zoom Semântico'}
          >
            <ZoomIn className="h-4 w-4 mr-2" />
            {semanticZoomEnabled ? 'Zoom Semântico' : 'Zoom Fixo'}
          </button>
          {/* Controles de Zoom */}
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-md p-2 border border-gray-200 dark:border-gray-700">
            <button
              onClick={handleZoomIn}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={handleZoomOut}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="border-l border-gray-200 dark:border-gray-700 h-6 mx-1"></div>
            <button
              onClick={handleFitView}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Ajustar à Tela"
            >
              <Maximize2 className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            </button>
            <button
              onClick={handleResetView}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="Resetar Visualização"
            >
              <RotateCcw className="h-4 w-4 text-gray-700 dark:text-gray-300" />
            </button>
            <div className="border-l border-gray-200 dark:border-gray-700 h-6 mx-1"></div>
            <div className="px-2 py-1 text-xs text-gray-600 dark:text-gray-400 font-medium min-w-[45px] text-center">
              {Math.round(zoomLevel * 100)}%
            </div>
          </div>
          <button onClick={handleDownloadDDL} className="btn btn-primary flex items-center h-10">
            <Download className="h-4 w-4 mr-2" />
            Baixar DDL
          </button>
        </div>
      </div>

      {/* Dialog de Análise SQL */}
      <SQLAnalysisDialog
        isOpen={showSQLInput}
        onClose={() => {
          setShowSQLInput(false);
          if (!filterMode) {
            clearHighlight();
          }
        }}
        onAnalyze={handleSQLAnalysis}
        sqlQuery={sqlQuery}
        setSqlQuery={setSqlQuery}
        analysisResult={analysisResult}
        highlightedTablesCount={highlightedTables.size}
        filterMode={filterMode}
      />

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

      <div
        className="card p-0"
        style={{
          width: '98vw',
          maxWidth: '98%',
          margin: '0 auto',
          height: filterMode && canvasSize ? `${Math.min(canvasSize.height + 100, window.innerHeight - 80)}px` : 'calc(100vh - 80px)',
          minHeight: '600px',
          position: 'relative',
          overflow: filterMode ? 'auto' : 'hidden',
          display: 'flex',
          justifyContent: 'center',
          alignItems: filterMode ? 'flex-start' : 'stretch',
        }}
      >
        {/* Banner de Filtro Ativo */}
        {filterMode && highlightedTables.size > 0 && (
          <div
            className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-lg shadow-xl border border-blue-400 dark:border-blue-500"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="flex items-center gap-2">
              <div className="relative">
                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse"></div>
                <div className="absolute inset-0 w-2.5 h-2.5 bg-white rounded-full animate-ping opacity-75"></div>
              </div>
              <span className="text-sm font-bold">
                🔍 Modo Filtro Ativo
              </span>
            </div>
            <div className="h-5 w-px bg-white/40"></div>
            <div className="flex flex-col">
              <span className="text-xs font-medium opacity-95">
                Mostrando {highlightedTables.size} {highlightedTables.size === 1 ? 'tabela' : 'tabelas'} da consulta SQL
              </span>
              {analysisResult && analysisResult.tables.length > 0 && (
                <span className="text-xs opacity-80 mt-0.5">
                  {analysisResult.tables.length} {analysisResult.tables.length === 1 ? 'tabela' : 'tabelas'} encontrada{analysisResult.tables.length > 1 ? 's' : ''} na query
                </span>
              )}
            </div>
            <button
              onClick={handleShowAll}
              className="ml-2 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-md text-xs font-medium transition-colors backdrop-blur-sm"
              title="Mostrar todas as tabelas"
            >
              Mostrar Todas
            </button>
          </div>
        )}
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
            width: filterMode && canvasSize ? `${canvasSize.width}px` : '100%',
            height: filterMode && canvasSize ? `${canvasSize.height}px` : '100%',
            minWidth: filterMode && canvasSize ? `${canvasSize.width}px` : undefined,
            minHeight: filterMode && canvasSize ? `${canvasSize.height}px` : undefined,
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
      </div>
    </div>
  );
}

export default function SchemaViewerAdvanced() {
  return (
    <ReactFlowProvider>
      <SchemaViewerAdvancedContent />
    </ReactFlowProvider>
  );
}

