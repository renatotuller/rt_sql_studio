import dagre from 'dagre';
import { Node, Edge } from 'reactflow';

export type LayoutType = 'hierarchical' | 'circular' | 'grid' | 'force' | 'orthogonal';

export function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  layoutType: LayoutType = 'hierarchical'
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };

  switch (layoutType) {
    case 'hierarchical':
      return getHierarchicalLayout(nodes, edges);
    case 'circular':
      return getCircularLayout(nodes, edges);
    case 'grid':
      return getGridLayout(nodes, edges);
    case 'force':
      return getForceLayout(nodes, edges);
    case 'orthogonal':
      return getOrthogonalLayout(nodes, edges);
    default:
      return { nodes, edges };
  }
}

function getHierarchicalLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Calcular tamanho médio dos nós para ajustar espaçamento
  const avgNodeWidth = nodes.reduce((sum, n) => sum + (n.width || 280), 0) / nodes.length;
  const avgNodeHeight = nodes.reduce((sum, n) => sum + (n.height || 200), 0) / nodes.length;
  
  dagreGraph.setGraph({ 
    rankdir: 'TB', // Top to Bottom
    nodesep: Math.max(150, avgNodeWidth * 0.6), // Espaçamento horizontal entre nós (aumentado)
    ranksep: Math.max(200, avgNodeHeight * 1.2), // Espaçamento vertical entre níveis (aumentado)
    align: 'UL', // Alinhamento
    marginx: 100, // Margem horizontal aumentada
    marginy: 100, // Margem vertical aumentada
  });

  // Adicionar nós ao grafo
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.width || 280,
      height: node.height || 200,
    });
  });

  // Adicionar arestas ao grafo
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calcular layout
  dagre.layout(dagreGraph);

  // Atualizar posições dos nós
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.width || 280) / 2,
        y: nodeWithPosition.y - (node.height || 200) / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function getCircularLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };
  
  const centerX = 600;
  const centerY = 400;
  // Aumentar o raio baseado no número de nós e tamanho médio dos nós
  const avgNodeSize = Math.max(280, nodes.reduce((sum, n) => sum + (n.width || 280), 0) / nodes.length);
  const radius = Math.max(400, Math.sqrt(nodes.length) * Math.max(120, avgNodeSize * 0.5));
  const angleStep = (2 * Math.PI) / nodes.length;

  const layoutedNodes = nodes.map((node, index) => {
    const angle = index * angleStep - Math.PI / 2; // Começar do topo
    const nodeWidth = node.width || 280;
    const nodeHeight = node.height || 200;
    return {
      ...node,
      position: {
        x: centerX + radius * Math.cos(angle) - nodeWidth / 2,
        y: centerY + radius * Math.sin(angle) - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function getGridLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };
  
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const nodeWidth = 300;
  const nodeHeight = 250;
  // Aumentar espaçamento para evitar sobreposição
  const spacingX = 400;
  const spacingY = 350;
  const startX = 100;
  const startY = 100;

  const layoutedNodes = nodes.map((node, index) => {
    const row = Math.floor(index / cols);
    const col = index % cols;
    const actualWidth = node.width || nodeWidth;
    const actualHeight = node.height || nodeHeight;
    return {
      ...node,
      position: {
        x: startX + col * spacingX,
        y: startY + row * spacingY,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

function getForceLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges };
  
  // Layout de força melhorado (algoritmo baseado em Fruchterman-Reingold)
  const iterations = 300;
  const area = 1200 * 800;
  const k = Math.sqrt(area / nodes.length); // Constante de força ideal
  const repulsionStrength = k * k * 2.0; // Força de repulsão aumentada para mais espaçamento
  const attractionStrength = k * 0.6; // Força de atração reduzida para evitar aglomeração
  const centerX = 600;
  const centerY = 400;
  const centerGravity = 0.003; // Força gravitacional mais suave

  // Inicializar posições em círculo espaçado para melhor distribuição inicial
  const initialRadius = Math.max(500, Math.sqrt(nodes.length) * 120);
  const angleStep = (2 * Math.PI) / nodes.length;
  let positions = new Map<string, { x: number; y: number }>();
  
  nodes.forEach((node, index) => {
    const angle = index * angleStep - Math.PI / 2; // Começar do topo
    // Adicionar pequena variação aleatória para evitar sobreposição inicial
    const variation = (Math.random() - 0.5) * 80;
    positions.set(node.id, {
      x: centerX + initialRadius * Math.cos(angle) + variation,
      y: centerY + initialRadius * Math.sin(angle) + variation,
    });
  });

  // Iterações de simulação com temperatura decrescente (simulated annealing)
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    
    // Inicializar forças
    nodes.forEach((node) => {
      forces.set(node.id, { x: 0, y: 0 });
    });

    // Força de repulsão entre todos os nós (mais eficiente)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        const pos1 = positions.get(node1.id)!;
        const pos2 = positions.get(node2.id)!;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;

        // Força de repulsão inversamente proporcional ao quadrado da distância
        const force = repulsionStrength / (distance * distance);
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;

        const force1 = forces.get(node1.id)!;
        const force2 = forces.get(node2.id)!;
        forces.set(node1.id, { x: force1.x - fx, y: force1.y - fy });
        forces.set(node2.id, { x: force2.x + fx, y: force2.y + fy });
      }
    }

    // Força de atração nas arestas (proporcional à distância)
    edges.forEach((edge) => {
      const pos1 = positions.get(edge.source);
      const pos2 = positions.get(edge.target);
      if (!pos1 || !pos2) return;

      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;

      // Força de atração proporcional à distância (tenta manter distância ideal k)
      const idealDistance = k;
      const force = (distance - idealDistance) * attractionStrength / idealDistance;
      const fx = (dx / distance) * force;
      const fy = (dy / distance) * force;

      const force1 = forces.get(edge.source)!;
      const force2 = forces.get(edge.target)!;
      forces.set(edge.source, { x: force1.x + fx, y: force1.y + fy });
      forces.set(edge.target, { x: force2.x - fx, y: force2.y - fy });
    });

    // Força gravitacional suave para manter no centro (evita dispersão excessiva)
    nodes.forEach((node) => {
      const pos = positions.get(node.id)!;
      const dx = centerX - pos.x;
      const dy = centerY - pos.y;
      const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;
      
      // Aplicar apenas se estiver muito longe do centro
      if (distance > initialRadius * 1.5) {
        const force = centerGravity * distance;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        const currentForce = forces.get(node.id)!;
        forces.set(node.id, { x: currentForce.x + fx, y: currentForce.y + fy });
      }
    });

    // Aplicar forças com temperatura decrescente (simulated annealing)
    const temperature = 1 - (iter / iterations); // De 1 para 0
    const damping = 0.15 + (0.75 * temperature); // De 0.9 para 0.15
    const maxMovement = 35 * temperature; // Limitar movimento máximo
    
    nodes.forEach((node) => {
      const force = forces.get(node.id)!;
      const pos = positions.get(node.id)!;
      
      // Limitar a magnitude do movimento
      const moveX = Math.max(-maxMovement, Math.min(maxMovement, force.x * damping));
      const moveY = Math.max(-maxMovement, Math.min(maxMovement, force.y * damping));
      
      positions.set(node.id, {
        x: pos.x + moveX,
        y: pos.y + moveY,
      });
    });
  }

  // Fase de refinamento: aplicar forças mais suaves para estabilizar e evitar aglomeração
  for (let iter = 0; iter < 80; iter++) {
    const forces = new Map<string, { x: number; y: number }>();
    nodes.forEach((node) => {
      forces.set(node.id, { x: 0, y: 0 });
    });

    // Repulsão mais suave apenas para nós muito próximos
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const node1 = nodes[i];
        const node2 = nodes[j];
        const pos1 = positions.get(node1.id)!;
        const pos2 = positions.get(node2.id)!;

        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const distance = Math.sqrt(dx * dx + dy * dy) || 0.1;

        // Aplicar repulsão apenas se estiverem muito próximos (menos que k * 0.7)
        if (distance < k * 0.7) {
          const force = (repulsionStrength * 0.2) / (distance * distance);
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;

          const force1 = forces.get(node1.id)!;
          const force2 = forces.get(node2.id)!;
          forces.set(node1.id, { x: force1.x - fx, y: force1.y - fy });
          forces.set(node2.id, { x: force2.x + fx, y: force2.y + fy });
        }
      }
    }

    // Aplicar forças de refinamento com damping progressivo
    const refinementDamping = 0.05 + (0.05 * (1 - iter / 80));
    nodes.forEach((node) => {
      const force = forces.get(node.id)!;
      const pos = positions.get(node.id)!;
      positions.set(node.id, {
        x: pos.x + force.x * refinementDamping,
        y: pos.y + force.y * refinementDamping,
      });
    });
  }

  // Calcular bounding box e centralizar
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  positions.forEach((pos) => {
    minX = Math.min(minX, pos.x);
    minY = Math.min(minY, pos.y);
    maxX = Math.max(maxX, pos.x);
    maxY = Math.max(maxY, pos.y);
  });

  const offsetX = centerX - (minX + maxX) / 2;
  const offsetY = centerY - (minY + maxY) / 2;

  const layoutedNodes = nodes.map((node) => {
    const pos = positions.get(node.id)!;
    const nodeWidth = node.width || 280;
    const nodeHeight = node.height || 200;
    return {
      ...node,
      position: {
        x: Math.max(0, pos.x + offsetX - nodeWidth / 2),
        y: Math.max(0, pos.y + offsetY - nodeHeight / 2),
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Layout Ortogonal de Grade (90 graus) - Padrão ouro para ERDs
// Minimiza cruzamentos e dobras, ideal para diagramas de entidade-relacionamento
function getOrthogonalLayout(nodes: Node[], edges: Edge[]): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  // Configuração otimizada para layout ortogonal (grade com ângulos de 90 graus)
  dagreGraph.setGraph({ 
    rankdir: 'TB', // Top to Bottom
    nodesep: 250, // Espaçamento horizontal maior para evitar sobreposição
    ranksep: 300, // Espaçamento vertical maior
    align: 'UL', // Alinhamento
    marginx: 200,
    marginy: 200,
    // Configurações para layout ortogonal
    acyclicer: 'greedy',
    ranker: 'network-simplex',
    // Forçar layout mais organizado
    edgesep: 50, // Espaçamento entre arestas paralelas
  });

  // Adicionar nós ao grafo
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: node.width || 280,
      height: node.height || 200,
    });
  });

  // Adicionar arestas
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calcular layout
  dagre.layout(dagreGraph);

  // Aplicar posições calculadas
  const positionedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - (node.width || 280) / 2,
        y: nodeWithPosition.y - (node.height || 200) / 2,
      },
    };
  });

  return { nodes: positionedNodes, edges };
}
