import { memo } from 'react';
import { EdgeProps, getSmoothStepPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';
import { getSmartEdge } from '@tisoap/react-flow-smart-edge';

// Notação Crow's Foot (Pé de Galinha)
const CrowFootMarker = ({ id, type }: { id: string; type: 'one' | 'many' }) => {
  if (type === 'many') {
    return (
      <marker
        id={id}
        markerWidth="12"
        markerHeight="12"
        refX="9"
        refY="6"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <path
          d="M 0 0 L 0 12 L 12 6 Z"
          fill="#6366f1"
          stroke="#6366f1"
        />
        <path
          d="M 0 0 L 0 12"
          stroke="#6366f1"
          strokeWidth="2"
        />
        <path
          d="M 0 6 L 12 6"
          stroke="#6366f1"
          strokeWidth="2"
        />
      </marker>
    );
  } else {
    return (
      <marker
        id={id}
        markerWidth="8"
        markerHeight="8"
        refX="7"
        refY="4"
        orient="auto"
        markerUnits="strokeWidth"
      >
        <circle cx="4" cy="4" r="3" fill="#6366f1" stroke="#6366f1" />
      </marker>
    );
  }
};

function SmartEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
  source,
  target,
  nodes,
}: EdgeProps & { nodes?: any[] }) {
  const sourceNodeId = data?.sourceNodeId || source;
  const targetNodeId = data?.targetNodeId || target;
  const isHighlighted = data?.highlighted || false;
  const cardinality = data?.cardinality || 'many-to-one';
  
  // Usar Smart Edge se tivermos os nós disponíveis
  let edgePath = '';
  let labelX = 0;
  let labelY = 0;
  
  if (nodes && sourceNodeId && targetNodeId) {
    const sourceNode = nodes.find(n => n.id === sourceNodeId);
    const targetNode = nodes.find(n => n.id === targetNodeId);
    
    if (sourceNode && targetNode) {
      try {
        const smartPath = getSmartEdge({
          sourcePosition,
          targetPosition,
          sourceX,
          sourceY,
          targetX,
          targetY,
          nodes: nodes.map(n => ({
            id: n.id,
            position: n.position || { x: 0, y: 0 },
            width: n.width || 280,
            height: n.height || 200,
            data: n.data || {},
          })),
          options: {
            nodePadding: 20,
            gridRatio: 10,
          },
        });
        
        if (smartPath && typeof smartPath === 'object' && 'svgPathString' in smartPath) {
          edgePath = smartPath.svgPathString;
          labelX = (sourceX + targetX) / 2;
          labelY = (sourceY + targetY) / 2;
        }
      } catch (error) {
        // Fallback para smooth step se smart edge falhar
        const [path, labelXPos, labelYPos] = getSmoothStepPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          borderRadius: 20,
        });
        edgePath = path;
        labelX = labelXPos;
        labelY = labelYPos;
      }
    }
  } else {
    // Fallback para smooth step se não tivermos nós
    const [path, labelXPos, labelYPos] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
      borderRadius: 20,
    });
    edgePath = path;
    labelX = labelXPos;
    labelY = labelYPos;
  }

  return (
    <>
      <defs>
        <CrowFootMarker id={`crow-foot-${id}-source`} type={cardinality.includes('one') ? 'one' : 'many'} />
        <CrowFootMarker id={`crow-foot-${id}-target`} type={cardinality.includes('many') ? 'many' : 'one'} />
      </defs>
      <BaseEdge
        id={id}
        path={edgePath}
        markerStart={`url(#crow-foot-${id}-source)`}
        markerEnd={`url(#crow-foot-${id}-target)`}
        style={{
          ...style,
          stroke: isHighlighted ? '#ef4444' : '#6366f1',
          strokeWidth: isHighlighted ? 3 : 2,
          opacity: isHighlighted ? 1 : 0.6,
          transition: 'opacity 0.3s ease-in-out, stroke-width 0.3s ease-in-out, stroke 0.3s ease-in-out',
        }}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              fontSize: 10,
              pointerEvents: 'all',
              transition: 'opacity 0.3s ease-in-out',
            }}
            className="nodrag nopan"
          >
            <div className="px-2 py-1 bg-white dark:bg-gray-800 rounded shadow text-xs border border-gray-200 dark:border-gray-700">
              {data.label}
            </div>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(SmartEdge);







