import sql from 'mssql';
import type { SchemaInfo, Table, Column, ForeignKey, View, Trigger, Index } from '../types/index.js';

export class SQLServerIntrospector {
  constructor(private pool: sql.ConnectionPool) {}

  async getSchema(database: string): Promise<SchemaInfo> {
    const [tables, views, triggers, foreignKeys, deepDependencies] = await Promise.all([
      this.getTables(database),
      this.getViews(database),
      this.getTriggers(database),
      this.getForeignKeys(database),
      this.getDeepDependencies(database), // Extração profunda de dependências
    ]);

    // Mesclar dependências profundas com foreign keys existentes
    const allForeignKeys = [...foreignKeys, ...deepDependencies];

    return {
      tables,
      views,
      triggers,
      foreignKeys: allForeignKeys,
    };
  }

  // Extração profunda de dependências via sys.sql_expression_dependencies
  // Captura relacionamentos que não são chaves estrangeiras explícitas
  private async getDeepDependencies(database: string): Promise<ForeignKey[]> {
    try {
      const result = await this.pool.request()
        .input('database', sql.NVarChar, database)
        .query(`
          SELECT DISTINCT
            SCHEMA_NAME(t1.schema_id) AS ParentSchema,
            OBJECT_NAME(sed.referencing_id) AS ParentTable,
            SCHEMA_NAME(t2.schema_id) AS ReferencedSchema,
            OBJECT_NAME(sed.referenced_id) AS ReferencedTable,
            'DEP_' + CAST(sed.referencing_id AS VARCHAR) + '_' + CAST(sed.referenced_id AS VARCHAR) AS DependencyName
          FROM sys.sql_expression_dependencies sed
          INNER JOIN sys.tables t1 ON sed.referencing_id = t1.object_id
          INNER JOIN sys.tables t2 ON sed.referenced_id = t2.object_id
          WHERE DB_NAME() = @database
            AND sed.referencing_class = 1 -- Objects
            AND sed.referenced_class = 1 -- Objects
            AND sed.referencing_id != sed.referenced_id
            AND OBJECT_NAME(sed.referencing_id) IS NOT NULL
            AND OBJECT_NAME(sed.referenced_id) IS NOT NULL
          ORDER BY ParentSchema, ParentTable, ReferencedSchema, ReferencedTable
        `);

      const dependencies: ForeignKey[] = [];

      for (const row of result.recordset) {
        // Tentar encontrar colunas relacionadas através de nomes similares
        const parentTableName = row.ParentTable;
        const referencedTableName = row.ReferencedTable;
        
        // Buscar colunas das tabelas para tentar inferir relacionamento
        const parentColumns = await this.getColumns(database, row.ParentSchema, parentTableName);
        const referencedColumns = await this.getColumns(database, row.ReferencedSchema, referencedTableName);
        
        // Tentar encontrar coluna de relacionamento comum (ex: id, _id, etc)
        let fromColumn = '';
        let toColumn = '';
        
        // Estratégia 1: Procurar por colunas com nomes similares
        for (const pc of parentColumns) {
          for (const rc of referencedColumns) {
            // Se encontrar coluna que parece ser FK (ex: tabela_id, idTabela)
            if (rc.name.toLowerCase().includes(parentTableName.toLowerCase().substring(0, 5)) ||
                pc.name.toLowerCase().includes(referencedTableName.toLowerCase().substring(0, 5))) {
              fromColumn = pc.name;
              toColumn = rc.name;
              break;
            }
          }
          if (fromColumn) break;
        }
        
        // Estratégia 2: Se não encontrou, usar primeira coluna de cada tabela
        if (!fromColumn && parentColumns.length > 0 && referencedColumns.length > 0) {
          fromColumn = parentColumns[0].name;
          toColumn = referencedColumns[0].name;
        }

        if (fromColumn && toColumn) {
          dependencies.push({
            name: row.DependencyName,
            fromTable: row.ParentSchema ? `${row.ParentSchema}.${row.ParentTable}` : row.ParentTable,
            fromColumn,
            toTable: row.ReferencedSchema ? `${row.ReferencedSchema}.${row.ReferencedTable}` : row.ReferencedTable,
            toColumn,
          });
        }
      }

      return dependencies;
    } catch (error) {
      console.error('Erro ao extrair dependências profundas:', error);
      return []; // Retornar vazio em caso de erro (pode não ter permissão)
    }
  }

