# Arquitetura do SQL Spy

## Visão Geral

O SQL Spy é uma ferramenta de visualização e monitoramento de bancos de dados que suporta MySQL 8+ e SQL Server. A aplicação é dividida em backend (Node.js/TypeScript) e frontend (React/TypeScript).

## Estrutura do Projeto

```
sql-spy/
├── backend/              # API Node.js + Express
│   ├── src/
│   │   ├── db/           # Drivers e introspecção de banco
│   │   │   ├── connection-manager.ts
│   │   │   ├── mysql-introspector.ts
│   │   │   └── sqlserver-introspector.ts
│   │   ├── routes/       # Endpoints REST
│   │   │   ├── connections.ts
│   │   │   ├── schema.ts
│   │   │   └── monitoring.ts
│   │   ├── ws/           # WebSocket handlers
│   │   │   └── monitoring-handler.ts
│   │   ├── storage/      # Gerenciamento de conexões
│   │   │   └── connections.ts
│   │   ├── utils/        # Utilitários
│   │   │   └── graph-builder.ts
│   │   ├── types/        # Tipos TypeScript
│   │   │   └── index.ts
│   │   └── index.ts      # Servidor Express
│   └── package.json
├── frontend/             # React + Vite
│   ├── src/
│   │   ├── api/          # Cliente HTTP
│   │   │   └── client.ts
│   │   ├── components/   # Componentes React
│   │   │   └── Layout.tsx
│   │   ├── pages/        # Páginas da aplicação
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Connections.tsx
│   │   │   ├── SchemaViewer.tsx
│   │   │   └── Monitoring.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── package.json          # Workspace root
```

## Backend

### Tecnologias

- **Node.js 18+** com TypeScript
- **Express** para API REST
- **WebSocket (ws)** para monitoramento em tempo real
- **mysql2** para conexões MySQL
- **mssql** para conexões SQL Server
- **Zod** para validação de dados

### Endpoints da API

#### Conexões (`/api/connections`)

- `GET /` - Lista todas as conexões
- `POST /` - Cria nova conexão
- `POST /test` - Testa conexão sem salvar
- `GET /:id` - Obtém conexão específica
- `DELETE /:id` - Remove conexão

#### Schema (`/api/schema`)

- `GET /:connId` - Obtém schema completo (tabelas, views, triggers, FKs)
- `GET /:connId/graph` - Obtém grafo para visualização (nodes + edges)
- `GET /:connId/ddl` - Gera DDL completo do banco

#### Monitoramento (`/api/monitoring`)

- `GET /:connId/active-queries` - Lista queries ativas
- `GET /:connId/query-stats` - Estatísticas de queries (SQL Server)

### WebSocket

O servidor WebSocket escuta na mesma porta do HTTP e aceita mensagens no formato:

```json
{
  "type": "monitoring",
  "payload": {
    "type": "subscribe" | "unsubscribe",
    "connId": "conn_123"
  }
}
```

Respostas são enviadas no formato:

```json
{
  "type": "active-queries",
  "data": [...],
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Introspecção de Banco

#### MySQL

Utiliza `INFORMATION_SCHEMA` para:
- Tabelas e colunas
- Foreign keys
- Views
- Triggers
- Índices

Queries ativas via `INFORMATION_SCHEMA.PROCESSLIST`.

#### SQL Server

Utiliza `sys.*` views para:
- Tabelas e colunas
- Foreign keys
- Views
- Triggers
- Índices

Queries ativas via `sys.dm_exec_requests` e `sys.dm_exec_sessions`.

## Frontend

### Tecnologias

- **React 18** com TypeScript
- **Vite** como build tool
- **React Router** para navegação
- **React Flow** para visualização de diagramas ER
- **TailwindCSS** para estilização
- **Axios** para requisições HTTP
- **Lucide React** para ícones
- **@dnd-kit** para drag and drop (Query Builder)

### Páginas

1. **Dashboard** (`/`) - Visão geral com cards e lista de conexões
2. **Connections** (`/connections`) - Gerenciamento de conexões
3. **Schema Viewer** (`/schema/:connId`) - Visualização de diagrama ER interativo
4. **Schema Viewer Advanced** (`/schema/:connId/advanced`) - Visualização avançada com nós customizados
5. **SQL Analyzer** (`/schema/:connId/analyzer`) - Análise de queries SQL
6. **Table Selector** (`/schema/:connId/table`) - Seletor de tabelas em cascata
7. **Query Builder** (`/schema/:connId/query-builder`) - Montagem visual de queries SELECT
8. **Monitoring** (`/monitoring/:connId`) - Monitoramento de queries em tempo real

### Visualização de Grafo

O React Flow é usado para renderizar o diagrama ER:
- **Nodes**: Tabelas (azul) e Views (amarelo)
- **Edges**: Foreign keys (linhas roxas animadas)
- **Interações**: Zoom, pan, seleção de nós
- **Painel lateral**: Detalhes das colunas ao clicar em um nó

## Fluxo de Dados

1. **Conexão**: Usuário cria conexão → Backend testa → Salva em memória
2. **Schema**: Frontend solicita schema → Backend introspeciona banco → Retorna JSON
3. **Grafo**: Frontend solicita grafo → Backend constrói nodes/edges → React Flow renderiza
4. **Monitoramento**: Frontend conecta WebSocket → Backend faz polling → Atualiza em tempo real

## Segurança

⚠️ **Nota**: Esta é uma versão de desenvolvimento. Para produção:

1. **Autenticação**: Implementar JWT ou OAuth
2. **Criptografia**: Senhas devem ser criptografadas (não armazenadas em texto)
3. **Validação**: Validar todas as entradas do usuário
4. **Rate Limiting**: Limitar requisições por IP
5. **HTTPS**: Usar SSL/TLS em produção
6. **Storage**: Substituir Map em memória por banco de dados persistente

## Performance

- **Connection Pooling**: Reutilização de conexões de banco
- **Caching**: Considerar cache de schemas (Redis)
- **Lazy Loading**: Carregar dados sob demanda
- **WebSocket**: Polling otimizado (2s por padrão)

## Melhorias Futuras

- [ ] Query Builder - Expansões:
  - [ ] WHERE clause builder
  - [ ] ORDER BY e GROUP BY
  - [ ] Visualização do grafo no canvas central
  - [ ] Executar query diretamente
- [ ] Suporte a PostgreSQL
- [ ] Histórico de queries executadas
- [ ] Análise de performance (EXPLAIN)
- [ ] Exportação de relatórios (PDF/Excel)
- [ ] Autenticação e autorização
- [ ] Multi-tenant
- [ ] Notificações de queries lentas
- [ ] Comparação de schemas entre ambientes



