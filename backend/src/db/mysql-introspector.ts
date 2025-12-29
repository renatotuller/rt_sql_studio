import type { Pool } from 'mysql2/promise';
import type { SchemaInfo, Table, Column, ForeignKey, View, Trigger, Index } from '../types/index.js';

export class MySQLIntrospector {
  constructor(private pool: Pool) {}

  async getSchema(database: string): Promise<SchemaInfo> {
    // Validar que o banco existe e está acessível
    try {
      const [databases] = await this.pool.query<Array<{ Database: string }>>(
        'SHOW DATABASES LIKE ?',
        [database]
      );
      
      if (databases.length === 0) {
        throw new Error(`Banco de dados '${database}' não encontrado ou sem permissão de acesso`);
      }
    } catch (error: any) {
      if (error.message.includes('não encontrado')) {
        throw error;
      }
      throw new Error(`Erro ao verificar banco de dados: ${error.message}`);
    }

    // Verificar permissões no INFORMATION_SCHEMA
    try {
      await this.pool.query('SELECT 1 FROM INFORMATION_SCHEMA.TABLES LIMIT 1');
    } catch (error: any) {
      throw new Error(`Sem permissão para acessar INFORMATION_SCHEMA. Erro: ${error.message}`);
    }

    try {
      const [tables, views, triggers, foreignKeys] = await Promise.all([
        this.getTables(database),
        this.getViews(database),
        this.getTriggers(database),
        this.getForeignKeys(database),
      ]);

      return {
        tables,
        views,
        triggers,
        foreignKeys,
      };
    } catch (error: any) {
      // Re-throw com contexto adicional
      if (error.message.includes('Access denied')) {
        throw new Error(`Acesso negado ao banco de dados '${database}'. Verifique as credenciais e permissões.`);
      }
      throw new Error(`Erro ao obter schema: ${error.message}`);
    }
  }

  private async getTables(database: string): Promise<Table[]> {
    try {
      const [tables] = await this.pool.query<Array<{ TABLE_NAME: string }>>(
        `SELECT TABLE_NAME 
         FROM INFORMATION_SCHEMA.TABLES 
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY TABLE_NAME`,
        [database]
      );

      const result: Table[] = [];

      for (const table of tables) {
        try {
          const columns = await this.getColumns(database, table.TABLE_NAME);
          const primaryKeys = await this.getPrimaryKeys(database, table.TABLE_NAME);
          const indexes = await this.getIndexes(database, table.TABLE_NAME);

          result.push({
            name: table.TABLE_NAME,
            columns,
            primaryKeys,
            indexes,
          });
        } catch (tableError: any) {
          console.warn(`Erro ao processar tabela ${table.TABLE_NAME}:`, tableError.message);
          // Continuar com outras tabelas mesmo se uma falhar
          result.push({
            name: table.TABLE_NAME,
            columns: [],
            primaryKeys: [],
            indexes: [],
          });
        }
      }

      return result;
    } catch (error: any) {
      throw new Error(`Erro ao obter tabelas: ${error.message}`);
    }
  }

  private async getColumns(database: string, tableName: string): Promise<Column[]> {
    const [columns] = await this.pool.query<Array<{
      COLUMN_NAME: string;
      DATA_TYPE: string;
      IS_NULLABLE: string;
      COLUMN_KEY: string;
      COLUMN_DEFAULT: string | null;
      COLUMN_COMMENT: string;
    }>>(
      `SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_KEY,
        COLUMN_DEFAULT,
        COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY ORDINAL_POSITION`,
      [database, tableName]
    );

    return columns.map(col => ({
      name: col.COLUMN_NAME,
      type: col.DATA_TYPE,
      nullable: col.IS_NULLABLE === 'YES',
      isPrimaryKey: col.COLUMN_KEY === 'PRI',
      isForeignKey: false, // Será preenchido depois
      defaultValue: col.COLUMN_DEFAULT ?? undefined,
      comment: col.COLUMN_COMMENT || undefined,
    }));
  }

