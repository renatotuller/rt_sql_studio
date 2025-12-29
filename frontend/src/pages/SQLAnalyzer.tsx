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
import { ArrowLeft, FileText, ZoomIn, ZoomOut, Maximize2, RotateCcw, LayoutGrid, Network, Grid3x3, GitBranch, EyeOff, Eye, X, Sparkles, List, Boxes } from 'lucide-react';
import { schemaApi, connectionsApi } from '../api/client';
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

function SQLAnalyzerContent() {
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false); // Loading apenas durante análise
  const [error, setError] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showSQLInput, setShowSQLInput] = useState(true); // Abrir dialog automaticamente
  const [sqlQuery, setSqlQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(0.8);
  const [layoutType, setLayoutType] = useState<LayoutType>('hierarchical');
  const [simplifiedView, setSimplifiedView] = useState(false);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);
  const [semanticZoomEnabled, setSemanticZoomEnabled] = useState(true); // Zoom semântico ativo/desativo
  const [allNodes, setAllNodes] = useState<Node[]>([]); // Todos os nós do schema (para análise)
  const [allEdges, setAllEdges] = useState<Edge[]>([]); // Todas as arestas do schema (para análise)
  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null); // Aresta selecionada para mostrar detalhes
  const [showRelationshipDialog, setShowRelationshipDialog] = useState(false); // Controlar exibição do dialog
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null); // Tabela principal selecionada
  const [selectedRelatedTables, setSelectedRelatedTables] = useState<Set<string>>(new Set()); // Tabelas relacionadas selecionadas
  const [showTableSelector, setShowTableSelector] = useState(false); // Controlar exibição do seletor de tabelas
  const [snapToGrid, setSnapToGrid] = useState(false); // Snap to grid ativo/desativo
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const { getZoom, setViewport, zoomIn, zoomOut, fitView } = useReactFlow();
  const { highlightQuery, clearHighlight, highlightedTables, highlightedEdges, analysisResult } = useSQLAnalysis();

  useEffect(() => {
    if (connId) {
      loadConnection();
      // NÃO carregar schema automaticamente - aguardar análise SQL
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

  // Carregar apenas metadados do schema para análise (sem criar visualização completa)
  const loadSchemaForAnalysis = async () => {
    try {
      setLoading(true);
      const response = await schemaApi.getGraph(connId!);
      const graphData = response.data;

      // Criar nós e arestas apenas para análise (não renderizar ainda)
      const flowNodes: Node[] = graphData.nodes.map((node) => {
        const columns: Column[] = node.columns || [];
        const primaryKeys = columns.filter((c) => c.isPrimaryKey).map((c) => c.name);
        
        return {
          id: node.id,
          type: 'databaseSchema',
          position: { x: 0, y: 0 },
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
          const sourceNode = flowNodes.find(n => n.id === edge.from);
          const targetNode = flowNodes.find(n => n.id === edge.to);
          
          const sourceHasColumn = sourceNode?.data?.columns?.some((col: any) => col.name === edge.fromColumn);
          const targetHasColumn = targetNode?.data?.columns?.some((col: any) => col.name === edge.toColumn);
          
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
              highlighted: false,
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

      // Garantir unicidade
      const uniqueNodesMap = new Map<string, Node>();
      flowNodes.forEach(node => {
        if (!uniqueNodesMap.has(node.id)) {
          uniqueNodesMap.set(node.id, node);
        }
      });
      const uniqueNodes = Array.from(uniqueNodesMap.values());

      const uniqueEdgesMap = new Map<string, Edge>();
      flowEdges.forEach(edge => {
        if (!uniqueEdgesMap.has(edge.id)) {
          uniqueEdgesMap.set(edge.id, edge);
        }
      });
      const uniqueEdges = Array.from(uniqueEdgesMap.values());

      // Salvar para análise, mas não renderizar ainda
      setAllNodes(uniqueNodes);
      setAllEdges(uniqueEdges);
      setError(null);
    } catch (error: any) {
      console.error('Erro ao carregar schema:', error);
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

  const handleSQLAnalysis = async (query?: string) => {
    const queryToAnalyze = query || sqlQuery;
    
    if (!queryToAnalyze.trim()) {
      alert('Por favor, cole uma query SQL para analisar.');
      return;
    }
    
    // Fechar o dialog primeiro para evitar problemas de estado
    setShowSQLInput(false);
    
    // Se o schema ainda não foi carregado, carregar agora
    if (allNodes.length === 0) {
      setLoading(true);
      try {
        await loadSchemaForAnalysis();
      } catch (error) {
        console.error('Erro ao carregar schema:', error);
        alert('Erro ao carregar schema do banco de dados. Tente novamente.');
        setLoading(false);
        setShowSQLInput(true); // Reabrir dialog em caso de erro
        return;
      } finally {
        setLoading(false);
      }
    }
    
    // Aguardar um pouco para garantir que o estado foi atualizado
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Agora que temos o schema, analisar a query
    const allTableIds = allNodes.map((n) => n.id);
    
    // Analisar query e destacar tabelas (o useEffect vai renderizar automaticamente)
    highlightQuery(queryToAnalyze, allTableIds, allEdges);
    
    // Garantir que o estado da query seja atualizado
    setSqlQuery(queryToAnalyze);
  };

  const renderFilteredGraph = useCallback(() => {
    if (highlightedTables.size === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Filtrar nós destacados
    const nodeIdSet = new Set<string>();
    const filteredNodes = allNodes
      .filter(n => {
        if (highlightedTables.has(n.id) && !nodeIdSet.has(n.id)) {
          nodeIdSet.add(n.id);
          return true;
        }
        return false;
      });

    // Filtrar arestas onde ambas as tabelas estão destacadas
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredEdges = allEdges.filter(e => 
      filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)
    );

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
              highlighted: highlightedEdges.has(edge.id),
              // Preservar dados completos do relacionamento
              fromTable: edge.data?.fromTable || edge.source,
              fromColumn: edge.data?.fromColumn || '',
              toTable: edge.data?.toTable || edge.target,
              toColumn: edge.data?.toColumn || '',
              relationshipLabel: edge.data?.relationshipLabel || edge.data?.label,
              relationshipType: edge.data?.relationshipType || (edge.id.startsWith('fk_') ? 'foreign_key' : edge.id.startsWith('view_') ? 'view_relationship' : 'relationship'),
            },
          };
      });

    setNodes(uniqueLayoutedNodes);
    
    requestAnimationFrame(() => {
      setEdges(recreatedEdges);
      
      if (uniqueLayoutedNodes.length > 0 && reactFlowInstance.current) {
        setTimeout(() => {
          reactFlowInstance.current?.fitView({
            nodes: uniqueLayoutedNodes,
            padding: 0.5,
            duration: 500,
            maxZoom: 1.5,
            minZoom: 0.3,
          });
        }, 300);
      }
    });
  }, [allNodes, allEdges, highlightedTables, highlightedEdges, layoutType, setNodes, setEdges]);

  // Função para encontrar todas as tabelas relacionadas a uma tabela selecionada
  const findRelatedTables = useCallback((tableId: string, nodes: Node[], edges: Edge[]): Set<string> => {
    const relatedTables = new Set<string>([tableId]);
    const visited = new Set<string>();
    const queue = [tableId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // Encontrar todas as arestas conectadas a esta tabela
      edges.forEach((edge) => {
        if (edge.source === currentId && !relatedTables.has(edge.target)) {
          relatedTables.add(edge.target);
          queue.push(edge.target);
        }
        if (edge.target === currentId && !relatedTables.has(edge.source)) {
          relatedTables.add(edge.source);
          queue.push(edge.source);
        }
      });
    }

    return relatedTables;
  }, []);

  // Renderizar gráfico quando highlightedTables mudar
  useEffect(() => {
    if (highlightedTables.size > 0 && allNodes.length > 0) {
      renderFilteredGraph();
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [highlightedTables, highlightedEdges, allNodes, allEdges, layoutType, renderFilteredGraph, setNodes, setEdges]);

  // Processar seleção em cascata quando schema for carregado ou seleção mudar
  useEffect(() => {
    if (selectedTableId && allNodes.length > 0 && allEdges.length > 0) {
      // Criar conjunto de tabelas a exibir: tabela principal + tabelas relacionadas selecionadas
      const tablesToShow = new Set<string>([selectedTableId]);
      selectedRelatedTables.forEach(tableId => tablesToShow.add(tableId));
      
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
        const connectsToMain = (fromId === selectedTableId && selectedRelatedTables.has(toId)) ||
                               (toId === selectedTableId && selectedRelatedTables.has(fromId));
        const connectsRelated = selectedRelatedTables.has(fromId) && selectedRelatedTables.has(toId);
        
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

      setNodes(uniqueLayoutedNodes);
      
      requestAnimationFrame(() => {
        setEdges(recreatedEdges);
        
        if (uniqueLayoutedNodes.length > 0 && reactFlowInstance.current) {
          setTimeout(() => {
            reactFlowInstance.current?.fitView({
              nodes: uniqueLayoutedNodes,
              padding: 0.5,
              duration: 500,
              maxZoom: 1.5,
              minZoom: 0.3,
            });
          }, 300);
        }
      });
    }
  }, [selectedTableId, selectedRelatedTables, allNodes, allEdges, layoutType, setNodes, setEdges]);

  const handleApplyLayout = useCallback(async (type: LayoutType) => {
    setLayoutType(type);
    
    if (nodes.length > 0) {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        type
      );

      // Garantir unicidade
      const uniqueNodesMap = new Map<string, Node>();
      layoutedNodes.forEach(node => {
        if (!uniqueNodesMap.has(node.id)) {
          uniqueNodesMap.set(node.id, node);
        }
      });
      const uniqueLayoutedNodes = Array.from(uniqueNodesMap.values());

      // Recriar arestas
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
              // Preservar dados completos do relacionamento
              fromTable: edge.data?.fromTable || edge.source,
              fromColumn: edge.data?.fromColumn || '',
              toTable: edge.data?.toTable || edge.target,
              toColumn: edge.data?.toColumn || '',
              relationshipLabel: edge.data?.relationshipLabel || edge.data?.label,
              relationshipType: edge.data?.relationshipType || (edge.id.startsWith('fk_') ? 'foreign_key' : edge.id.startsWith('view_') ? 'view_relationship' : 'relationship'),
            },
          };
        });

      setNodes(uniqueLayoutedNodes);
      
      requestAnimationFrame(() => {
        setEdges(recreatedEdges);
        
        if (uniqueLayoutedNodes.length > 0 && reactFlowInstance.current) {
          setTimeout(() => {
            reactFlowInstance.current?.fitView({
              nodes: uniqueLayoutedNodes,
              padding: 0.5,
              duration: 500,
              maxZoom: 1.5,
              minZoom: 0.3,
            });
          }, 150);
        }
      });
    }
  }, [nodes, edges, setNodes, setEdges]);

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

  const handleClear = useCallback(() => {
    clearHighlight();
    setSqlQuery('');
    setSelectedTableId(null);
    setSelectedRelatedTables(new Set());
    setNodes([]);
    setEdges([]);
  }, [clearHighlight, setNodes, setEdges]);

  // Handler para seleção em cascata (tabela principal + tabelas relacionadas selecionadas)
  const handleCascadingTableSelect = useCallback(async (mainTable: string | null, selectedRelated: Set<string>) => {
    setSelectedTableId(mainTable);
    setSelectedRelatedTables(selectedRelated);
    
    if (!mainTable) {
      // Limpar seleção
      clearHighlight();
      setNodes([]);
      setEdges([]);
      return;
    }

    // Se o schema ainda não foi carregado, carregar agora
    if (allNodes.length === 0) {
      setLoading(true);
      loadSchemaForAnalysis().finally(() => {
        setLoading(false);
      });
      return;
    }

    // Criar conjunto de tabelas a exibir: tabela principal + tabelas relacionadas selecionadas
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

    setNodes(uniqueLayoutedNodes);
    
    requestAnimationFrame(() => {
      setEdges(recreatedEdges);
      
      if (uniqueLayoutedNodes.length > 0 && reactFlowInstance.current) {
        setTimeout(() => {
          reactFlowInstance.current?.fitView({
            nodes: uniqueLayoutedNodes,
            padding: 0.5,
            duration: 500,
            maxZoom: 1.5,
            minZoom: 0.3,
          });
        }, 300);
      }
    });
  }, [allNodes, allEdges, layoutType, setNodes, setEdges, clearHighlight, loadSchemaForAnalysis]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
            Analisador SQL: {connectionName}
          </h1>
          <ViewSwitcher currentView="analyzer" />
          {/* Botão de Snap to Grid (Toggle) */}
          {nodes.length > 0 && (
            <button
              onClick={() => setSnapToGrid(!snapToGrid)}
              className={`btn ${snapToGrid ? 'btn-primary' : 'btn-secondary'} flex items-center h-10`}
              title={snapToGrid ? 'Desativar ajuste à grade' : 'Ativar ajuste à grade (arraste os nós para alinhar)'}
            >
              <Grid3x3 className="h-4 w-4 mr-2" />
              {snapToGrid ? 'Alinhar: ON' : 'Alinhar: OFF'}
            </button>
          )}
          {/* Controles de Layout */}
          {nodes.length > 0 && (
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
          )}
          {/* Modo Simplificado */}
          {nodes.length > 0 && (
            <button
              onClick={() => setSimplifiedView(!simplifiedView)}
              className={`btn ${simplifiedView ? 'btn-primary' : 'btn-secondary'} flex items-center h-10`}
              title={simplifiedView ? 'Modo Detalhado' : 'Modo Simplificado'}
            >
              {simplifiedView ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
              {simplifiedView ? 'Detalhado' : 'Simplificado'}
            </button>
          )}
          {/* Zoom Semântico */}
          {nodes.length > 0 && (
            <button
              onClick={() => setSemanticZoomEnabled(!semanticZoomEnabled)}
              className={`btn ${semanticZoomEnabled ? 'btn-primary' : 'btn-secondary'} flex items-center h-10`}
              title={semanticZoomEnabled ? 'Desativar Zoom Semântico' : 'Ativar Zoom Semântico'}
            >
              <ZoomIn className="h-4 w-4 mr-2" />
              {semanticZoomEnabled ? 'Zoom Semântico' : 'Zoom Fixo'}
            </button>
          )}
          {/* Controles de Zoom */}
          {nodes.length > 0 && (
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
          )}
        </div>
      </div>

      {/* Dialog de Análise SQL */}
      <SQLAnalysisDialog
        isOpen={showSQLInput}
        onClose={() => {
          setShowSQLInput(false);
        }}
        onAnalyze={handleSQLAnalysis}
        sqlQuery={sqlQuery}
        setSqlQuery={setSqlQuery}
        analysisResult={analysisResult}
        highlightedTablesCount={highlightedTables.size}
        filterMode={true}
      />

      {/* Seletor de Tabelas em Cascata */}
      <CascadingTableSelector
        nodes={allNodes.length > 0 ? allNodes : nodes}
        edges={allEdges.length > 0 ? allEdges : edges}
        onSelectTables={handleCascadingTableSelect}
        mainTableId={selectedTableId}
        selectedRelatedTables={selectedRelatedTables}
        isOpen={showTableSelector}
        onToggle={() => setShowTableSelector(!showTableSelector)}
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

      {/* Canvas para visualização */}
      {loading ? (
        <div className="card">
          <InformativeLoading 
            message="Carregando schema para análise SQL"
            type="analysis"
            estimatedTime={10}
          />
        </div>
      ) : nodes.length > 0 ? (
        <div
          className="card p-0"
          style={{
            width: '98vw',
            maxWidth: '98%',
            margin: '0 auto',
            height: 'calc(100vh - 80px)',
            minHeight: '600px',
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
                border: '1px solid rgba(0, 0,0, 0.1)',
              }}
              nodeColor={(node) => {
                return node.type === 'view' ? '#f59e0b' : '#3b82f6';
              }}
            />
          </ReactFlow>
        </div>
      ) : (
        <div className="card">
          <div className="text-center py-12 flex flex-col items-center">
            <FileText className="h-16 w-16 mx-auto mb-4 text-gray-400 dark:text-gray-600" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Analisador SQL
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Cole uma query SQL para visualizar as tabelas e relacionamentos envolvidos
            </p>
            <button
              onClick={() => setShowSQLInput(true)}
              className="btn btn-primary flex items-center justify-center h-10 mx-auto"
            >
              <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
              <span className="whitespace-nowrap">Analisar SQL</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SQLAnalyzer() {
  return (
    <ReactFlowProvider>
      <SQLAnalyzerContent />
    </ReactFlowProvider>
  );
}

