import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Activity, RefreshCw } from 'lucide-react';
import { monitoringApi, connectionsApi, type ActiveQuery } from '../api/client';
import PageLayout from '../components/PageLayout';

export default function Monitoring() {
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const [connectionName, setConnectionName] = useState('');
  const [queries, setQueries] = useState<ActiveQuery[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (connId) {
      loadConnection();
      loadQueries();
      setupWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connId]);

  useEffect(() => {
    if (autoRefresh && !wsRef.current) {
      intervalRef.current = setInterval(() => {
        loadQueries();
      }, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const loadConnection = async () => {
    try {
      const response = await connectionsApi.get(connId!);
      setConnectionName(response.data.name);
    } catch (error) {
      console.error('Erro ao carregar conexão:', error);
    }
  };

  const loadQueries = async () => {
    try {
      const response = await monitoringApi.getActiveQueries(connId!);
      setQueries(response.data);
    } catch (error) {
      console.error('Erro ao carregar queries:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupWebSocket = () => {
    // Fechar conexão anterior se existir
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
    }

    // Obter URL do WebSocket da configuração
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const wsUrl = import.meta.env.VITE_WS_URL || apiUrl.replace('http://', 'ws://').replace('https://', 'wss://');
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log('WebSocket conectado');
          reconnectAttempts = 0;
          ws.send(
            JSON.stringify({
              type: 'monitoring',
              payload: {
                type: 'subscribe',
                connId: connId!,
              },
            })
          );
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'active-queries') {
              setQueries(message.data);
            }
          } catch (error) {
            console.error('Erro ao processar mensagem WebSocket:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('Erro WebSocket:', error);
        };

        ws.onclose = (event) => {
          console.log('WebSocket desconectado', event.code, event.reason);
          // Tentar reconectar se não foi fechado intencionalmente
          if (event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            console.log(`Tentando reconectar WebSocket (${reconnectAttempts}/${maxReconnectAttempts})...`);
            setTimeout(connect, 2000 * reconnectAttempts); // Backoff exponencial
          }
        };

        wsRef.current = ws;
      } catch (error) {
        console.error('Erro ao criar WebSocket:', error);
        // Fallback para polling HTTP se WebSocket falhar
        if (reconnectAttempts >= maxReconnectAttempts) {
          console.log('WebSocket falhou, usando polling HTTP como fallback');
        }
      }
    };

    connect();
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const formatSQL = (sql: string) => {
    if (!sql) return '';
    // Truncar SQL muito longo
    if (sql.length > 200) {
      return sql.substring(0, 200) + '...';
    }
    return sql;
  };

  return (
    <PageLayout 
      title={`Monitoramento: ${connectionName}`}
      backUrl="/connections"
      actions={
        <>
          <label className="flex items-center gap-1 text-xs">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="mr-1"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Auto-refresh
            </span>
          </label>
          <button 
            onClick={loadQueries} 
            className="btn btn-secondary flex items-center gap-1 text-xs px-1.5 py-0.5"
          >
            <RefreshCw className="h-3 w-3" />
            Atualizar
          </button>
        </>
      }
    >

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="card">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-blue-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Queries Ativas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {queries.length}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-green-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Tempo Médio</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {queries.length > 0
                  ? formatDuration(
                      Math.round(
                        queries.reduce((acc, q) => acc + q.elapsedTime, 0) / queries.length
                      )
                    )
                  : '0s'}
              </p>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-red-600 mr-3" />
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Mais Longa</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {queries.length > 0
                  ? formatDuration(Math.max(...queries.map((q) => q.elapsedTime)))
                  : '0s'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          </div>
        ) : queries.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Nenhuma query ativa no momento
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Session ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Host
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Database
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    Tempo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                    SQL
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {queries.map((query) => (
                  <tr key={query.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {query.sessionId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {query.user}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {query.host}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {query.database || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          query.status === 'running'
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                            : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                        }`}
                      >
                        {query.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDuration(query.elapsedTime)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      <code className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-xs">
                        {formatSQL(query.sqlText)}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

