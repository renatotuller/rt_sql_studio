declare module 'mssql' {
  export interface ConnectionPool {
    request(): Request;
    close(): Promise<void>;
  }

  export interface Request {
    query(query: string): Promise<IResult<any>>;
    timeout: number;
    input(name: string, type: any, value: any): Request;
  }

  export interface IResult<T> {
    recordset: T[];
    rowsAffected: number[];
  }

  export interface config {
    server: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    options?: {
      encrypt?: boolean;
      trustServerCertificate?: boolean;
      enableArithAbort?: boolean;
      requestTimeout?: number;
    };
    pool?: {
      max?: number;
      min?: number;
      idleTimeoutMillis?: number;
    };
  }

  export function connect(config: config): Promise<ConnectionPool>;
  
  export const NVarChar: any;
}
