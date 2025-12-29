/**
 * Utilitário para fazer introspecção de schema e salvar no cache
 */

import { ConnectionManager } from '../db/connection-manager.js';
import { MySQLIntrospector } from '../db/mysql-introspector.js';
import { SQLServerIntrospector } from '../db/sqlserver-introspector.js';
import { GraphBuilder } from '../utils/graph-builder.js';
import { schemaCacheStorage } from '../storage/schema-cache.js';
import type { DatabaseConnection, SchemaInfo, GraphData } from '../types/index.js';

/**
 * Faz introspecção completa do banco e salva no cache
 */
export async function introspectAndCache(conn: DatabaseConnection): Promise<{
  schema: SchemaInfo;
  graph: GraphData;
}> {
  console.log(`[Introspection] Iniciando introspecção para ${conn.name} (${conn.id})`);
  
  let introspector;
  try {
    if (conn.type === 'mysql') {
      const pool = await ConnectionManager.getMySQLPool(conn);
      introspector = new MySQLIntrospector(pool);
    } else {
      const pool = await ConnectionManager.getSQLServerPool(conn);
      introspector = new SQLServerIntrospector(pool);
    }
  } catch (poolError: any) {
    console.error('[Introspection] Erro ao obter pool de conexão:', poolError);
    throw new Error(`Erro ao conectar ao banco de dados: ${poolError.message}`);
  }

  let schema: SchemaInfo;
  try {
    console.log(`[Introspection] Obtendo schema do banco: ${conn.database} (${conn.type})`);
    schema = await introspector.getSchema(conn.database);
    console.log(`[Introspection] Schema obtido: ${schema.tables.length} tabelas, ${schema.views.length} views, ${schema.foreignKeys.length} foreign keys`);
  } catch (schemaError: any) {
    console.error('[Introspection] Erro ao obter schema:', schemaError);
    throw new Error(`Erro ao obter schema: ${schemaError.message}`);
  }

  let graph: GraphData;
  try {
    console.log(`[Introspection] Construindo grafo...`);
    graph = GraphBuilder.build(schema);
    console.log(`[Introspection] Grafo construído: ${graph.nodes.length} nós, ${graph.edges.length} arestas`);
  } catch (graphError: any) {
    console.error('[Introspection] Erro ao construir grafo:', graphError);
    throw new Error(`Erro ao construir grafo: ${graphError.message}`);
  }

  // Salvar no cache
  try {
    await schemaCacheStorage.set(conn.id, schema, graph);
    console.log(`[Introspection] Cache salvo com sucesso para ${conn.id}`);
  } catch (cacheError: any) {
    console.error('[Introspection] Erro ao salvar cache:', cacheError);
    // Não falhar se o cache não puder ser salvo, apenas logar
  }

  return { schema, graph };
}







