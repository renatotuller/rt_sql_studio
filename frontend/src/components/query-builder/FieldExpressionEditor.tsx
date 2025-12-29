/**
 * Editor de expressão SQL para campos SELECT
 * Permite aplicar funções SQL (COALESCE, LEFT, RIGHT, etc.) e definir alias
 */

import { useState, useEffect } from 'react';
import { X, Check, HelpCircle } from 'lucide-react';
import type { SelectField } from '../../types/query-builder';

interface FieldExpressionEditorProps {
  field: SelectField;
  tableAlias: string;
  onSave: (expression: string, alias: string) => void;
  onCancel: () => void;
  dbType?: 'mysql' | 'sqlserver';
}

const SQL_FUNCTIONS = [
  { name: 'COALESCE', description: 'Retorna o primeiro valor não-nulo', example: 'COALESCE(col, \'\', 0)' },
  { name: 'LEFT', description: 'Retorna os primeiros N caracteres', example: 'LEFT(col, 10)' },
  { name: 'RIGHT', description: 'Retorna os últimos N caracteres', example: 'RIGHT(col, 5)' },
  { name: 'SUBSTRING', description: 'Extrai substring', example: 'SUBSTRING(col, 1, 10)' },
  { name: 'LEN', description: 'Retorna o comprimento (SQL Server)', example: 'LEN(col)' },
  { name: 'LENGTH', description: 'Retorna o comprimento (MySQL)', example: 'LENGTH(col)' },
  { name: 'UPPER', description: 'Converte para maiúsculas', example: 'UPPER(col)' },
  { name: 'LOWER', description: 'Converte para minúsculas', example: 'LOWER(col)' },
  { name: 'TRIM', description: 'Remove espaços', example: 'TRIM(col)' },
  { name: 'LTRIM', description: 'Remove espaços à esquerda', example: 'LTRIM(col)' },
  { name: 'RTRIM', description: 'Remove espaços à direita', example: 'RTRIM(col)' },
  { name: 'REPLACE', description: 'Substitui texto', example: 'REPLACE(col, \'old\', \'new\')' },
  { name: 'CONCAT', description: 'Concatena strings', example: 'CONCAT(col1, \'-\', col2)' },
  { name: 'ISNULL', description: 'Verifica se é NULL (SQL Server)', example: 'ISNULL(col, 0)' },
  { name: 'IFNULL', description: 'Verifica se é NULL (MySQL)', example: 'IFNULL(col, 0)' },
  { name: 'CAST', description: 'Converte tipo', example: 'CAST(col AS VARCHAR(50))' },
  { name: 'CONVERT', description: 'Converte tipo (SQL Server)', example: 'CONVERT(VARCHAR, col)' },
  { name: 'DATEADD', description: 'Adiciona tempo (SQL Server)', example: 'DATEADD(day, 1, col)' },
  { name: 'DATEDIFF', description: 'Diferença entre datas', example: 'DATEDIFF(day, col1, col2)' },
  { name: 'GETDATE', description: 'Data/hora atual (SQL Server)', example: 'GETDATE()' },
  { name: 'NOW', description: 'Data/hora atual (MySQL)', example: 'NOW()' },
  { name: 'YEAR', description: 'Extrai ano', example: 'YEAR(col)' },
  { name: 'MONTH', description: 'Extrai mês', example: 'MONTH(col)' },
  { name: 'DAY', description: 'Extrai dia', example: 'DAY(col)' },
  { name: 'SUM', description: 'Soma valores', example: 'SUM(col)' },
  { name: 'COUNT', description: 'Conta registros', example: 'COUNT(*)' },
  { name: 'AVG', description: 'Média', example: 'AVG(col)' },
  { name: 'MAX', description: 'Valor máximo', example: 'MAX(col)' },
  { name: 'MIN', description: 'Valor mínimo', example: 'MIN(col)' },
];

const OPERATORS = [
  { symbol: '+', description: 'Soma', example: 'col1 + col2' },
  { symbol: '-', description: 'Subtração', example: 'col1 - col2' },
  { symbol: '*', description: 'Multiplicação', example: 'col1 * col2' },
  { symbol: '/', description: 'Divisão', example: 'col1 / col2' },
  { symbol: '%', description: 'Módulo (resto)', example: 'col1 % col2' },
  { symbol: '()', description: 'Parênteses', example: '(col1 + col2) * 2' },
];

