/**
 * Página Wiki - Documentação e guias do RT SQL Studio
 */

import { useState } from 'react';
import {
  Box,
  Paper,
  TextField,
  InputAdornment,
  Button,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  useTheme,
  alpha,
} from '@mui/material';
import {
  Book as BookIcon,
  ChevronRight,
  ChevronLeft,
  Search as SearchIcon,
  OpenInNew as ExternalLinkIcon,
} from '@mui/icons-material';

interface WikiSection {
  id: string;
  title: string;
  content: string;
  subsections?: WikiSection[];
}

const wikiContent: WikiSection[] = [
  {
    id: 'getting-started',
    title: '🚀 Começando',
    content: `
## Bem-vindo ao RT SQL Studio!

O RT SQL Studio é uma ferramenta poderosa para visualização e análise de bancos de dados MySQL e SQL Server.

### Primeiros Passos

1. **Criar uma Conexão**: Vá em "Conexões" e clique em "Nova Conexão"
2. **Visualizar Schema**: Clique em "Ver Schema" para ver o diagrama ER
3. **Query Builder**: Use o Query Builder visual para construir queries
4. **Monitoramento**: Acompanhe queries em tempo real
    `,
    subsections: [
      {
        id: 'connections',
        title: 'Configurando Conexões',
        content: `
### Tipos de Banco Suportados

- **MySQL 8+**: Conexão via mysql2
- **SQL Server**: Conexão via mssql (tedious)

### Campos de Conexão

- **Nome**: Identificador amigável para a conexão
- **Host**: Endereço do servidor (ex: localhost, 192.168.1.100)
- **Porta**: MySQL (3306), SQL Server (1433)
- **Usuário**: Credenciais de acesso
- **Senha**: Senha do banco
- **Database**: Nome do banco de dados
- **SSL**: Ativar conexão segura
        `,
      },
    ],
  },
  {
    id: 'query-builder',
    title: '🔧 Query Builder',
    content: `
## Construindo Queries Visualmente

O Query Builder permite criar queries SQL complexas através de uma interface visual intuitiva.

### Funcionalidades Principais

- **Drag & Drop**: Arraste colunas do catálogo para o SELECT (funciona em CTE, UNION e subselects)
- **JOINs Automáticos**: Sistema detecta relacionamentos automaticamente
- **JOINs Manuais**: Crie JOINs personalizados quando necessário
- **Subselects**: Crie subqueries em SELECT, FROM, JOIN e WHERE
- **CTEs (Common Table Expressions)**: Suporte completo a WITH clauses
- **UNION/UNION ALL**: Combine múltiplas queries
- **WHERE, GROUP BY, ORDER BY**: Interfaces dedicadas para cada cláusula
- **Funções de Agregação**: COUNT, SUM, AVG, MIN, MAX
- **Expressões Customizadas**: Crie campos calculados e expressões SQL complexas
- **Salvar e Carregar Queries**: Persistência de queries construídas
    `,
    subsections: [
      {
        id: 'joins',
        title: 'Trabalhando com JOINs',
        content: `
### JOINs Automáticos

Quando você arrasta uma coluna de outra tabela, o sistema:

1. Procura relacionamentos (Foreign Keys) entre as tabelas
2. Se encontrar, cria o JOIN automaticamente
3. Se houver múltiplos caminhos, permite escolher

### JOINs Manuais

Para VIEWs ou tabelas sem FK definida:

1. Clique em "JOIN" na barra de cláusulas
2. Clique em "Adicionar JOIN"
3. Selecione a tabela de origem e destino
4. Defina as colunas de relacionamento
5. Escolha o tipo de JOIN (INNER, LEFT, RIGHT, FULL)

### Múltiplas Condições AND

Você pode adicionar múltiplas condições em um único JOIN:

\`\`\`sql
LEFT JOIN tabela2 t2
  ON t1.col1 = t2.col1
  AND t1.col2 = t2.col2
\`\`\`
        `,
      },
      {
        id: 'where',
        title: 'Filtros WHERE',
        content: `
### Adicionando Condições

1. Clique em "WHERE" na barra de cláusulas
2. Clique em "+" para adicionar condição
3. Selecione tabela, coluna, operador e valor

### Operadores Suportados

- Comparação: =, !=, <>, >, >=, <, <=
- Texto: LIKE, NOT LIKE
- Listas: IN, NOT IN
- Nulos: IS NULL, IS NOT NULL
- Intervalos: BETWEEN, NOT BETWEEN
- Existência: EXISTS, NOT EXISTS

### Subselects no WHERE

Para IN/EXISTS, você pode criar subqueries:

\`\`\`sql
WHERE coluna IN (SELECT id FROM outra_tabela WHERE ...)
\`\`\`
        `,
      },
      {
        id: 'groupby-orderby',
        title: 'GROUP BY e ORDER BY',
        content: `
### GROUP BY

Use para agregar resultados:

1. Clique em "GROUP BY"
2. Selecione as colunas de agrupamento
3. No SELECT, use funções de agregação (COUNT, SUM, AVG, etc.)

### ORDER BY

Para ordenar resultados:

1. Clique em "ORDER BY"
2. Adicione colunas de ordenação
3. Defina direção (ASC ou DESC)
4. Reordene arrastando para definir prioridade
        `,
      },
      {
        id: 'subselects',
        title: 'Subselects (Subqueries)',
        content: `
### Onde Usar Subselects

Subselects podem ser usados em:

1. **SELECT**: Colunas calculadas baseadas em subqueries
2. **FROM**: Tabelas derivadas (derived tables)
3. **JOIN**: JOIN com subselect como tabela de destino
4. **WHERE**: Condições IN, EXISTS, comparações

### Criando um Subselect

1. No Query Builder, clique no botão "+" ao lado de "Campo Personalizado"
2. Selecione "Subselect"
3. Uma dialog abrirá com um Query Builder completo
4. Construa a query do subselect usando drag and drop
5. Salve e o subselect será adicionado

### Exemplo no SELECT

\`\`\`sql
SELECT 
  nome,
  (SELECT COUNT(*) FROM pedidos WHERE pedidos.cliente_id = clientes.id) AS total_pedidos
FROM clientes
\`\`\`

### Exemplo no FROM

\`\`\`sql
SELECT * FROM (
  SELECT cliente_id, SUM(valor) AS total
  FROM pedidos
  GROUP BY cliente_id
) AS vendas_por_cliente
\`\`\`

### Exemplo no JOIN

\`\`\`sql
SELECT * FROM clientes c
LEFT JOIN (
  SELECT cliente_id, COUNT(*) AS qtd_pedidos
  FROM pedidos
  GROUP BY cliente_id
) p ON c.id = p.cliente_id
\`\`\`
        `,
      },
      {
        id: 'ctes',
        title: 'CTEs (Common Table Expressions)',
        content: `
### O que são CTEs?

CTEs (WITH clauses) permitem definir queries temporárias reutilizáveis antes da query principal.

### Criando um CTE

1. Clique no botão "CTE" no menu inferior direito
2. Clique em "Adicionar CTE"
3. Defina o nome do CTE (ex: vendas_por_mes)
4. Opcionalmente, defina colunas explícitas
5. Use o Query Builder para construir a query do CTE
6. Salve e o CTE será adicionado

### Exemplo

\`\`\`sql
WITH vendas_por_mes (mes, total) AS (
  SELECT 
    DATE_FORMAT(data, '%Y-%m') AS mes,
    SUM(valor) AS total
  FROM vendas
  GROUP BY mes
)
SELECT * FROM vendas_por_mes
WHERE total > 1000
\`\`\`

### CTEs Recursivos

CTEs recursivos são suportados para queries hierárquicas (ex: árvores de categorias).

### Múltiplos CTEs

Você pode criar múltiplos CTEs que referenciam uns aos outros:

\`\`\`sql
WITH 
  clientes_ativos AS (
    SELECT * FROM clientes WHERE ativo = 1
  ),
  pedidos_recentes AS (
    SELECT * FROM pedidos 
    WHERE cliente_id IN (SELECT id FROM clientes_ativos)
  )
SELECT * FROM pedidos_recentes
\`\`\`
        `,
      },
      {
        id: 'union',
        title: 'UNION e UNION ALL',
        content: `
## Combinando Resultados de Múltiplas Queries

UNION permite combinar resultados de múltiplas queries SELECT em uma única tabela de resultados.

### O que é UNION?

UNION é uma operação SQL que **combina linhas de duas ou mais queries** em um único conjunto de resultados. É útil quando você precisa:

- Combinar dados de tabelas diferentes com estrutura similar
- Unir resultados de queries diferentes
- Consolidar informações de múltiplas fontes

### Diferenças entre UNION e UNION ALL

**UNION**:
- Remove linhas duplicadas automaticamente
- Mais lento (precisa verificar duplicatas)
- Garante que cada linha apareça apenas uma vez
- Use quando precisar de resultados únicos

**UNION ALL**:
- Mantém todas as linhas, incluindo duplicatas
- Mais rápido (não verifica duplicatas)
- Preserva todas as ocorrências
- Use quando duplicatas são aceitáveis ou quando você sabe que não há duplicatas

### Como Criar um UNION

1. **Construa a Query Principal**: Primeiro, construa sua query principal no Query Builder (SELECT, FROM, JOINs, etc.)
2. **Abra o Editor de UNION**: Clique no botão "UNION" no menu inferior direito da tela
3. **Adicione um UNION**: Clique em "Adicionar UNION"
4. **Escolha o Tipo**: Selecione UNION ou UNION ALL no dropdown
5. **Construa a Query UNION**: Use o Query Builder que abrirá para construir a segunda query
6. **Salve**: Salve a query UNION e ela será adicionada à sua query principal

### Requisitos Importantes

⚠️ **ATENÇÃO**: Para que UNION funcione corretamente, você DEVE seguir estas regras:

1. **Mesmo Número de Colunas**: 
   - A query principal e todas as queries UNION devem ter exatamente o mesmo número de colunas
   - Exemplo: Se a query principal tem 3 colunas, todas as queries UNION também devem ter 3 colunas

2. **Tipos de Dados Compatíveis**:
   - As colunas correspondentes devem ter tipos de dados compatíveis
   - Exemplo: Se a primeira coluna da query principal é VARCHAR, a primeira coluna do UNION também deve ser VARCHAR ou compatível

3. **Ordem das Colunas Importa**:
   - A primeira coluna da query principal será combinada com a primeira coluna do UNION
   - A segunda coluna da query principal será combinada com a segunda coluna do UNION
   - E assim por diante
   - A ordem NÃO é determinada pelos nomes das colunas, mas pela posição

### Exemplo Prático

**Query Principal**:
\`\`\`sql
SELECT nome, email, 'cliente' AS tipo FROM clientes
\`\`\`

**Query UNION**:
\`\`\`sql
SELECT nome, email, 'fornecedor' AS tipo FROM fornecedores
\`\`\`

**Resultado Final**:
\`\`\`sql
SELECT nome, email, 'cliente' AS tipo FROM clientes
UNION ALL
SELECT nome, email, 'fornecedor' AS tipo FROM fornecedores
ORDER BY nome
\`\`\`

**Resultado**: Uma lista combinada de clientes e fornecedores, todos com a mesma estrutura (nome, email, tipo).

### Múltiplas UNIONs

Você pode combinar mais de duas queries:

\`\`\`sql
SELECT nome, 'cliente' AS tipo FROM clientes
UNION ALL
SELECT nome, 'fornecedor' AS tipo FROM fornecedores
UNION ALL
SELECT nome, 'funcionario' AS tipo FROM funcionarios
\`\`\`

### Reordenar UNIONs

- Use os botões de seta (↑↓) ao lado de cada UNION para reordená-los
- A ordem dos UNIONs determina a ordem em que os resultados serão combinados

### Dicas

- **Use UNION ALL quando possível**: É mais rápido e geralmente é o que você precisa
- **Use UNION apenas quando precisar remover duplicatas**: Se você sabe que não há duplicatas, use UNION ALL
- **Verifique a ordem das colunas**: Certifique-se de que as colunas estão na mesma ordem em todas as queries
- **Use aliases consistentes**: Embora os nomes das colunas não importem para a combinação, usar aliases consistentes facilita a leitura

### Erros Comuns

❌ **Erro**: "All queries combined using a UNION, INTERSECT or EXCEPT operator must have an equal number of expressions in their target lists"

**Causa**: As queries têm números diferentes de colunas

**Solução**: Certifique-se de que todas as queries (principal + UNIONs) tenham exatamente o mesmo número de colunas

❌ **Erro**: Tipos de dados incompatíveis

**Causa**: As colunas correspondentes têm tipos incompatíveis (ex: VARCHAR e INT)

**Solução**: Use CAST ou CONVERT para converter os tipos, ou ajuste as queries para usar tipos compatíveis
        `,
      },
      {
        id: 'aggregates',
        title: 'Funções de Agregação',
        content: `
### Funções Disponíveis

- **COUNT**: Contar linhas ou valores não nulos
- **SUM**: Somar valores numéricos
- **AVG**: Calcular média
- **MIN**: Valor mínimo
- **MAX**: Valor máximo

### Adicionando Agregação

1. No Query Builder, clique no botão "+" ao lado de "Campo Personalizado"
2. Selecione "Função de Agregação"
3. Escolha a função (COUNT, SUM, AVG, MIN, MAX)
4. Selecione a coluna (ou deixe vazio para COUNT(*))
5. Defina um alias opcional
6. Adicione

### COUNT(*)

COUNT(*) conta todas as linhas, independente de valores nulos:

\`\`\`sql
SELECT COUNT(*) AS total_clientes FROM clientes
\`\`\`

### COUNT(coluna)

COUNT(coluna) conta apenas valores não nulos:

\`\`\`sql
SELECT COUNT(email) AS clientes_com_email FROM clientes
\`\`\`

### Com GROUP BY

Agregações geralmente são usadas com GROUP BY:

\`\`\`sql
SELECT 
  categoria,
  COUNT(*) AS quantidade,
  SUM(valor) AS total
FROM produtos
GROUP BY categoria
\`\`\`

### Dica

Quando usar GROUP BY, todas as colunas no SELECT devem estar no GROUP BY ou serem agregadas.
        `,
      },
      {
        id: 'expressions',
        title: 'Expressões Customizadas',
        content: `
### Campos Calculados

Crie campos com expressões SQL complexas.

### Adicionando Expressão

1. No Query Builder, clique no botão "+" ao lado de "Campo Personalizado"
2. Selecione "Expressão Customizada"
3. Digite a expressão SQL (ex: CONCAT(nome, ' ', sobrenome))
4. Defina um alias opcional
5. Adicione

### Exemplos de Expressões

**Concatenação de Strings**:
\`\`\`sql
CONCAT(nome, ' ', sobrenome) AS nome_completo
\`\`\`

**Cálculos Matemáticos**:
\`\`\`sql
(preco * quantidade) AS subtotal
\`\`\`

**Formatação de Datas**:
\`\`\`sql
DATE_FORMAT(data_nascimento, '%d/%m/%Y') AS data_formatada
\`\`\`

**Condicionais (CASE)**:
\`\`\`sql
CASE 
  WHEN idade < 18 THEN 'Menor'
  WHEN idade < 65 THEN 'Adulto'
  ELSE 'Idoso'
END AS faixa_etaria
\`\`\`

### Usando Colunas das Tabelas

Use aliases das tabelas nas expressões:

\`\`\`sql
c.nome + ' - ' + c.email AS identificacao
\`\`\`

Onde \`c\` é o alias da tabela \`clientes\`.
        `,
      },
    ],
  },
  {
    id: 'schema-viewer',
    title: '📊 Visualizador de Schema',
    content: `
## Diagrama ER Interativo

O Schema Viewer exibe um diagrama entidade-relacionamento do seu banco de dados.

### Recursos

- **Zoom e Pan**: Use scroll e arraste para navegar
- **Seleção de Nós**: Clique em uma tabela para ver detalhes
- **Relacionamentos**: Linhas conectam tabelas relacionadas
- **Tabelas vs Views**: Cores diferentes para fácil identificação

### Legenda

- 📊 **Azul**: Tabelas
- 👁️ **Amarelo**: Views
- **Linhas Roxas**: Foreign Keys
    `,
  },
  {
    id: 'ai-query',
    title: '🤖 Consulta com IA',
    content: `
## Geração de SQL com OpenAI

Use linguagem natural para gerar queries SQL.

### Configuração

1. Vá em "Configurações"
2. Insira sua API Key da OpenAI
3. Selecione o modelo (gpt-4o-mini recomendado)

### Como Usar

1. Vá em "Consulta IA" na conexão desejada
2. Descreva o que você quer em português
3. Clique em "Gerar SQL"
4. Revise e execute a query gerada

### Exemplos de Prompts

- "Liste todos os clientes ativos ordenados por nome"
- "Mostre o total de vendas por mês do último ano"
- "Quais produtos estão com estoque abaixo de 10?"
    `,
  },
  {
    id: 'monitoring',
    title: '📡 Monitoramento',
    content: `
## Queries em Tempo Real

Acompanhe queries sendo executadas no banco de dados.

### Informações Exibidas

- **ID da Sessão**: Identificador da conexão
- **Usuário**: Quem está executando
- **Status**: Estado atual (executing, sleeping, etc.)
- **Tempo**: Duração da query
- **SQL**: Texto da query sendo executada

### Auto-Refresh

Ative para atualização automática a cada 2 segundos.

### MySQL vs SQL Server

- **MySQL**: Usa INFORMATION_SCHEMA.PROCESSLIST
- **SQL Server**: Usa sys.dm_exec_requests
    `,
  },
  {
    id: 'tips',
    title: '💡 Dicas e Truques',
    content: `
## Dicas para Melhor Uso

### Performance

- Use o cache de schema (evita recarregar toda vez)
- Limite resultados com LIMIT/TOP para testes
- Prefira índices nas colunas de JOIN e WHERE

### Query Builder

- Comece pela tabela principal (FROM)
- Adicione JOINs antes de condições complexas
- Use alias para queries mais legíveis
- Salve queries frequentes para reutilizar

### VIEWs

- VIEWs aparecem em amarelo no catálogo
- VIEWs podem não ter FK explícita - use JOIN manual
- O sistema tenta extrair relacionamentos da definição da VIEW

### Atalhos

- Ctrl+C: Copiar SQL gerado
- Duplo clique em coluna: Adicionar ao SELECT
- Arrastar e soltar: Reordenar colunas
- Ctrl+Enter: Executar query
- Esc: Fechar dialogs

### Drag and Drop

O drag and drop funciona em todos os contextos:

- **Query Builder Principal**: Arraste colunas do catálogo para SELECT
- **Subselects**: Funciona dentro do dialog de subselect
- **CTEs**: Funciona ao editar a query do CTE
- **UNION**: Funciona ao editar a query do UNION

### Remoção Automática de JOINs

Quando você remove uma coluna:
- O JOIN associado é removido automaticamente se não houver outras colunas daquela tabela
- JOINs intermediários também são removidos se não forem mais necessários

### VIEWs e JOINs

- VIEWs aparecem em amarelo no catálogo
- Ao arrastar uma VIEW, o sistema abre o criador de JOIN manual
- Isso permite definir o relacionamento explicitamente
    `,
  },
  {
    id: 'troubleshooting',
    title: '🔧 Troubleshooting',
    content: `
## Solução de Problemas Comuns

### Drag and Drop Não Funciona

**Problema**: Não consigo arrastar colunas em CTE, UNION ou subselect.

**Solução**:
- Certifique-se de estar usando um navegador moderno (Chrome, Firefox, Edge)
- Verifique se JavaScript está habilitado
- Tente atualizar a página (F5)
- Limpe o cache do navegador

### JOIN Não é Criado Automaticamente

**Problema**: Ao arrastar uma coluna, o JOIN não é criado.

**Possíveis Causas**:
- Não há Foreign Key definida entre as tabelas
- A VIEW não tem relacionamento explícito
- O caminho é muito complexo (mais de 5 níveis)

**Solução**:
- Use o criador de JOIN manual (botão JOIN)
- Defina o relacionamento explicitamente

### Erro ao Salvar Query

**Problema**: Não consigo salvar uma query.

**Solução**:
- Verifique se há pelo menos uma coluna no SELECT
- Certifique-se de que a tabela base está definida
- Verifique se há erros de validação (SQL inválido)

### CTE ou UNION Não Aparece no SQL

**Problema**: Criei um CTE/UNION mas não aparece no SQL gerado.

**Solução**:
- Verifique se o CTE/UNION tem pelo menos uma coluna no SELECT
- Certifique-se de que salvou o CTE/UNION corretamente
- Verifique se há erros na query do CTE/UNION

### Performance Lenta

**Problema**: O Query Builder está lento.

**Soluções**:
- Limpe o cache de schema em Configurações
- Reduza o número de tabelas no schema (use filtros)
- Feche dialogs não utilizados
- Use LIMIT nas queries de teste
    `,
  },
];

