import { memo } from 'react';
import { EdgeProps, getBezierPath, EdgeLabelRenderer, BaseEdge } from 'reactflow';

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

function CustomEdge({
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
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isHighlighted = data?.highlighted || false;
  const cardinality = data?.cardinality || 'many-to-one';

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
          transition: 'opacity 0.4s ease-in-out, stroke-width 0.4s ease-in-out, stroke 0.4s ease-in-out',
          filter: isHighlighted ? 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.5))' : 'none',
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

export default memo(CustomEdge);

