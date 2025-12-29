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

- **Drag & Drop**: Arraste colunas do catálogo para o SELECT
- **JOINs Automáticos**: Sistema detecta relacionamentos automaticamente
- **JOINs Manuais**: Crie JOINs personalizados quando necessário
- **WHERE, GROUP BY, ORDER BY**: Interfaces dedicadas para cada cláusula
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
