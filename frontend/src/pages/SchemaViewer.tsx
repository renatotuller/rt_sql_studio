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
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  Divider,
  Button,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Download as DownloadIcon,
  ZoomIn as ZoomInIcon,
  ZoomOut as ZoomOutIcon,
  Fullscreen as Maximize2Icon,
  RotateLeft as RotateCcwIcon,
} from '@mui/icons-material';
import { schemaApi, connectionsApi, type GraphNode, type GraphEdge } from '../api/client';
import PageLayout from '../components/PageLayout';
import InformativeLoading from '../components/InformativeLoading';

export default function SchemaViewer() {
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionName, setConnectionName] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showDDL, setShowDDL] = useState(false);
  const [ddl, setDdl] = useState('');
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [zoomLevel, setZoomLevel] = useState(0.8);
  const reactFlowInstance = useRef<any>(null);

  useEffect(() => {
    if (connId) {
      loadConnection();
      loadGraph();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connId]);

  // Calcular tamanho do canvas quando os nós mudarem
  useEffect(() => {
    if (nodes.length > 0) {
      const padding = 200;
      const maxX = Math.max(...nodes.map(n => n.position.x)) + 250;
      const maxY = Math.max(...nodes.map(n => n.position.y)) + 200;
      setCanvasSize({
        width: Math.max(1200, maxX + padding),
        height: Math.max(800, maxY + padding)
      });
    }
  }, [nodes]);

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

      // Converter para formato ReactFlow
      // Calcular posições de forma mais espaçada e organizada
      const nodesPerRow = Math.ceil(Math.sqrt(graphData.nodes.length)) || 1;
      const nodeSpacing = { x: 300, y: 250 };
      const padding = 100;
      
      const flowNodes: Node[] = graphData.nodes.map((node, index) => ({
        id: node.id,
        type: 'default',
        position: {
          x: (index % nodesPerRow) * nodeSpacing.x + padding,
          y: Math.floor(index / nodesPerRow) * nodeSpacing.y + padding,
        },
        data: {
          label: (
            <div className="p-2">
              <div className="font-semibold text-sm">
                {node.type === 'view' ? '👁️' : '📊'} {node.label}
              </div>
              {node.schema && (
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {node.schema}
                </div>
              )}
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {node.columns.length} colunas
              </div>
            </div>
          ),
          nodeData: node,
        },
        style: {
          background: node.type === 'view' ? '#fef3c7' : '#dbeafe',
          border: '2px solid',
          borderColor: node.type === 'view' ? '#f59e0b' : '#3b82f6',
          borderRadius: '8px',
          minWidth: 180,
        },
      }));

      // Validar que os nós existem antes de criar edges
      const nodeIds = new Set(flowNodes.map(n => n.id));
      const flowEdges: Edge[] = graphData.edges
        .filter((edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to))
        .map((edge) => ({
          id: edge.id,
          source: edge.from,
          target: edge.to,
          label: edge.label || `${edge.fromColumn} → ${edge.toColumn}`,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2 },
          labelStyle: { fill: '#6366f1', fontWeight: 600 },
        }));

      setNodes(flowNodes);
      setEdges(flowEdges);
      setError(null); // Limpar erros anteriores
    } catch (error: any) {
      console.error('Erro ao carregar grafo:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.details || 
                          error.message || 
                          'Erro ao carregar schema';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDDL = async () => {
    try {
      const response = await schemaApi.getDDL(connId!);
      setDdl(response.data);
      setShowDDL(true);

      // Criar link de download
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

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleZoomIn = () => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.zoomIn();
      setZoomLevel(reactFlowInstance.current.getZoom());
    }
  };

  const handleZoomOut = () => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.zoomOut();
      setZoomLevel(reactFlowInstance.current.getZoom());
    }
  };

  const handleFitView = () => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.fitView({ padding: 0.2, duration: 300 });
      setTimeout(() => {
        setZoomLevel(reactFlowInstance.current.getZoom());
      }, 300);
    }
  };

  const handleResetView = () => {
    if (reactFlowInstance.current) {
      reactFlowInstance.current.setViewport({ x: 0, y: 0, zoom: 0.8 });
      setZoomLevel(0.8);
    }
  };

  const onInit = useCallback((instance: any) => {
    reactFlowInstance.current = instance;
    setZoomLevel(instance.getZoom());
  }, []);

  const onMove = useCallback((_event: any, viewport: any) => {
    if (reactFlowInstance.current) {
      setZoomLevel(reactFlowInstance.current.getZoom());
    }
  }, []);

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
      <PageLayout 
        title={`Schema: ${connectionName}`}
        backUrl="/connections"
        currentView="standard"
      >
        <div className="card">
          <div className="text-center py-12">
            <div className="text-red-600 dark:text-red-400 mb-4">
              <p className="font-semibold text-lg mb-2">Erro ao carregar schema</p>
              <p className="text-sm">{error}</p>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              <p>Possíveis causas:</p>
              <ul className="list-disc list-inside mt-2 text-left inline-block">
                <li>Banco de dados não está acessível</li>
                <li>Credenciais incorretas</li>
                <li>Permissões insuficientes no banco</li>
                <li>Banco de dados não possui tabelas</li>
              </ul>
            </div>
            <div className="flex gap-2 justify-center">
              <button 
                onClick={loadGraph} 
                className="btn btn-primary"
              >
                Tentar Novamente
              </button>
              <button 
                onClick={() => navigate('/connections')} 
                className="btn btn-secondary"
              >
                Voltar para Conexões
              </button>
            </div>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout 
      title={`Schema: ${connectionName}`}
      backUrl="/connections"
      currentView="standard"
      actions={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Controles de Zoom */}
          <Paper
            elevation={2}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              p: 1,
              border: 1,
              borderColor: 'divider',
            }}
          >
            <Tooltip title="Zoom In">
              <IconButton onClick={handleZoomIn} size="small">
                <ZoomInIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom Out">
              <IconButton onClick={handleZoomOut} size="small">
                <ZoomOutIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Tooltip title="Ajustar à Tela">
              <IconButton onClick={handleFitView} size="small">
                <Maximize2Icon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Resetar Visualização">
              <IconButton onClick={handleResetView} size="small">
                <RotateCcwIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
            <Typography variant="caption" sx={{ px: 1, minWidth: 45, textAlign: 'center', fontWeight: 500 }}>
              {Math.round(zoomLevel * 100)}%
            </Typography>
          </Paper>
          <Button
            onClick={handleDownloadDDL}
            variant="contained"
            size="small"
            startIcon={<DownloadIcon fontSize="small" />}
            sx={{
              px: 1.5,
              py: 0.25,
              minHeight: 'auto',
              fontSize: '0.6875rem',
              fontWeight: 500,
              textTransform: 'none',
              borderRadius: 1.5,
            }}
          >
            Baixar DDL
          </Button>
        </Box>
      }
      fullscreen
    >

      <div 
        className="card p-0" 
        style={{ 
          width: '100%',
          height: '100%', 
          minHeight: '600px',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div 
          className="absolute inset-0 overflow-auto canvas-scroll-container"
          style={{
            scrollbarWidth: 'auto',
            scrollbarColor: 'rgba(156, 163, 175, 0.7) rgba(0, 0, 0, 0.1)'
          }}
        >
          <div 
            style={{ 
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
              position: 'relative',
              minWidth: '100%',
              minHeight: '100%'
            }}
          >
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              onInit={onInit}
              onMove={onMove}
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
                width: `${canvasSize.width}px`, 
                height: `${canvasSize.height}px` 
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
      </div>

      {selectedNode && (
        <div className="card mt-6" style={{ width: '98%', margin: '0 auto' }}>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Detalhes: {selectedNode.data.nodeData.label}
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Coluna
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Nullable
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    PK
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {selectedNode.data.nodeData.columns.map((col: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {col.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {col.type}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {col.nullable ? 'Sim' : 'Não'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {col.isPrimaryKey ? '✓' : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showDDL && (
        <div className="card mt-6" style={{ width: '98%', margin: '0 auto' }}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">DDL Gerado</h3>
            <button onClick={() => setShowDDL(false)} className="btn btn-secondary">
              Fechar
            </button>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-auto max-h-96 text-sm">
            {ddl}
          </pre>
        </div>
      )}
    </PageLayout>
  );
}

