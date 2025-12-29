/**
 * Página Wiki - Documentação e guias do RT SQL Studio
 */

import { useState } from 'react';
import { Book, ChevronRight, ChevronDown, Search, ExternalLink } from 'lucide-react';
import PageLayout from '../components/PageLayout';

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

  return (
    <PageLayout title="Wiki - Documentação">
      <div className="flex gap-6 h-[calc(100vh-180px)]">
        {/* Sidebar - Índice */}
        <div className="w-72 flex-shrink-0 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar na wiki..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Navigation */}
            <nav className="space-y-1">
              {wikiContent.map(section => (
                <div key={section.id}>
                  <button
                    onClick={() => {
                      toggleSection(section.id);
                      setActiveSection(section.id);
                    }}
                    className={`
                      w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg
                      transition-colors text-left
                      ${activeSection === section.id
                        ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                        : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }
                    `}
                  >
                    {section.subsections ? (
                      expandedSections.has(section.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )
                    ) : (
                      <span className="w-4" />
                    )}
                    <span className="font-medium">{section.title}</span>
                  </button>

                  {/* Subsections */}
                  {section.subsections && expandedSections.has(section.id) && (
                    <div className="ml-6 mt-1 space-y-1">
                      {section.subsections.map(sub => (
                        <button
                          key={sub.id}
                          onClick={() => setActiveSection(sub.id)}
                          className={`
                            w-full px-3 py-1.5 text-sm rounded-lg text-left
                            transition-colors
                            ${activeSection === sub.id
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400'
                            }
                          `}
                        >
                          {sub.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
            {activeContent ? (
              <div className="prose dark:prose-invert max-w-none">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  {activeContent.title}
                </h1>
                <div 
                  className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
                  style={{ fontFamily: 'inherit' }}
                >
                  {activeContent.content.split('```').map((part, idx) => {
                    if (idx % 2 === 1) {
                      // Code block
                      const lines = part.split('\n');
                      const language = lines[0];
                      const code = lines.slice(1).join('\n');
                      return (
                        <pre 
                          key={idx} 
                          className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4"
                        >
                          <code>{code}</code>
                        </pre>
                      );
                    }
                    // Regular text - render as markdown-like
                    return (
                      <div key={idx}>
                        {part.split('\n').map((line, lineIdx) => {
                          if (line.startsWith('### ')) {
                            return <h3 key={lineIdx} className="text-lg font-semibold mt-6 mb-2">{line.slice(4)}</h3>;
                          }
                          if (line.startsWith('## ')) {
                            return <h2 key={lineIdx} className="text-xl font-bold mt-8 mb-3">{line.slice(3)}</h2>;
                          }
                          if (line.startsWith('- ')) {
                            return <li key={lineIdx} className="ml-4">{line.slice(2)}</li>;
                          }
                          if (line.match(/^\d+\. /)) {
                            return <li key={lineIdx} className="ml-4 list-decimal">{line.replace(/^\d+\. /, '')}</li>;
                          }
                          if (line.startsWith('**') && line.endsWith('**')) {
                            return <p key={lineIdx} className="font-semibold">{line.slice(2, -2)}</p>;
                          }
                          if (line.trim() === '') {
                            return <br key={lineIdx} />;
                          }
                          return <p key={lineIdx}>{line}</p>;
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Book className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione uma seção para ver o conteúdo</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