  private async getPrimaryKeys(database: string, tableName: string): Promise<string[]> {
    const [keys] = await this.pool.query<Array<{ COLUMN_NAME: string }>>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
       WHERE TABLE_SCHEMA = ? 
         AND TABLE_NAME = ?
         AND CONSTRAINT_NAME = 'PRIMARY'
       ORDER BY ORDINAL_POSITION`,
      [database, tableName]
    );

    return keys.map(k => k.COLUMN_NAME);
  }

  private async getIndexes(database: string, tableName: string): Promise<Index[]> {
    const [indexes] = await this.pool.query<Array<{
      INDEX_NAME: string;
      COLUMN_NAME: string;
      NON_UNIQUE: number;
      SEQ_IN_INDEX: number;
    }>>(
      `SELECT 
        INDEX_NAME,
        COLUMN_NAME,
        NON_UNIQUE,
        SEQ_IN_INDEX
       FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
       ORDER BY INDEX_NAME, SEQ_IN_INDEX`,
      [database, tableName]
    );

    const indexMap = new Map<string, Index>();

    for (const idx of indexes) {
      if (!indexMap.has(idx.INDEX_NAME)) {
        indexMap.set(idx.INDEX_NAME, {
          name: idx.INDEX_NAME,
          columns: [],
          unique: idx.NON_UNIQUE === 0,
        });
      }
      indexMap.get(idx.INDEX_NAME)!.columns.push(idx.COLUMN_NAME);
    }

    return Array.from(indexMap.values());
  }

  private async getForeignKeys(database: string): Promise<ForeignKey[]> {
    const [fks] = await this.pool.query<Array<{
      CONSTRAINT_NAME: string;
      TABLE_NAME: string;
      COLUMN_NAME: string;
      REFERENCED_TABLE_NAME: string;
      REFERENCED_COLUMN_NAME: string;
    }>>(
      `SELECT 
        kcu.CONSTRAINT_NAME,
        kcu.TABLE_NAME,
        kcu.COLUMN_NAME,
        kcu.REFERENCED_TABLE_NAME,
        kcu.REFERENCED_COLUMN_NAME
       FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
       JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
         ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
         AND kcu.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
       WHERE kcu.TABLE_SCHEMA = ?
         AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
       ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME`,
      [database]
    );

    return fks.map(fk => ({
      name: fk.CONSTRAINT_NAME,
      fromTable: fk.TABLE_NAME,
      fromColumn: fk.COLUMN_NAME,
      toTable: fk.REFERENCED_TABLE_NAME,
      toColumn: fk.REFERENCED_COLUMN_NAME,
    }));
  }

  private async getViews(database: string): Promise<View[]> {
    const [views] = await this.pool.query<Array<{
      TABLE_NAME: string;
      VIEW_DEFINITION: string;
    }>>(
      `SELECT TABLE_NAME, VIEW_DEFINITION
       FROM INFORMATION_SCHEMA.VIEWS
       WHERE TABLE_SCHEMA = ?
       ORDER BY TABLE_NAME`,
      [database]
    );

    const result: View[] = [];

    for (const view of views) {
      // Extrair colunas da view usando INFORMATION_SCHEMA.COLUMNS
      const columns = await this.getViewColumns(database, view.TABLE_NAME);
      
      result.push({
        name: view.TABLE_NAME,
        definition: view.VIEW_DEFINITION,
        columns,
      });
    }

    return result;
  }

  private async getViewColumns(database: string, viewName: string): Promise<Column[]> {
    const [columns] = await this.pool.query<Array<{
      COLUMN_NAME: string;
      DATA_TYPE: string;
      IS_NULLABLE: string;
      COLUMN_DEFAULT: string | null;
      COLUMN_COMMENT: string;
    }>>(
      `SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT,
        COLUMN_COMMENT
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND TABLE_TYPE = 'VIEW'
       ORDER BY ORDINAL_POSITION`,
      [database, viewName]
    );

    return columns.map(col => ({
      name: col.COLUMN_NAME,
      type: col.DATA_TYPE,
      nullable: col.IS_NULLABLE === 'YES',
      isPrimaryKey: false, // Views não têm primary keys
      isForeignKey: false,
      defaultValue: col.COLUMN_DEFAULT ?? undefined,
      comment: col.COLUMN_COMMENT || undefined,
    }));
  }

  private async getTriggers(database: string): Promise<Trigger[]> {
    const [triggers] = await this.pool.query<Array<{
      TRIGGER_NAME: string;
      EVENT_MANIPULATION: string;
      EVENT_OBJECT_TABLE: string;
      ACTION_TIMING: string;
      ACTION_STATEMENT: string;
    }>>(
      `SELECT 
        TRIGGER_NAME,
        EVENT_MANIPULATION,
        EVENT_OBJECT_TABLE,
        ACTION_TIMING,
        ACTION_STATEMENT
       FROM INFORMATION_SCHEMA.TRIGGERS
       WHERE TRIGGER_SCHEMA = ?
       ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME`,
      [database]
    );

    return triggers.map(t => ({
      name: t.TRIGGER_NAME,
      table: t.EVENT_OBJECT_TABLE,
      event: t.EVENT_MANIPULATION,
      timing: t.ACTION_TIMING,
      definition: t.ACTION_STATEMENT,
    }));
  }

  async getDDL(database: string): Promise<string> {
    const schema = await this.getSchema(database);
    const ddl: string[] = [];

    // Tabelas (ordenadas por dependências)
    for (const table of schema.tables) {
      const [createTable] = await this.pool.query<Array<{ 'Create Table': string }>>(
        `SHOW CREATE TABLE \`${database}\`.\`${table.name}\``
      );
      if (createTable.length > 0) {
        ddl.push(`-- Table: ${table.name}`);
        ddl.push(createTable[0]['Create Table'] + ';');
        ddl.push('');
      }
    }

    // Views
    for (const view of schema.views) {
      const [createView] = await this.pool.query<Array<{ 'Create View': string }>>(
        `SHOW CREATE VIEW \`${database}\`.\`${view.name}\``
      );
      if (createView.length > 0) {
        ddl.push(`-- View: ${view.name}`);
        ddl.push(createView[0]['Create View'] + ';');
        ddl.push('');
      }
    }

    // Triggers
    for (const trigger of schema.triggers) {
      const [createTrigger] = await this.pool.query<Array<{ 'SQL Original Statement': string }>>(
        `SHOW CREATE TRIGGER \`${database}\`.\`${trigger.name}\``
      );
      if (createTrigger.length > 0) {
        ddl.push(`-- Trigger: ${trigger.name}`);
        ddl.push(createTrigger[0]['SQL Original Statement'] + ';');
        ddl.push('');
      }
    }

    return ddl.join('\n');
  }

  async getActiveQueries(): Promise<any[]> {
    const [queries] = await this.pool.query<Array<{
      ID: number;
      USER: string;
      HOST: string;
      DB: string | null;
      COMMAND: string;
      TIME: number;
      STATE: string | null;
      INFO: string | null;
    }>>(
      `SELECT 
        ID,
        USER,
        HOST,
        DB,
        COMMAND,
        TIME,
        STATE,
        INFO
       FROM INFORMATION_SCHEMA.PROCESSLIST
       WHERE COMMAND NOT IN ('Sleep', 'Binlog Dump', 'Daemon')
         AND INFO IS NOT NULL
       ORDER BY TIME DESC`
    );

    return queries.map(q => ({
      id: `mysql_${q.ID}`,
      sessionId: q.ID,
      user: q.USER,
      host: q.HOST,
      database: q.DB || undefined,
      status: q.STATE || 'running',
      command: q.COMMAND,
      startTime: new Date(Date.now() - q.TIME * 1000),
      elapsedTime: q.TIME,
      sqlText: q.INFO || '',
    }));
  }
}


