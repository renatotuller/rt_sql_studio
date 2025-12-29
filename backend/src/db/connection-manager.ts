import { Pool, createPool } from 'mysql2/promise';
import sql from 'mssql';
import type { DatabaseConnection, DatabaseType } from '../types/index.js';

interface ConnectionPool {
  mysql?: Pool;
  sqlserver?: sql.ConnectionPool;
}

const pools: Map<string, ConnectionPool> = new Map();

export class ConnectionManager {
  static async getMySQLPool(conn: DatabaseConnection): Promise<Pool> {
    const key = `mysql:${conn.id}`;
    
    if (!pools.has(key)) {
      const pool = createPool({
        host: conn.host,
        port: conn.port,
        user: conn.user,
        password: conn.password,
        database: conn.database,
        ssl: conn.ssl ? { rejectUnauthorized: false } : undefined,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      });
      
      pools.set(key, { mysql: pool });
    }
    
    return pools.get(key)!.mysql!;
  }

  static async getSQLServerPool(conn: DatabaseConnection): Promise<sql.ConnectionPool> {
    const key = `sqlserver:${conn.id}`;
    
    if (!pools.has(key)) {
      const config: sql.config = {
        server: conn.host,
        port: conn.port,
        user: conn.user,
        password: conn.password,
        database: conn.database,
        options: {
          encrypt: conn.ssl ?? false,
          trustServerCertificate: conn.ssl ?? false,
          enableArithAbort: true,
          requestTimeout: 60000, // 60 segundos (aumentado de 15s padrão)
        },
        pool: {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        },
      };
      
      const pool = await sql.connect(config);
      pools.set(key, { sqlserver: pool });
    }
    
    return pools.get(key)!.sqlserver!;
  }

  static async testConnection(conn: DatabaseConnection): Promise<boolean> {
    try {
      if (conn.type === 'mysql') {
        const pool = await this.getMySQLPool(conn);
        // Testar conexão básica
        await pool.query('SELECT 1');
        // Testar acesso ao banco específico
        try {
          await pool.query(`USE \`${conn.database}\``);
        } catch (error: any) {
          throw new Error(`Não foi possível acessar o banco '${conn.database}': ${error.message}`);
        }
        // Testar acesso ao INFORMATION_SCHEMA
        try {
          await pool.query('SELECT 1 FROM INFORMATION_SCHEMA.TABLES LIMIT 1');
        } catch (error: any) {
          throw new Error(`Sem permissão para acessar INFORMATION_SCHEMA: ${error.message}`);
        }
        return true;
      } else {
        const pool = await this.getSQLServerPool(conn);
        await pool.request().query('SELECT 1');
        return true;
      }
    } catch (error: any) {
      console.error('Connection test failed:', error);
      throw error; // Lançar erro para que a mensagem seja exibida
    }
  }

  static async closeConnection(connId: string, type: DatabaseType): Promise<void> {
    const key = `${type}:${connId}`;
    const pool = pools.get(key);
    
    if (pool) {
      if (type === 'mysql' && pool.mysql) {
        await pool.mysql.end();
      } else if (type === 'sqlserver' && pool.sqlserver) {
        await pool.sqlserver.close();
      }
      pools.delete(key);
    }
  }

  static async closeAll(): Promise<void> {
    for (const [key, pool] of pools.entries()) {
      if (pool.mysql) {
        await pool.mysql.end();
      }
      if (pool.sqlserver) {
        await pool.sqlserver.close();
      }
    }
    pools.clear();
  }
}