// Formatações de dados por tipo de banco
const getFormatFunctions = (dbType: 'mysql' | 'sqlserver' = 'mysql') => {
  const baseFormats = [
    { name: 'COALESCE (NULL → "")', description: 'Substitui NULL por string vazia', example: "COALESCE(col, '')", template: "COALESCE({col}, '')" },
    { name: 'COALESCE (NULL → 0)', description: 'Substitui NULL por zero', example: "COALESCE(col, 0)", template: "COALESCE({col}, 0)" },
    { name: 'COALESCE (NULL → "N/A")', description: 'Substitui NULL por "N/A"', example: "COALESCE(col, 'N/A')", template: "COALESCE({col}, 'N/A')" },
  ];

  if (dbType === 'sqlserver') {
    return [
      ...baseFormats,
      { name: 'Dinheiro (R$)', description: 'Formata como moeda brasileira', example: "FORMAT(col, 'C', 'pt-BR')", template: "FORMAT({col}, 'C', 'pt-BR')" },
      { name: 'Dinheiro (US$)', description: 'Formata como moeda americana', example: "FORMAT(col, 'C', 'en-US')", template: "FORMAT({col}, 'C', 'en-US')" },
      { name: 'Data (DD/MM/YYYY)', description: 'Formata data brasileira', example: "FORMAT(col, 'dd/MM/yyyy', 'pt-BR')", template: "FORMAT({col}, 'dd/MM/yyyy', 'pt-BR')" },
      { name: 'Data (YYYY-MM-DD)', description: 'Formata data ISO', example: "FORMAT(col, 'yyyy-MM-dd', 'pt-BR')", template: "FORMAT({col}, 'yyyy-MM-dd', 'pt-BR')" },
      { name: 'Data e Hora', description: 'Data e hora completa', example: "FORMAT(col, 'dd/MM/yyyy HH:mm:ss', 'pt-BR')", template: "FORMAT({col}, 'dd/MM/yyyy HH:mm:ss', 'pt-BR')" },
      { name: 'Data e Hora (curta)', description: 'Data e hora sem segundos', example: "FORMAT(col, 'dd/MM/yyyy HH:mm', 'pt-BR')", template: "FORMAT({col}, 'dd/MM/yyyy HH:mm', 'pt-BR')" },
      { name: 'Hora (HH:mm:ss)', description: 'Apenas hora', example: "FORMAT(col, 'HH:mm:ss', 'pt-BR')", template: "FORMAT({col}, 'HH:mm:ss', 'pt-BR')" },
      { name: 'Número (2 decimais)', description: 'Número com 2 casas decimais', example: "FORMAT(col, 'N2', 'pt-BR')", template: "FORMAT({col}, 'N2', 'pt-BR')" },
      { name: 'Número (sem decimais)', description: 'Número inteiro', example: "FORMAT(col, 'N0', 'pt-BR')", template: "FORMAT({col}, 'N0', 'pt-BR')" },
      { name: 'Percentual', description: 'Formata como percentual', example: "FORMAT(col, 'P2', 'pt-BR')", template: "FORMAT({col}, 'P2', 'pt-BR')" },
      { name: 'Texto (maiúsculas)', description: 'Converte para maiúsculas', example: "UPPER(CAST(col AS VARCHAR))", template: "UPPER(CAST({col} AS VARCHAR))" },
      { name: 'Texto (minúsculas)', description: 'Converte para minúsculas', example: "LOWER(CAST(col AS VARCHAR))", template: "LOWER(CAST({col} AS VARCHAR))" },
    ];
  } else {
    // MySQL
    return [
      ...baseFormats,
      { name: 'Dinheiro (R$)', description: 'Formata como moeda com 2 decimais', example: "CONCAT('R$ ', FORMAT(col, 2, 'pt_BR'))", template: "CONCAT('R$ ', FORMAT({col}, 2, 'pt_BR'))" },
      { name: 'Dinheiro (US$)', description: 'Formata como moeda americana', example: "CONCAT('$', FORMAT(col, 2))", template: "CONCAT('$', FORMAT({col}, 2))" },
      { name: 'Data (DD/MM/YYYY)', description: 'Formata data brasileira', example: "DATE_FORMAT(col, '%d/%m/%Y')", template: "DATE_FORMAT({col}, '%d/%m/%Y')" },
      { name: 'Data (YYYY-MM-DD)', description: 'Formata data ISO', example: "DATE_FORMAT(col, '%Y-%m-%d')", template: "DATE_FORMAT({col}, '%Y-%m-%d')" },
      { name: 'Data e Hora', description: 'Data e hora completa', example: "DATE_FORMAT(col, '%d/%m/%Y %H:%i:%s')", template: "DATE_FORMAT({col}, '%d/%m/%Y %H:%i:%s')" },
      { name: 'Data e Hora (curta)', description: 'Data e hora sem segundos', example: "DATE_FORMAT(col, '%d/%m/%Y %H:%i')", template: "DATE_FORMAT({col}, '%d/%m/%Y %H:%i')" },
      { name: 'Hora (HH:mm:ss)', description: 'Apenas hora', example: "TIME_FORMAT(col, '%H:%i:%s')", template: "TIME_FORMAT({col}, '%H:%i:%s')" },
      { name: 'Número (2 decimais)', description: 'Número com 2 casas decimais', example: "FORMAT(col, 2)", template: "FORMAT({col}, 2)" },
      { name: 'Número (sem decimais)', description: 'Número inteiro', example: "CAST(col AS UNSIGNED)", template: "CAST({col} AS UNSIGNED)" },
      { name: 'Percentual', description: 'Formata como percentual', example: "CONCAT(FORMAT(col * 100, 2), '%')", template: "CONCAT(FORMAT({col} * 100, 2), '%')" },
      { name: 'Texto (maiúsculas)', description: 'Converte para maiúsculas', example: "UPPER(CAST(col AS CHAR))", template: "UPPER(CAST({col} AS CHAR))" },
      { name: 'Texto (minúsculas)', description: 'Converte para minúsculas', example: "LOWER(CAST(col AS CHAR))", template: "LOWER(CAST({col} AS CHAR))" },
    ];
  }
};

