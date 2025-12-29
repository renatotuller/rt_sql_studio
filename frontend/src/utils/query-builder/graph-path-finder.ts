/**
 * Utilitários para encontrar caminhos entre tabelas no grafo
 */

import type { GraphNode, GraphEdge } from '../../api/client';
import type { JoinPath, JoinOption } from '../../types/query-builder';

/**
 * Encontra todos os caminhos possíveis entre duas tabelas no grafo
 * Usa BFS (Breadth-First Search) para encontrar o caminho mais curto primeiro
 */
export function findAllPaths(
  nodes: GraphNode[],
  edges: GraphEdge[],
  fromTableId: string,
  toTableId: string,
  maxDepth: number = 5
): JoinPath[] {
  // Criar mapa de adjacência (bidirecional para permitir joins em ambas direções)
  const adjacencyMap = new Map<string, Array<{ node: string; edge: GraphEdge }>>();
  
  // Inicializar mapa para todas as tabelas
  nodes.forEach(node => {
    adjacencyMap.set(node.id, []);
  });

  // Adicionar arestas bidirecionais
  edges.forEach(edge => {
    const fromList = adjacencyMap.get(edge.from) || [];
    fromList.push({ node: edge.to, edge });
    adjacencyMap.set(edge.from, fromList);

    const toList = adjacencyMap.get(edge.to) || [];
    toList.push({ node: edge.from, edge: { ...edge, from: edge.to, to: edge.from, fromColumn: edge.toColumn, toColumn: edge.fromColumn } });
    adjacencyMap.set(edge.to, toList);
  });

  const paths: JoinPath[] = [];
  const visited = new Set<string>();
  const queue: Array<{
    current: string;
    path: Array<{ from: string; to: string; fromColumn: string; toColumn: string; edgeId: string }>;
    depth: number;
  }> = [];

  // Iniciar BFS
  queue.push({
    current: fromTableId,
    path: [],
    depth: 0,
  });

  while (queue.length > 0) {
    const { current, path, depth } = queue.shift()!;

    if (depth > maxDepth) continue;

    if (current === toTableId && path.length > 0) {
      // Encontramos um caminho
      const intermediateTables = path.slice(0, -1).map(p => p.to);
      paths.push({
        edges: path,
        intermediateTables,
        length: path.length,
      });
      continue;
    }

    const key = `${current}-${path.length}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const neighbors = adjacencyMap.get(current) || [];
    for (const neighbor of neighbors) {
      const newPath = [
        ...path,
        {
          from: neighbor.edge.from,
          to: neighbor.edge.to,
          fromColumn: neighbor.edge.fromColumn,
          toColumn: neighbor.edge.toColumn,
          edgeId: neighbor.edge.id,
        },
      ];

      queue.push({
        current: neighbor.node,
        path: newPath,
        depth: depth + 1,
      });
    }
  }

  // Ordenar por comprimento (caminhos mais curtos primeiro)
  return paths.sort((a, b) => a.length - b.length);
}

/**
 * Encontra o melhor caminho entre duas tabelas
 * Prefere caminhos diretos (1 hop) sobre caminhos com múltiplos hops
 */
export function findBestPath(
  nodes: GraphNode[],
  edges: GraphEdge[],
  fromTableId: string,
  toTableId: string
): JoinPath | null {
  const paths = findAllPaths(nodes, edges, fromTableId, toTableId, 3);
  if (paths.length === 0) return null;
  
  // Retornar o caminho mais curto
  return paths[0];
}

/**
 * Encontra múltiplos caminhos e retorna opções para o usuário escolher
 */
export function findJoinOptions(
  nodes: GraphNode[],
  edges: GraphEdge[],
  fromTableId: string,
  toTableId: string
): JoinOption[] {
  const paths = findAllPaths(nodes, edges, fromTableId, toTableId, 3);
  
  return paths.map((path, index) => {
    const directRelationships = path.edges.filter(e => e.from === fromTableId || e.to === fromTableId).length;
    
    let description = '';
    if (path.length === 1) {
      description = `Relacionamento direto via ${path.edges[0].fromColumn} → ${path.edges[0].toColumn}`;
    } else {
      const tables = [fromTableId, ...path.intermediateTables, toTableId];
      description = `Caminho via ${path.intermediateTables.length} tabela(s): ${path.intermediateTables.join(' → ')}`;
    }

    return {
      path,
      description,
      directRelationships,
    };
  });
}

/**
 * Verifica se duas tabelas estão diretamente conectadas
 * Retorna o primeiro relacionamento encontrado (para compatibilidade)
 */
export function areTablesDirectlyConnected(
  edges: GraphEdge[],
  table1Id: string,
  table2Id: string
): GraphEdge | null {
  return edges.find(
    edge =>
      (edge.from === table1Id && edge.to === table2Id) ||
      (edge.from === table2Id && edge.to === table1Id)
  ) || null;
}

/**
 * Encontra TODOS os relacionamentos diretos entre duas tabelas
 */
export function findAllDirectRelationships(
  edges: GraphEdge[],
  table1Id: string,
  table2Id: string
): GraphEdge[] {
  return edges.filter(
    edge =>
      (edge.from === table1Id && edge.to === table2Id) ||
      (edge.from === table2Id && edge.to === table1Id)
  );
}

/**
 * Encontra todas as tabelas conectadas a uma tabela base (até N níveis)
 */
export function findConnectedTables(
  nodes: GraphNode[],
  edges: GraphEdge[],
  baseTableId: string,
  maxDepth: number = 2
): Set<string> {
  const connected = new Set<string>([baseTableId]);
  const queue: Array<{ table: string; depth: number }> = [{ table: baseTableId, depth: 0 }];

  while (queue.length > 0) {
    const { table, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    edges.forEach(edge => {
      if (edge.from === table && !connected.has(edge.to)) {
        connected.add(edge.to);
        queue.push({ table: edge.to, depth: depth + 1 });
      } else if (edge.to === table && !connected.has(edge.from)) {
        connected.add(edge.from);
        queue.push({ table: edge.from, depth: depth + 1 });
      }
    });
  }

  return connected;
}

/**
 * Encontra todas as tabelas que têm relacionamento com as tabelas já incluídas na query
 * Retorna informações sobre os relacionamentos para cada tabela
 */
export function findTablesWithRelationships(
  nodes: GraphNode[],
  edges: GraphEdge[],
  includedTableIds: Set<string>
): Array<{
  tableId: string;
  tableName: string;
  relationships: Array<{
    edge: GraphEdge;
    direction: 'from' | 'to';
    relatedTableId: string;
  }>;
}> {
  const result: Map<string, {
    tableId: string;
    tableName: string;
    relationships: Array<{
      edge: GraphEdge;
      direction: 'from' | 'to';
      relatedTableId: string;
    }>;
  }> = new Map();

  // Para cada tabela incluída, encontrar todas as tabelas relacionadas
  includedTableIds.forEach(includedTableId => {
    edges.forEach(edge => {
      let relatedTableId: string | null = null;
      let direction: 'from' | 'to' | null = null;

      if (edge.from === includedTableId && !includedTableIds.has(edge.to)) {
        relatedTableId = edge.to;
        direction = 'to';
      } else if (edge.to === includedTableId && !includedTableIds.has(edge.from)) {
        relatedTableId = edge.from;
        direction = 'from';
      }

      if (relatedTableId && direction) {
        const node = nodes.find(n => n.id === relatedTableId);
        if (!node) return;

        const tableName = relatedTableId.includes('.') 
          ? relatedTableId.split('.').pop() || relatedTableId
          : relatedTableId;

        if (!result.has(relatedTableId)) {
          result.set(relatedTableId, {
            tableId: relatedTableId,
            tableName,
            relationships: [],
          });
        }

        result.get(relatedTableId)!.relationships.push({
          edge,
          direction,
          relatedTableId: includedTableId,
        });
      }
    });
  });

  return Array.from(result.values());
}