export default function Wiki() {
  const theme = useTheme();
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['getting-started', 'query-builder'])
  );
  const [activeSection, setActiveSection] = useState<string>('getting-started');

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const findSection = (id: string): WikiSection | null => {
    for (const section of wikiContent) {
      if (section.id === id) return section;
      if (section.subsections) {
        for (const sub of section.subsections) {
          if (sub.id === id) return sub;
        }
      }
    }
    return null;
  };

  const activeContent = findSection(activeSection);

  const renderContent = (content: string) => {
    return content.split('```').map((part, idx) => {
      if (idx % 2 === 1) {
        // Code block
        const lines = part.split('\n');
        const language = lines[0];
        const code = lines.slice(1).join('\n');
        return (
          <Box
            key={idx}
            component="pre"
            sx={{
              bgcolor: 'grey.900',
              color: 'grey.100',
              p: 2,
              borderRadius: 1,
              overflowX: 'auto',
              my: 2,
              fontFamily: 'monospace',
              fontSize: '0.875rem',
            }}
          >
            <Box component="code">{code}</Box>
          </Box>
        );
      }
      // Regular text - render as markdown-like
      return (
        <Box key={idx}>
          {part.split('\n').map((line, lineIdx) => {
            if (line.startsWith('### ')) {
              return (
                <Typography key={lineIdx} variant="h6" sx={{ mt: 3, mb: 1, fontWeight: 600 }}>
                  {line.slice(4)}
                </Typography>
              );
            }
            if (line.startsWith('## ')) {
              return (
                <Typography key={lineIdx} variant="h5" sx={{ mt: 4, mb: 1.5, fontWeight: 700 }}>
                  {line.slice(3)}
                </Typography>
              );
            }
            if (line.startsWith('- ')) {
              return (
                <Typography key={lineIdx} component="li" sx={{ ml: 3, mb: 0.5 }}>
                  {line.slice(2)}
                </Typography>
              );
            }
            if (line.match(/^\d+\. /)) {
              return (
                <Typography key={lineIdx} component="li" sx={{ ml: 3, mb: 0.5, listStyleType: 'decimal' }}>
                  {line.replace(/^\d+\. /, '')}
                </Typography>
              );
            }
            if (line.startsWith('**') && line.endsWith('**')) {
              return (
                <Typography key={lineIdx} component="p" sx={{ fontWeight: 600, mb: 1 }}>
                  {line.slice(2, -2)}
                </Typography>
              );
            }
            if (line.trim() === '') {
              return <Box key={lineIdx} component="br" />;
            }
            return (
              <Typography key={lineIdx} component="p" sx={{ mb: 1 }}>
                {line}
              </Typography>
            );
          })}
        </Box>
      );
    });
  };

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', p: 2 }}>
      <Box sx={{ display: 'flex', gap: 3, flexGrow: 1, overflow: 'hidden' }}>
        {/* Sidebar - Índice */}
        <Box sx={{ width: 288, flexShrink: 0, overflowY: 'auto' }}>
          <Paper elevation={1} sx={{ p: 2 }}>
            {/* Search */}
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar na wiki..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 2 }}
            />

            {/* Navigation */}
            <List dense disablePadding>
              {wikiContent.map(section => {
                const isExpanded = expandedSections.has(section.id);
                const isActive = activeSection === section.id;

                return (
                  <Box key={section.id}>
                    <ListItemButton
                      onClick={() => {
                        toggleSection(section.id);
                        setActiveSection(section.id);
                      }}
                      selected={isActive}
                      sx={{
                        borderRadius: 1,
                        mb: 0.5,
                        bgcolor: isActive ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                        color: isActive ? 'primary.main' : 'text.primary',
                        '&:hover': {
                          bgcolor: isActive
                            ? alpha(theme.palette.primary.main, 0.12)
                            : 'action.hover',
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 24 }}>
                        {section.subsections ? (
                          isExpanded ? (
                            <ChevronLeft sx={{ fontSize: 16 }} />
                          ) : (
                            <ChevronRight sx={{ fontSize: 16 }} />
                          )
                        ) : (
                          <Box sx={{ width: 16 }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={section.title}
                        primaryTypographyProps={{
                          variant: 'body2',
                          fontWeight: 500,
                        }}
                      />
                    </ListItemButton>

                    {/* Subsections */}
                    {section.subsections && (
                      <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding dense sx={{ pl: 3 }}>
                          {section.subsections.map(sub => {
                            const isSubActive = activeSection === sub.id;
                            return (
                              <ListItemButton
                                key={sub.id}
                                onClick={() => setActiveSection(sub.id)}
                                selected={isSubActive}
                                sx={{
                                  borderRadius: 1,
                                  mb: 0.25,
                                  bgcolor: isSubActive
                                    ? alpha(theme.palette.primary.main, 0.08)
                                    : 'transparent',
                                  color: isSubActive ? 'primary.main' : 'text.secondary',
                                  '&:hover': {
                                    bgcolor: isSubActive
                                      ? alpha(theme.palette.primary.main, 0.12)
                                      : 'action.hover',
                                  },
                                }}
                              >
                                <ListItemText
                                  primary={sub.title}
                                  primaryTypographyProps={{
                                    variant: 'body2',
                                    fontSize: '0.8125rem',
                                  }}
                                />
                              </ListItemButton>
                            );
                          })}
                        </List>
                      </Collapse>
                    )}
                  </Box>
                );
              })}
            </List>
          </Paper>
        </Box>

        {/* Content */}
        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          <Paper elevation={1} sx={{ p: 3 }}>
            {activeContent ? (
              <Box>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 700 }}>
                  {activeContent.title}
                </Typography>
                <Box
                  sx={{
                    color: 'text.primary',
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'inherit',
                  }}
                >
                  {renderContent(activeContent.content)}
                </Box>
              </Box>
            ) : (
              <Box sx={{ textAlign: 'center', py: 6, color: 'text.secondary' }}>
                <BookIcon sx={{ fontSize: 48, mb: 2, opacity: 0.5 }} />
                <Typography variant="body1">Selecione uma seção para ver o conteúdo</Typography>
              </Box>
            )}
          </Paper>
        </Box>
      </Box>
    </Box>
  );
}