export default function FieldExpressionEditor({
  field,
  tableAlias,
  onSave,
  onCancel,
  dbType = 'mysql',
}: FieldExpressionEditorProps) {
  const isCustomField = !field.tableId || !field.column;
  const defaultExpression = isCustomField ? '' : (field.customExpression || `${tableAlias}.${field.column}`);
  
  const [expression, setExpression] = useState(defaultExpression);
  const [alias, setAlias] = useState(field.alias || '');
  const [showFunctions, setShowFunctions] = useState(false);
  const [showOperators, setShowOperators] = useState(false);
  const [showFormats, setShowFormats] = useState(false);
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  
  const formatFunctions = getFormatFunctions(dbType);

  // Gerar expressão padrão se não houver customExpression e não for coluna personalizada
  useEffect(() => {
    if (!isCustomField && !field.customExpression && tableAlias) {
      setExpression(`${tableAlias}.${field.column}`);
    }
  }, [field, tableAlias, isCustomField]);

  const insertAtCursor = (textToInsert: string) => {
    const input = document.getElementById('expression-input') as HTMLTextAreaElement;
    if (input) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const text = expression;
      const newText = text.substring(0, start) + textToInsert + text.substring(end);
      setExpression(newText);
      
      setTimeout(() => {
        input.focus();
        const newPos = start + textToInsert.length;
        input.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      setExpression(textToInsert);
    }
  };

  const handleInsertFunction = (funcName: string) => {
    const example = SQL_FUNCTIONS.find(f => f.name === funcName)?.example || `${funcName}(col)`;
    // Se for coluna personalizada, usar apenas a função; senão, substituir 'col' pela referência
    const placeholder = isCustomField 
      ? example.replace('col', 'col') // Manter o exemplo como está
      : example.replace('col', `${tableAlias}.${field.column}`);
    
    insertAtCursor(placeholder);
    setSelectedFunction(null);
    setShowFunctions(false);
  };

  const handleInsertOperator = (operator: string) => {
    if (operator === '()') {
      insertAtCursor('()');
      // Posicionar cursor dentro dos parênteses
      setTimeout(() => {
        const input = document.getElementById('expression-input') as HTMLTextAreaElement;
        if (input) {
          const pos = input.selectionStart - 1;
          input.setSelectionRange(pos, pos);
        }
      }, 0);
    } else {
      insertAtCursor(` ${operator} `);
    }
    setShowOperators(false);
  };

  const handleInsertFormat = (format: typeof formatFunctions[0]) => {
    const input = document.getElementById('expression-input') as HTMLTextAreaElement;
    
    // Se há texto selecionado, usar o texto selecionado
    if (input && input.selectionStart !== input.selectionEnd) {
      const start = input.selectionStart;
      const end = input.selectionEnd;
      const text = expression;
      const selectedText = text.substring(start, end);
      const formatted = format.template.replace('{col}', selectedText);
      const newText = text.substring(0, start) + formatted + text.substring(end);
      setExpression(newText);
      
      setTimeout(() => {
        input.focus();
        const newPos = start + formatted.length;
        input.setSelectionRange(newPos, newPos);
      }, 0);
    } else {
      // Se não há seleção, usar a referência da coluna ou a expressão atual
      let colRef: string;
      if (isCustomField) {
        // Para coluna personalizada, usar a expressão atual ou 'col' como placeholder
        colRef = expression.trim() || 'col';
      } else {
        // Para coluna normal, usar a referência da tabela
        colRef = tableAlias ? `${tableAlias}.${field.column}` : field.column;
      }
      
      const formatted = format.template.replace('{col}', colRef);
      
      // Se a expressão está vazia ou é apenas a referência padrão, substituir completamente
      if (!expression.trim() || expression.trim() === colRef) {
        setExpression(formatted);
      } else {
        // Caso contrário, envolver a expressão atual com a formatação
        const wrapped = format.template.replace('{col}', expression.trim());
        setExpression(wrapped);
      }
      
      setTimeout(() => {
        if (input) {
          input.focus();
        }
      }, 0);
    }
    
    setShowFormats(false);
  };

  const handleSave = () => {
    const trimmedExpression = expression.trim();
    const trimmedAlias = alias.trim();
    
    // Validar expressão não vazia
    if (!trimmedExpression) {
      alert('A expressão não pode estar vazia');
      return;
    }
    
    onSave(trimmedExpression, trimmedAlias);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isCustomField ? 'Adicionar Coluna Personalizada' : 'Editar Expressão SQL'}
            </h2>
            {!isCustomField && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {tableAlias}.{field.column}
              </p>
            )}
            {isCustomField && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Crie uma expressão SQL personalizada (ex: col1 + col2, SUM(col), etc.)
              </p>
            )}
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="Cancelar (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4">
          {/* Expressão SQL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Expressão SQL
            </label>
            <div className="flex gap-2">
              <textarea
                id="expression-input"
                value={expression}
                onChange={e => setExpression(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isCustomField ? "Ex: t1.col1 + t1.col2, SUM(t1.valor), COALESCE(t1.nome, ''), (t1.preco * t1.quantidade) AS total" : `${tableAlias}.${field.column}`}
                className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={isCustomField ? 4 : 3}
              />
              <div className="flex flex-col gap-2 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowFunctions(!showFunctions);
                    setShowOperators(false);
                    setShowFormats(false);
                  }}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  title="Funções SQL"
                >
                  <HelpCircle className="h-4 w-4" />
                </button>
                <button
                  onClick={() => {
                    setShowFormats(!showFormats);
                    setShowFunctions(false);
                    setShowOperators(false);
                  }}
                  className="px-3 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs"
                  title="Formatações de Dados"
                >
                  Aa
                </button>
                {isCustomField && (
                  <button
                    onClick={() => {
                      setShowOperators(!showOperators);
                      setShowFunctions(false);
                      setShowFormats(false);
                    }}
                    className="px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    title="Operadores"
                  >
                    +-*/
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Ctrl+Enter</kbd> para salvar, <kbd className="px-1 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd> para cancelar
            </p>
          </div>

          {/* Lista de Funções */}
          {showFunctions && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900 max-h-64 overflow-y-auto custom-scrollbar">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Funções SQL Disponíveis
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {SQL_FUNCTIONS.map(func => (
                  <button
                    key={func.name}
                    onClick={() => handleInsertFunction(func.name)}
                    className="text-left px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 transition-colors"
                    title={func.description}
                  >
                    <div className="font-mono font-semibold text-blue-600 dark:text-blue-400">
                      {func.name}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-0.5">
                      {func.description}
                    </div>
                    <div className="text-gray-500 dark:text-gray-500 text-[10px] mt-1 font-mono">
                      {func.example}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Formatações */}
          {showFormats && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900 max-h-64 overflow-y-auto custom-scrollbar">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Formatações de Dados ({dbType === 'sqlserver' ? 'SQL Server' : 'MySQL'})
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {formatFunctions.map(format => (
                  <button
                    key={format.name}
                    onClick={() => handleInsertFormat(format)}
                    className="text-left px-3 py-2 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
                    title={format.description}
                  >
                    <div className="font-semibold text-purple-600 dark:text-purple-400">
                      {format.name}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 mt-0.5 text-[10px]">
                      {format.description}
                    </div>
                    <div className="text-gray-500 dark:text-gray-500 text-[9px] mt-1 font-mono">
                      {format.example}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Lista de Operadores (apenas para colunas personalizadas) */}
          {showOperators && isCustomField && (
            <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 bg-gray-50 dark:bg-gray-900">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                Operadores Matemáticos
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {OPERATORS.map(op => (
                  <button
                    key={op.symbol}
                    onClick={() => handleInsertOperator(op.symbol)}
                    className="px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-300 dark:hover:border-green-600 transition-colors"
                    title={op.description}
                  >
                    <div className="font-mono font-semibold text-green-600 dark:text-green-400 text-lg">
                      {op.symbol}
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 text-xs mt-0.5">
                      {op.description}
                    </div>
                    <div className="text-gray-500 dark:text-gray-500 text-[10px] mt-1 font-mono">
                      {op.example}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Alias */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Alias (opcional)
            </label>
            <input
              type="text"
              value={alias}
              onChange={e => setAlias(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  handleSave();
                }
              }}
              placeholder="nome_alias"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preview SQL
            </label>
            <div className="px-3 py-2 text-xs font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
              {expression}
              {alias && ` AS ${alias}`}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Check className="h-4 w-4" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