  private async getTables(database: string): Promise<Table[]> {
    const result = await this.pool.request()
      .input('database', sql.NVarChar, database)
      .query(`
        SELECT t.name AS TABLE_NAME, s.name AS SCHEMA_NAME
        FROM sys.tables t
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE DB_NAME() = @database
        ORDER BY s.name, t.name
      `);

    const tables: Table[] = [];

    for (const row of result.recordset) {
      const schema = row.SCHEMA_NAME;
      const tableName = row.TABLE_NAME;
      const fullName = schema ? `${schema}.${tableName}` : tableName;

      const columns = await this.getColumns(database, schema, tableName);
      const primaryKeys = await this.getPrimaryKeys(database, schema, tableName);
      const indexes = await this.getIndexes(database, schema, tableName);

      tables.push({
        name: tableName,
        schema,
        columns,
        primaryKeys,
        indexes,
      });
    }

    return tables;
  }

  private async getColumns(
    database: string,
    schema: string | undefined,
    tableName: string
  ): Promise<Column[]> {
    const schemaFilter = schema ? `AND s.name = @schema` : '';
    const result = await this.pool.request()
      .input('database', sql.NVarChar, database)
      .input('schema', sql.NVarChar, schema || null)
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT 
          c.name AS COLUMN_NAME,
          t.name AS DATA_TYPE,
          c.is_nullable AS IS_NULLABLE,
          c.is_identity AS IS_IDENTITY,
          ISNULL(dc.definition, '') AS COLUMN_DEFAULT,
          ISNULL(ep.value, '') AS COLUMN_COMMENT
        FROM sys.columns c
        INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
        INNER JOIN sys.tables tb ON c.object_id = tb.object_id
        INNER JOIN sys.schemas s ON tb.schema_id = s.schema_id
        LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id 
          AND ep.minor_id = c.column_id 
          AND ep.name = 'MS_Description'
        WHERE DB_NAME() = @database
          AND tb.name = @tableName
          ${schemaFilter}
        ORDER BY c.column_id
      `);

    const pkColumns = await this.getPrimaryKeys(database, schema, tableName);

    return result.recordset.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === 1,
      isPrimaryKey: pkColumns.includes(row.COLUMN_NAME),
      isForeignKey: false,
      defaultValue: row.COLUMN_DEFAULT || undefined,
      comment: row.COLUMN_COMMENT || undefined,
    }));
  }

  private async getPrimaryKeys(
    database: string,
    schema: string | undefined,
    tableName: string
  ): Promise<string[]> {
    const schemaFilter = schema ? `AND s.name = @schema` : '';
    const result = await this.pool.request()
      .input('database', sql.NVarChar, database)
      .input('schema', sql.NVarChar, schema || null)
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT c.name AS COLUMN_NAME
        FROM sys.key_constraints kc
        INNER JOIN sys.index_columns ic ON kc.parent_object_id = ic.object_id 
          AND kc.unique_index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id 
          AND ic.column_id = c.column_id
        INNER JOIN sys.tables t ON kc.parent_object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE DB_NAME() = @database
          AND t.name = @tableName
          AND kc.type = 'PK'
          ${schemaFilter}
        ORDER BY ic.key_ordinal
      `);

