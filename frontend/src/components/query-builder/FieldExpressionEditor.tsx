/**
 * Editor de expressão SQL para campos SELECT
 * Permite aplicar funções SQL (COALESCE, LEFT, RIGHT, etc.) e definir alias
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Button,
  TextField,
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Close as CloseIcon,
  Check as CheckIcon,
  HelpOutline as HelpOutlineIcon,
  FormatColorText as FormatColorTextIcon,
  Calculate as CalculateIcon,
} from '@mui/icons-material';
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
  const theme = useTheme();
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
    <Dialog
      open={true}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          maxHeight: '90vh',
        },
      }}
    >
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          pb: 1.5,
        }}
      >
        <Box>
          <Typography variant="h6">
            {isCustomField ? 'Adicionar Coluna Personalizada' : 'Editar Expressão SQL'}
          </Typography>
          {!isCustomField && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {tableAlias}.{field.column}
            </Typography>
          )}
          {isCustomField && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Crie uma expressão SQL personalizada (ex: col1 + col2, SUM(col), etc.)
            </Typography>
          )}
        </Box>
        <IconButton
          onClick={onCancel}
          size="small"
          sx={{
            color: 'text.secondary',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ overflow: 'auto' }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Expressão SQL */}
          <Box>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
              Expressão SQL
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField
                id="expression-input"
                fullWidth
                multiline
                rows={isCustomField ? 4 : 3}
                value={expression}
                onChange={e => setExpression(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isCustomField ? "Ex: t1.col1 + t1.col2, SUM(t1.valor), COALESCE(t1.nome, ''), (t1.preco * t1.quantidade) AS total" : `${tableAlias}.${field.column}`}
                sx={{
                  '& .MuiInputBase-root': {
                    fontFamily: 'monospace',
                    fontSize: '0.875rem',
                  },
                }}
              />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
                <Button
                  onClick={() => {
                    setShowFunctions(!showFunctions);
                    setShowOperators(false);
                    setShowFormats(false);
                  }}
                  variant="contained"
                  size="small"
                  startIcon={<HelpOutlineIcon />}
                  sx={{ minWidth: 'auto', px: 1.5 }}
                  title="Funções SQL"
                >
                  Funções
                </Button>
                <Button
                  onClick={() => {
                    setShowFormats(!showFormats);
                    setShowFunctions(false);
                    setShowOperators(false);
                  }}
                  variant="contained"
                  color="secondary"
                  size="small"
                  startIcon={<FormatColorTextIcon />}
                  sx={{ minWidth: 'auto', px: 1.5 }}
                  title="Formatações de Dados"
                >
                  Format
                </Button>
                {isCustomField && (
                  <Button
                    onClick={() => {
                      setShowOperators(!showOperators);
                      setShowFunctions(false);
                      setShowFormats(false);
                    }}
                    variant="contained"
                    color="success"
                    size="small"
                    startIcon={<CalculateIcon />}
                    sx={{ minWidth: 'auto', px: 1.5 }}
                    title="Operadores"
                  >
                    Ops
                  </Button>
                )}
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              Use <Chip label="Ctrl+Enter" size="small" sx={{ height: 20, fontSize: '0.6875rem' }} /> para salvar,{' '}
              <Chip label="Esc" size="small" sx={{ height: 20, fontSize: '0.6875rem' }} /> para cancelar
            </Typography>
          </Box>

          {/* Lista de Funções */}
          {showFunctions && (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'action.hover',
                maxHeight: 256,
                overflow: 'auto',
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Funções SQL Disponíveis
              </Typography>
              <Grid container spacing={1}>
                {SQL_FUNCTIONS.map(func => (
                  <Grid item xs={12} sm={6} key={func.name}>
                    <Paper
                      component="button"
                      onClick={() => handleInsertFunction(func.name)}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        width: '100%',
                        textAlign: 'left',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          borderColor: 'primary.main',
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: 'primary.main',
                          mb: 0.25,
                        }}
                      >
                        {func.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {func.description}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.625rem',
                          color: 'text.secondary',
                        }}
                      >
                        {func.example}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Lista de Formatações */}
          {showFormats && (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'action.hover',
                maxHeight: 256,
                overflow: 'auto',
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Formatações de Dados ({dbType === 'sqlserver' ? 'SQL Server' : 'MySQL'})
              </Typography>
              <Grid container spacing={1}>
                {formatFunctions.map(format => (
                  <Grid item xs={12} sm={6} key={format.name}>
                    <Paper
                      component="button"
                      onClick={() => handleInsertFormat(format)}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        width: '100%',
                        textAlign: 'left',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.secondary.main, 0.08),
                          borderColor: 'secondary.main',
                        },
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 600,
                          color: 'secondary.main',
                          mb: 0.25,
                        }}
                      >
                        {format.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.625rem' }}>
                        {format.description}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.625rem',
                          color: 'text.secondary',
                        }}
                      >
                        {format.example}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Lista de Operadores (apenas para colunas personalizadas) */}
          {showOperators && isCustomField && (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'action.hover',
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Operadores Matemáticos
              </Typography>
              <Grid container spacing={1}>
                {OPERATORS.map(op => (
                  <Grid item xs={12} sm={4} key={op.symbol}>
                    <Paper
                      component="button"
                      onClick={() => handleInsertOperator(op.symbol)}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        width: '100%',
                        textAlign: 'left',
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                        cursor: 'pointer',
                        '&:hover': {
                          bgcolor: alpha(theme.palette.success.main, 0.08),
                          borderColor: 'success.main',
                        },
                      }}
                    >
                      <Typography
                        variant="h6"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: 'success.main',
                          mb: 0.5,
                        }}
                      >
                        {op.symbol}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        {op.description}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.625rem',
                          color: 'text.secondary',
                        }}
                      >
                        {op.example}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          )}

          {/* Alias */}
          <TextField
            fullWidth
            size="small"
            label="Alias (opcional)"
            value={alias}
            onChange={e => setAlias(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                handleSave();
              }
            }}
            placeholder="nome_alias"
          />

          {/* Preview */}
          <Box>
            <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
              Preview SQL
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                bgcolor: 'action.hover',
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  color: 'text.primary',
                }}
              >
                {expression}
                {alias && ` AS ${alias}`}
              </Typography>
            </Paper>
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Button onClick={onCancel} size="small">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          size="small"
          startIcon={<CheckIcon />}
        >
          Salvar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
