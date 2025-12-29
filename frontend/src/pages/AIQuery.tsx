import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Copy, Check, Play, AlertCircle, Loader2, Settings as SettingsIcon, Database } from 'lucide-react';
import { openaiApi, connectionsApi, type ExecuteSQLResponse } from '../api/client';
import ViewSwitcher from '../components/ViewSwitcher';

export default function AIQuery() {
  const { connId } = useParams<{ connId: string }>();
  const navigate = useNavigate();
  const [connectionName, setConnectionName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [executionError, setExecutionError] = useState<string | null>(null);
  const [queryResults, setQueryResults] = useState<ExecuteSQLResponse | null>(null);
  const [configStatus, setConfigStatus] = useState<{ configured: boolean } | null>(null);

  useEffect(() => {
    if (connId) {
      loadConnection();
      checkConfig();
    }
  }, [connId]);

  const loadConnection = async () => {
    try {
      const response = await connectionsApi.get(connId!);
      setConnectionName(response.data.name);
    } catch (error) {
      console.error('Erro ao carregar conexão:', error);
    }
  };

  const checkConfig = async () => {
    try {
      const response = await openaiApi.getConfig();
      setConfigStatus({ configured: response.data.configured });
    } catch (error) {
      console.error('Erro ao verificar configuração:', error);
      setConfigStatus({ configured: false });
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Por favor, descreva o que você quer buscar');
      return;
    }

    if (!configStatus?.configured) {
      setError('Configure a API da OpenAI nas configurações primeiro');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedSQL('');
    setQueryResults(null);
    setExecutionError(null);

    try {
      const response = await openaiApi.generateSQL({
        prompt: prompt.trim(),
        connId: connId!,
      });
      setGeneratedSQL(response.data.sql);
    } catch (error: any) {
      console.error('Erro ao gerar SQL:', error);
      
      // Tratamento específico para diferentes tipos de erro
      if (error.code === 'ERR_NETWORK' || error.message?.includes('ERR_CONNECTION_RESET') || error.message?.includes('Network Error')) {
        setError(
          'Erro de conexão com o servidor. ' +
          'Verifique se o backend está rodando na porta 3001. ' +
          'Reinicie o servidor backend e tente novamente.'
        );
      } else if (error.response?.status === 429) {
        const errorType = error.response?.data?.errorType;
        const helpUrl = error.response?.data?.helpUrl;
        const limit = error.response?.data?.limit;
        const requested = error.response?.data?.requested;
        
        if (errorType === 'insufficient_quota') {
          setError(
            'Quota insuficiente na OpenAI. ' +
            'Você não tem créditos suficientes na sua conta. ' +
            (helpUrl ? `Adicione créditos em: ${helpUrl}` : 'Acesse https://platform.openai.com/account/billing para adicionar créditos.')
          );
        } else if (errorType === 'tokens_per_minute') {
          setError(
            `Limite de tokens por minuto excedido. ` +
            `O schema do banco é muito grande (${requested ? requested.toLocaleString() : 'muitos'} tokens). ` +
            `O limite do modelo é ${limit ? limit.toLocaleString() : '200.000'} tokens/min. ` +
            `Aguarde 1 minuto e tente novamente, ou use um modelo com maior limite (gpt-4o) nas configurações.`
          );
        } else if (errorType === 'rate_limit_exceeded') {
          setError(
            'Rate limit excedido. ' +
            'Você atingiu o limite de requisições por minuto/hora. ' +
            'Aguarde alguns minutos e tente novamente.'
          );
        } else {
          setError(
            error.response?.data?.details ||
            'Limite excedido na OpenAI. ' +
            'Verifique sua conta em https://platform.openai.com/account/billing'
          );
        }
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        setError(
          'Erro de autenticação com a API da OpenAI. ' +
          'Verifique se a API Key está correta nas configurações.'
        );
      } else if (error.response?.status >= 500) {
        setError(
          'Erro interno do servidor. ' +
          'Verifique os logs do backend para mais detalhes.'
        );
      } else {
        setError(
          error.response?.data?.error || 
          error.response?.data?.details || 
          error.message ||
          'Erro ao gerar SQL. Verifique se a API Key está configurada corretamente e se o backend está rodando.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (generatedSQL) {
      navigator.clipboard.writeText(generatedSQL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExecute = async () => {
    if (!generatedSQL || !connId) {
      return;
    }

    setExecuting(true);
    setExecutionError(null);
    setQueryResults(null);

    try {
      const response = await openaiApi.executeSQL({
        sql: generatedSQL,
        connId: connId,
      });
      setQueryResults(response.data);
    } catch (error: any) {
      console.error('Erro ao executar SQL:', error);
      setExecutionError(
        error.response?.data?.error || 
        error.response?.data?.details || 
        'Erro ao executar query SQL'
      );
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      <div 
        className="flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700" 
        style={{ 
          paddingTop: '0.25rem',
          paddingBottom: '0.25rem',
          paddingLeft: '1rem',
          paddingRight: '1rem',
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Consulta IA: {connectionName}
          </h1>
          <button
            onClick={() => navigate('/settings')}
            className="btn btn-secondary flex items-center gap-2 h-10"
            title="Configurar API OpenAI"
          >
            <SettingsIcon className="h-4 w-4" />
            Configurações
          </button>
        </div>
        <div className="flex items-center gap-2 flex-nowrap overflow-x-auto">
          <ViewSwitcher currentView="ai-query" />
        </div>
      </div>

      <div className="p-6 max-w-6xl mx-auto">
        {/* Alerta se não estiver configurado */}
        {configStatus && !configStatus.configured && (
          <div className="card mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-yellow-900 dark:text-yellow-200 mb-1">
                  Configuração Necessária
                </h3>
                <p className="text-sm text-yellow-800 dark:text-yellow-300 mb-3">
                  Para usar o gerador de SQL com IA, você precisa configurar a API Key da OpenAI.
                </p>
                <button
                  onClick={() => navigate('/settings')}
                  className="btn btn-primary text-sm"
                >
                  Ir para Configurações
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Input de Prompt */}
        <div className="card mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Descreva o que você quer buscar:
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Ex: Mostre todos os produtos com preço maior que 100 e estoque menor que 50, ordenados por nome"
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
            rows={4}
            disabled={loading || !configStatus?.configured}
          />
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Descreva em linguagem natural o que você quer buscar no banco de dados
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim() || !configStatus?.configured}
              className="btn btn-primary flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Gerar SQL
                </>
              )}
            </button>
          </div>
        </div>

        {/* Erro */}
        {error && (
          <div className="card mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                  Erro
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300">
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* SQL Gerado */}
        {generatedSQL && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                SQL Gerado:
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="btn btn-secondary flex items-center gap-2 text-sm"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      Copiar
                    </>
                  )}
                </button>
                <button
                  onClick={handleExecute}
                  disabled={executing || !generatedSQL}
                  className="btn btn-primary flex items-center gap-2 text-sm"
                >
                  {executing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Executando...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      Executar Query
                    </>
                  )}
                </button>
              </div>
            </div>
            <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
              <code>{generatedSQL}</code>
            </pre>
          </div>
        )}

        {/* Erro na Execução */}
        {executionError && (
          <div className="card mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-red-900 dark:text-red-200 mb-1">
                  Erro ao Executar Query
                </h3>
                <p className="text-sm text-red-800 dark:text-red-300">
                  {executionError}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Resultados da Query */}
        {queryResults && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Database className="h-5 w-5" />
                Resultados da Query
              </h2>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {queryResults.hasMore ? (
                  <span className="text-yellow-600 dark:text-yellow-400">
                    Mostrando {queryResults.displayedRows} de {queryResults.totalRows} resultados
                  </span>
                ) : (
                  <span>
                    {queryResults.totalRows} {queryResults.totalRows === 1 ? 'resultado' : 'resultados'}
                  </span>
                )}
              </div>
            </div>
            
            {queryResults.rows.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Nenhum resultado encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      {queryResults.columns.map((column, idx) => (
                        <th
                          key={idx}
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                        >
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {queryResults.rows.map((row, rowIdx) => (
                      <tr key={rowIdx} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        {queryResults.columns.map((column, colIdx) => (
                          <td
                            key={colIdx}
                            className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100"
                          >
                            {row[column] !== null && row[column] !== undefined
                              ? String(row[column])
                              : <span className="text-gray-400 italic">NULL</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Exemplos */}
        {!generatedSQL && !loading && (
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Exemplos de Prompts:
            </h3>
            <div className="space-y-3">
              <div 
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setPrompt('Mostre todos os produtos ordenados por nome')}
              >
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  "Mostre todos os produtos ordenados por nome"
                </p>
              </div>
              <div 
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setPrompt('Liste os clientes que fizeram compras no último mês com o valor total')}
              >
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  "Liste os clientes que fizeram compras no último mês com o valor total"
                </p>
              </div>
              <div 
                className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setPrompt('Quais produtos estão com estoque abaixo de 10 unidades?')}
              >
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  "Quais produtos estão com estoque abaixo de 10 unidades?"
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