    return result.recordset.map((row: any) => row.COLUMN_NAME);
  }

  private async getIndexes(
    database: string,
    schema: string | undefined,
    tableName: string
  ): Promise<Index[]> {
    const schemaFilter = schema ? `AND s.name = @schema` : '';
    const result = await this.pool.request()
      .input('database', sql.NVarChar, database)
      .input('schema', sql.NVarChar, schema || null)
      .input('tableName', sql.NVarChar, tableName)
      .query(`
        SELECT 
          i.name AS INDEX_NAME,
          c.name AS COLUMN_NAME,
          i.is_unique AS IS_UNIQUE,
          ic.key_ordinal AS KEY_ORDINAL
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id 
          AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id 
          AND ic.column_id = c.column_id
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE DB_NAME() = @database
          AND t.name = @tableName
          AND i.type > 0
          ${schemaFilter}
        ORDER BY i.name, ic.key_ordinal
      `);

    const indexMap = new Map<string, Index>();

    for (const row of result.recordset) {
      if (!indexMap.has(row.INDEX_NAME)) {
        indexMap.set(row.INDEX_NAME, {
          name: row.INDEX_NAME,
          columns: [],
          unique: row.IS_UNIQUE === 1,
        });
      }
      indexMap.get(row.INDEX_NAME)!.columns.push(row.COLUMN_NAME);
    }

    return Array.from(indexMap.values());
  }

  private async getForeignKeys(database: string): Promise<ForeignKey[]> {
    const result = await this.pool.request()
      .input('database', sql.NVarChar, database)
      .query(`
        SELECT 
          fk.name AS FK_Name,
          tp.name AS ParentTable,
          sp.name AS ParentSchema,
          cp.name AS ParentColumn,
          tr.name AS ReferencedTable,
          sr.name AS ReferencedSchema,
          cr.name AS ReferencedColumn
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        INNER JOIN sys.tables tp ON fkc.parent_object_id = tp.object_id
        INNER JOIN sys.schemas sp ON tp.schema_id = sp.schema_id
        INNER JOIN sys.columns cp ON fkc.parent_object_id = cp.object_id 
          AND fkc.parent_column_id = cp.column_id
        INNER JOIN sys.tables tr ON fkc.referenced_object_id = tr.object_id
        INNER JOIN sys.schemas sr ON tr.schema_id = sr.schema_id
        INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id 
          AND fkc.referenced_column_id = cr.column_id
        WHERE DB_NAME() = @database
        ORDER BY sp.name, tp.name, fk.name
      `);

    return result.recordset.map((row: any) => ({
      name: row.FK_Name,
      fromTable: row.ParentSchema ? `${row.ParentSchema}.${row.ParentTable}` : row.ParentTable,
      fromColumn: row.ParentColumn,
      toTable: row.ReferencedSchema ? `${row.ReferencedSchema}.${row.ReferencedTable}` : row.ReferencedTable,
      toColumn: row.ReferencedColumn,
    }));
  }

  private async getViews(database: string): Promise<View[]> {
    const result = await this.pool.request()
      .input('database', sql.NVarChar, database)
      .query(`
        SELECT 
          v.name AS VIEW_NAME,
          s.name AS SCHEMA_NAME,
          OBJECT_DEFINITION(v.object_id) AS VIEW_DEFINITION
        FROM sys.views v
        INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
        WHERE DB_NAME() = @database
        ORDER BY s.name, v.name
      `);

    const views: View[] = [];

    for (const row of result.recordset) {
      // Extrair colunas da view
      const columns = await this.getViewColumns(database, row.SCHEMA_NAME, row.VIEW_NAME);
      
      views.push({
        name: row.VIEW_NAME,
        schema: row.SCHEMA_NAME,
        definition: row.VIEW_DEFINITION || '',
        columns,
      });
    }

    return views;
  }

  private async getViewColumns(
    database: string,
    schema: string | undefined,
    viewName: string
  ): Promise<Column[]> {
    const schemaFilter = schema ? `AND s.name = @schema` : '';
    const result = await this.pool.request()
      .input('database', sql.NVarChar, database)
      .input('schema', sql.NVarChar, schema || null)
      .input('viewName', sql.NVarChar, viewName)
      .query(`
        SELECT 
          c.name AS COLUMN_NAME,
          t.name AS DATA_TYPE,
          c.is_nullable AS IS_NULLABLE,
          ISNULL(dc.definition, '') AS COLUMN_DEFAULT,
          ISNULL(ep.value, '') AS COLUMN_COMMENT
        FROM sys.columns c
        INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
        INNER JOIN sys.views v ON c.object_id = v.object_id
        INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
        LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
        LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id 
          AND ep.minor_id = c.column_id 
          AND ep.name = 'MS_Description'
        WHERE DB_NAME() = @database
          AND v.name = @viewName
          ${schemaFilter}
        ORDER BY c.column_id
      `);

    return result.recordset.map((row: any) => ({
      name: row.COLUMN_NAME,
      type: row.DATA_TYPE,
      nullable: row.IS_NULLABLE === 1,
      isPrimaryKey: false, // Views não têm primary keys
      isForeignKey: false,
      defaultValue: row.COLUMN_DEFAULT || undefined,
      comment: row.COLUMN_COMMENT || undefined,
    }));
  }

  private async getTriggers(database: string): Promise<Trigger[]> {
    const result = await this.pool.request()
      .input('database', sql.NVarChar, database)
      .query(`
        SELECT 
          tr.name AS TRIGGER_NAME,
          t.name AS TABLE_NAME,
          s.name AS SCHEMA_NAME,
          tr.is_instead_of_trigger AS IS_INSTEAD_OF,
          OBJECT_DEFINITION(tr.object_id) AS TRIGGER_DEFINITION
        FROM sys.triggers tr
        INNER JOIN sys.tables t ON tr.parent_id = t.object_id
        INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
        WHERE DB_NAME() = @database
          AND tr.is_disabled = 0
        ORDER BY s.name, t.name, tr.name
      `);

    return result.recordset.map((row: any) => {
      const definition = row.TRIGGER_DEFINITION || '';
      const event = definition.includes('INSERT') ? 'INSERT' :
                   definition.includes('UPDATE') ? 'UPDATE' :
                   definition.includes('DELETE') ? 'DELETE' : 'UNKNOWN';
      const timing = definition.includes('INSTEAD OF') ? 'INSTEAD OF' :
                    definition.includes('AFTER') ? 'AFTER' : 'BEFORE';

      return {
        name: row.TRIGGER_NAME,
        table: row.SCHEMA_NAME ? `${row.SCHEMA_NAME}.${row.TABLE_NAME}` : row.TABLE_NAME,
        event,
        timing,
        definition,
      };
    });
  }

  async getDDL(database: string): Promise<string> {
    // SQL Server não tem SHOW CREATE como MySQL
    // Vamos gerar DDL manualmente baseado nos metadados
    const schema = await this.getSchema(database);
    const ddl: string[] = [];

    // Tabelas
    for (const table of schema.tables) {
      ddl.push(`-- Table: ${table.schema ? `${table.schema}.` : ''}${table.name}`);
      ddl.push(`CREATE TABLE ${table.schema ? `[${table.schema}].` : ''}[${table.name}] (`);
      
      const colDefs = table.columns.map(col => {
        let def = `  [${col.name}] ${col.type}`;
        if (!col.nullable) def += ' NOT NULL';
        if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
        return def;
      });
      
      ddl.push(colDefs.join(',\n'));
      
      if (table.primaryKeys.length > 0) {
        ddl.push(`  PRIMARY KEY (${table.primaryKeys.map(pk => `[${pk}]`).join(', ')})`);
      }
      
      ddl.push(');');
      ddl.push('');
    }

    // Foreign Keys
    for (const fk of schema.foreignKeys) {
      ddl.push(`-- Foreign Key: ${fk.name}`);
      ddl.push(`ALTER TABLE [${fk.fromTable}]`);
      ddl.push(`  ADD CONSTRAINT [${fk.name}]`);
      ddl.push(`  FOREIGN KEY ([${fk.fromColumn}]) REFERENCES [${fk.toTable}]([${fk.toColumn}]);`);
      ddl.push('');
    }

    // Views
    for (const view of schema.views) {
      ddl.push(`-- View: ${view.schema ? `${view.schema}.` : ''}${view.name}`);
      ddl.push(view.definition);
      ddl.push('');
    }

    // Triggers
    for (const trigger of schema.triggers) {
      ddl.push(`-- Trigger: ${trigger.name}`);
      ddl.push(trigger.definition);
      ddl.push('');
    }

    return ddl.join('\n');
  }

  async getActiveQueries(): Promise<any[]> {
    const result = await this.pool.request().query(`
      SELECT
        r.session_id,
        s.login_name,
        s.host_name,
        r.status,
        r.command,
        r.start_time,
        DATEDIFF(SECOND, r.start_time, GETDATE()) AS elapsed_seconds,
        t.text AS sql_text,
        r.blocking_session_id
      FROM sys.dm_exec_requests r
      INNER JOIN sys.dm_exec_sessions s ON r.session_id = s.session_id
      CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
      WHERE s.is_user_process = 1
        AND r.status != 'sleeping'
      ORDER BY r.start_time DESC
    `);

    return result.recordset.map((row: any) => ({
      id: `sqlserver_${row.session_id}`,
      sessionId: row.session_id,
      user: row.login_name,
      host: row.host_name,
      status: row.status,
      command: row.command,
      startTime: row.start_time,
      elapsedTime: row.elapsed_seconds || 0,
      sqlText: row.sql_text || '',
      blocking: row.blocking_session_id ? [row.blocking_session_id] : undefined,
    }));
  }

  async getQueryStats(): Promise<any[]> {
    const result = await this.pool.request().query(`
      SELECT TOP 50
        qs.execution_count,
        qs.total_elapsed_time / 1000.0 AS total_elapsed_ms,
        qs.total_elapsed_time / qs.execution_count / 1000.0 AS avg_elapsed_ms,
        qs.min_elapsed_time / 1000.0 AS min_elapsed_ms,
        qs.max_elapsed_time / 1000.0 AS max_elapsed_ms,
        t.text AS sql_text
      FROM sys.dm_exec_query_stats qs
      CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) t
      WHERE t.text NOT LIKE '%sys.dm_exec%'
      ORDER BY qs.total_elapsed_time DESC
    `);

    return result.recordset.map((row: any) => ({
      sqlText: row.sql_text || '',
      executionCount: row.execution_count,
      totalElapsedTime: row.total_elapsed_ms,
      avgElapsedTime: row.avg_elapsed_ms,
      minElapsedTime: row.min_elapsed_ms,
      maxElapsedTime: row.max_elapsed_ms,
    }));
  }
}


