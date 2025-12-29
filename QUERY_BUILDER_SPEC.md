# Query Builder - Especificação Técnica Completa

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Estrutura de Dados (AST)](#estrutura-de-dados-ast)
4. [Algoritmos](#algoritmos)
5. [Componentes React](#componentes-react)
6. [Biblioteca de Drag and Drop](#biblioteca-de-drag-and-drop)
7. [Plano de Implementação](#plano-de-implementação)
8. [Critérios de Aceite](#critérios-de-aceite)
9. [Código de Exemplo](#código-de-exemplo)

---

## 🎯 Visão Geral

O Query Builder permite montar queries SELECT através de uma interface visual com drag and drop, explorando o schema do banco de dados e gerando SQL automaticamente com JOINs baseados nos relacionamentos existentes.

### Funcionalidades Principais

- ✅ Seleção de tabela base (FROM)
- ✅ Expansão de tabelas para visualizar colunas
- ✅ Drag and drop de colunas para área SELECT
- ✅ Detecção automática de relacionamentos
- ✅ Criação automática de JOINs
- ✅ Edição manual de JOINs (tipo, condição)
- ✅ Suporte a múltiplas tabelas e múltiplos JOINs
- ✅ Geração de SQL e AST (JSON)
- ✅ Persistência de queries

---

## 🏗️ Arquitetura

### Estrutura de Componentes

```
QueryBuilder/
├── QueryBuilderPage.tsx          # Página principal
├── components/
│   ├── TableExplorer.tsx          # Catálogo de tabelas (árvore)
│   ├── SelectList.tsx             # Lista de colunas SELECT
│   ├── JoinEditor.tsx              # Editor de JOINs
│   ├── JoinPathSelector.tsx       # Modal para escolher caminho
│   ├── SQLPreview.tsx              # Preview do SQL gerado
│   └── QueryCanvas.tsx            # Canvas visual (opcional)
├── hooks/
│   ├── useQueryBuilder.ts         # Hook principal (estado + lógica)
│   ├── useJoinPathFinder.ts       # Hook para encontrar caminhos
│   └── useSQLGenerator.ts         # Hook para gerar SQL
├── utils/
│   ├── graph-path-finder.ts       # Algoritmo BFS para caminhos
│   ├── sql-generator.ts           # Geração de SQL
│   └── ast-validator.ts           # Validação do AST
└── types/
    └── query-builder.ts           # Tipos TypeScript
```

### Fluxo de Dados

```
1. Usuário seleciona tabela base
   ↓
2. useQueryBuilder atualiza AST.from
   ↓
3. Usuário arrasta coluna de outra tabela
   ↓
4. useJoinPathFinder encontra caminho no grafo
   ↓
5. Se múltiplos caminhos → JoinPathSelector (modal)
   ↓
6. useQueryBuilder adiciona JOIN ao AST
   ↓
7. useSQLGenerator gera SQL
   ↓
8. SQLPreview exibe SQL
```

### Estado Global (useQueryBuilder)

```typescript
interface QueryBuilderState {
  ast: QueryAST;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  selectedBaseTable: string | null;
  expandedTables: Set<string>;
  selectedColumns: Map<string, SelectField>;
  joins: Map<string, JoinDefinition>;
  errors: ValidationError[];
}
```

---

## 📊 Estrutura de Dados (AST)

### QueryAST (Abstract Syntax Tree)

```typescript
interface QueryAST {
  from: FromClause;
  select: SelectClause;
  joins: JoinClause[];
  where?: WhereClause;        // Futuro
  groupBy?: GroupByClause;    // Futuro
  orderBy?: OrderByClause;    // Futuro
  limit?: LimitClause;        // Futuro
}

interface FromClause {
  table: string;              // ID da tabela (ex: "dbo.Users")
  alias?: string;              // Alias opcional (ex: "u")
  schema?: string;             // Schema (ex: "dbo")
}

interface SelectClause {
  fields: SelectField[];
}

interface SelectField {
  id: string;                  // ID único do campo
  table: string;               // ID da tabela
  column: string;              // Nome da coluna
  alias?: string;              // Alias (AS)
  order: number;               // Ordem na lista (para reordenar)
}

interface JoinClause {
  id: string;                  // ID único do JOIN
  type: JoinType;              // INNER, LEFT, RIGHT, FULL
  targetTable: string;         // ID da tabela alvo
  targetAlias?: string;         // Alias da tabela alvo
  condition: JoinCondition;    // Condição ON
  relationshipId?: string;     // ID do relacionamento usado (opcional)
  path?: string[];             // Caminho no grafo (ex: ["A", "B", "C"])
}

type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL';

interface JoinCondition {
  leftTable: string;           // ID da tabela esquerda
  leftColumn: string;          // Coluna esquerda
  rightTable: string;          // ID da tabela direita
  rightColumn: string;         // Coluna direita
  operator?: string;           // "=" (padrão), "!=", ">", etc.
}

// Exemplo de AST completo
const exampleAST: QueryAST = {
  from: {
    table: "dbo.Users",
    alias: "u"
  },
  select: {
    fields: [
      {
        id: "field_1",
        table: "dbo.Users",
        column: "id",
        alias: "user_id",
        order: 0
      },
      {
        id: "field_2",
        table: "dbo.Users",
        column: "name",
        order: 1
      },
      {
        id: "field_3",
        table: "dbo.Profile",
        column: "bio",
        order: 2
      }
    ]
  },
  joins: [
    {
      id: "join_1",
      type: "LEFT",
      targetTable: "dbo.Profile",
      targetAlias: "p",
      condition: {
        leftTable: "dbo.Users",
        leftColumn: "profile_id",
        rightTable: "dbo.Profile",
        rightColumn: "id"
      },
      relationshipId: "fk_users_profile",
      path: ["dbo.Users", "dbo.Profile"]
    }
  ]
};
```

### Estrutura de Relacionamentos (GraphEdge)

```typescript
interface GraphEdge {
  id: string;                  // ID do relacionamento
  from: string;                // ID da tabela origem
  to: string;                  // ID da tabela destino
  fromColumn: string;         // Coluna origem
  toColumn: string;           // Coluna destino
  label?: string;             // Nome da FK
  type?: 'foreign_key' | 'view_relationship';
}
```

---

## 🔍 Algoritmos

### 1. Busca de Caminho no Grafo (BFS)

**Objetivo**: Encontrar o caminho mais curto entre duas tabelas no grafo de relacionamentos.

```typescript
interface PathResult {
  path: string[];              // ["A", "B", "C"]
  edges: GraphEdge[];          // Arestas usadas no caminho
  distance: number;            // Número de hops
}

function findJoinPath(
  graph: { nodes: GraphNode[]; edges: GraphEdge[] },
  fromTable: string,
  toTable: string
): PathResult[] {
  // Se mesma tabela, retornar caminho vazio (self-join)
  if (fromTable === toTable) {
    return [{
      path: [fromTable],
      edges: [],
      distance: 0
    }];
  }

  // Construir grafo direcionado
  const adjacencyList = new Map<string, GraphEdge[]>();
  graph.edges.forEach(edge => {
    if (!adjacencyList.has(edge.from)) {
      adjacencyList.set(edge.from, []);
    }
    adjacencyList.get(edge.from)!.push(edge);
  });

  // BFS para encontrar todos os caminhos mais curtos
  const queue: Array<{ table: string; path: string[]; edges: GraphEdge[] }> = [
    { table: fromTable, path: [fromTable], edges: [] }
  ];
  const visited = new Set<string>();
  const results: PathResult[] = [];
  let shortestDistance = Infinity;

  while (queue.length > 0) {
    const { table, path, edges } = queue.shift()!;
    
    // Se chegou ao destino
    if (table === toTable) {
      const distance = path.length - 1;
      if (distance <= shortestDistance) {
        shortestDistance = distance;
        results.push({ path, edges, distance });
      }
      continue;
    }

    // Se já passou do caminho mais curto, parar
    if (path.length - 1 > shortestDistance) {
      continue;
    }

    // Explorar vizinhos
    const neighbors = adjacencyList.get(table) || [];
    for (const edge of neighbors) {
      const nextTable = edge.to;
      
      // Evitar loops (exceto se for o destino)
      if (path.includes(nextTable) && nextTable !== toTable) {
        continue;
      }

      // Limitar profundidade (máximo 5 hops)
      if (path.length >= 6) {
        continue;
      }

      queue.push({
        table: nextTable,
        path: [...path, nextTable],
        edges: [...edges, edge]
      });
    }
  }

  // Retornar apenas caminhos mais curtos
  return results.filter(r => r.distance === shortestDistance);
}
```

### 2. Escolha de Relacionamento Preferencial

Quando há múltiplos relacionamentos diretos entre duas tabelas:

```typescript
function chooseBestRelationship(
  edges: GraphEdge[],
  fromTable: string,
  toTable: string
): GraphEdge | null {
  if (edges.length === 0) return null;
  if (edges.length === 1) return edges[0];

  // Prioridade:
  // 1. Foreign keys explícitas (type === 'foreign_key')
  // 2. Relacionamentos com nomes de coluna mais "padrão" (id, _id)
  // 3. Primeiro encontrado

  const fkEdges = edges.filter(e => e.type === 'foreign_key');
  if (fkEdges.length > 0) {
    // Preferir colunas com "id" no nome
    const idEdges = fkEdges.filter(e => 
      e.toColumn.toLowerCase().includes('id') ||
      e.fromColumn.toLowerCase().includes('id')
    );
    return idEdges[0] || fkEdges[0];
  }

  return edges[0];
}
```

### 3. Detecção de Self-Join e Múltiplas Ocorrências

```typescript
function generateTableAlias(
  tableId: string,
  existingAliases: Map<string, string>
): string {
  // Se já existe alias, incrementar
  const baseAlias = tableId.split('.').pop()?.toLowerCase() || 't';
  let alias = baseAlias;
  let counter = 1;

  while (Array.from(existingAliases.values()).includes(alias)) {
    alias = `${baseAlias}${counter}`;
    counter++;
  }

  return alias;
}
```

### 4. Validação de AST

```typescript
interface ValidationError {
  type: 'missing_table' | 'duplicate_column' | 'invalid_join' | 'circular_join';
  message: string;
  field?: string;
}

function validateAST(ast: QueryAST, graph: { nodes: GraphNode[]; edges: GraphEdge[] }): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Validar tabela base existe
  const baseTableExists = graph.nodes.some(n => n.id === ast.from.table);
  if (!baseTableExists) {
    errors.push({
      type: 'missing_table',
      message: `Tabela base "${ast.from.table}" não encontrada no schema`,
      field: 'from.table'
    });
  }

  // Validar colunas SELECT referenciam tabelas existentes
  const tableIds = new Set(graph.nodes.map(n => n.id));
  ast.select.fields.forEach(field => {
    if (!tableIds.has(field.table)) {
      errors.push({
        type: 'missing_table',
        message: `Tabela "${field.table}" não encontrada`,
        field: `select.fields.${field.id}`
      });
    }
  });

  // Validar JOINs
  ast.joins.forEach(join => {
    if (!tableIds.has(join.targetTable)) {
      errors.push({
        type: 'invalid_join',
        message: `Tabela de JOIN "${join.targetTable}" não encontrada`,
        field: `joins.${join.id}`
      });
    }
  });

  // Detectar colunas duplicadas sem alias
  const columnKeys = new Map<string, string[]>();
  ast.select.fields.forEach(field => {
    const key = `${field.table}.${field.column}`;
    if (!columnKeys.has(key)) {
      columnKeys.set(key, []);
    }
    columnKeys.get(key)!.push(field.id);
  });
  
  columnKeys.forEach((fieldIds, key) => {
    if (fieldIds.length > 1) {
      const fields = ast.select.fields.filter(f => fieldIds.includes(f.id));
      const hasAliases = fields.some(f => f.alias);
      if (!hasAliases) {
        errors.push({
          type: 'duplicate_column',
          message: `Coluna "${key}" aparece múltiplas vezes sem alias`,
          field: key
        });
      }
    }
  });

  return errors;
}
```

---

## 🧩 Componentes React

### 1. TableExplorer (Catálogo de Tabelas)

```typescript
interface TableExplorerProps {
  nodes: GraphNode[];
  expandedTables: Set<string>;
  onToggleExpand: (tableId: string) => void;
  onDragStart: (tableId: string, column: Column) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

// Funcionalidades:
// - Árvore expansível de tabelas
// - Busca por nome
// - Drag and drop de colunas
// - Indicadores visuais (PK, FK)
```

### 2. SelectList (Lista de Colunas SELECT)

```typescript
interface SelectListProps {
  fields: SelectField[];
  onReorder: (fields: SelectField[]) => void;
  onRemove: (fieldId: string) => void;
  onEditAlias: (fieldId: string, alias: string) => void;
  onDrop: (tableId: string, column: string) => void;
}

// Funcionalidades:
// - Lista ordenável (drag and drop)
// - Edição inline de alias
// - Remoção de colunas
// - Preview de nome completo (tabela.coluna AS alias)
```

### 3. JoinEditor (Editor de JOINs)

```typescript
interface JoinEditorProps {
  joins: JoinClause[];
  onEdit: (joinId: string, updates: Partial<JoinClause>) => void;
  onRemove: (joinId: string) => void;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
}

// Funcionalidades:
// - Lista de JOINs criados
// - Edição de tipo (INNER/LEFT/RIGHT/FULL)
// - Edição de condição ON
// - Visualização do caminho no grafo
// - Remoção de JOIN
```

### 4. JoinPathSelector (Modal de Seleção de Caminho)

```typescript
interface JoinPathSelectorProps {
  isOpen: boolean;
  paths: PathResult[];
  fromTable: string;
  toTable: string;
  onSelect: (path: PathResult, edge: GraphEdge) => void;
  onCancel: () => void;
}

// Funcionalidades:
// - Exibir múltiplos caminhos
// - Visualização do caminho no grafo
// - Seleção de relacionamento preferencial
// - Informações de cada caminho (distância, arestas)
```

### 5. SQLPreview (Preview do SQL)

```typescript
interface SQLPreviewProps {
  sql: string;
  ast: QueryAST;
  onCopy: () => void;
  onSave: () => void;
  onLoad: (ast: QueryAST) => void;
}

// Funcionalidades:
// - Exibição formatada do SQL
// - Syntax highlighting (opcional)
// - Copiar SQL
// - Salvar/carregar AST (JSON)
```

---

## 🎨 Biblioteca de Drag and Drop

### Recomendação: @dnd-kit/core

**Por quê?**
- ✅ Moderna e performática
- ✅ Acessibilidade (ARIA)
- ✅ Suporte a touch (mobile)
- ✅ Customizável
- ✅ TypeScript nativo
- ✅ Melhor que react-beautiful-dnd (mantida, mas não recomendada)

### Instalação

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Estrutura de Uso

```typescript
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

// No componente:
const sensors = useSensors(
  useSensor(PointerSensor),
  useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  })
);

function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  
  if (over && active.id !== over.id) {
    // Reordenar ou adicionar coluna
  }
}

<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  {/* Componentes arrastáveis */}
</DndContext>
```

---

## 📅 Plano de Implementação

### Fase 1: MVP (Semana 1-2)

**Objetivos**: Funcionalidade básica de montagem de SELECT

- [ ] **Tarefa 1.1**: Criar tipos TypeScript (`types/query-builder.ts`)
  - QueryAST, FromClause, SelectClause, JoinClause
  - Estimativa: 2h

- [ ] **Tarefa 1.2**: Implementar algoritmo de busca de caminho (`utils/graph-path-finder.ts`)
  - BFS básico
  - Estimativa: 4h

- [ ] **Tarefa 1.3**: Criar hook `useQueryBuilder` (`hooks/useQueryBuilder.ts`)
  - Estado do AST
  - Ações: addField, removeField, setBaseTable, addJoin
  - Estimativa: 6h

- [ ] **Tarefa 1.4**: Criar componente `TableExplorer` (`components/TableExplorer.tsx`)
  - Lista de tabelas expansível
  - Busca
  - Estimativa: 4h

- [ ] **Tarefa 1.5**: Criar componente `SelectList` (`components/SelectList.tsx`)
  - Lista de colunas
  - Remoção
  - Estimativa: 4h

- [ ] **Tarefa 1.6**: Integrar @dnd-kit
  - Drag de colunas para SelectList
  - Estimativa: 6h

- [ ] **Tarefa 1.7**: Criar função de geração de SQL (`utils/sql-generator.ts`)
  - SELECT básico (sem JOINs ainda)
  - Estimativa: 4h

- [ ] **Tarefa 1.8**: Criar página `QueryBuilder` (`pages/QueryBuilder.tsx`)
  - Layout básico (3 áreas)
  - Integração de componentes
  - Estimativa: 6h

**Total MVP**: ~36h

### Fase 2: JOINs Automáticos (Semana 3)

- [ ] **Tarefa 2.1**: Implementar detecção automática de JOIN
  - Ao adicionar coluna de outra tabela, detectar relacionamento
  - Estimativa: 6h

- [ ] **Tarefa 2.2**: Criar componente `JoinPathSelector`
  - Modal para múltiplos caminhos
  - Estimativa: 6h

- [ ] **Tarefa 2.3**: Atualizar gerador de SQL para incluir JOINs
  - Estimativa: 4h

- [ ] **Tarefa 2.4**: Criar componente `JoinEditor`
  - Lista de JOINs
  - Edição de tipo e condição
  - Estimativa: 6h

**Total Fase 2**: ~22h

### Fase 3: Refinamentos (Semana 4)

- [ ] **Tarefa 3.1**: Validação de AST
  - Detectar erros
  - Exibir mensagens
  - Estimativa: 4h

- [ ] **Tarefa 3.2**: Suporte a self-join e múltiplas ocorrências
  - Geração de aliases automáticos
  - Estimativa: 4h

- [ ] **Tarefa 3.3**: Reordenação de colunas (drag and drop)
  - Estimativa: 4h

- [ ] **Tarefa 3.4**: Persistência (salvar/carregar AST)
  - LocalStorage ou backend
  - Estimativa: 4h

- [ ] **Tarefa 3.5**: Melhorias de UX
  - Feedback visual
  - Loading states
  - Estimativa: 6h

**Total Fase 3**: ~22h

### Fase 4: Expansões Futuras (Opcional)

- [ ] WHERE clause (filtros)
- [ ] GROUP BY / HAVING
- [ ] ORDER BY
- [ ] LIMIT / OFFSET
- [ ] Agregações (COUNT, SUM, etc.)
- [ ] Subqueries
- [ ] UNION

---

## ✅ Critérios de Aceite

### Caso 1: Relacionamento Simples (A → B)

**Setup**:
- Tabela base: `Users`
- Adicionar coluna de `Profile`

**Resultado Esperado**:
- ✅ JOIN automático criado (LEFT JOIN Profile ON Users.profile_id = Profile.id)
- ✅ SQL gerado corretamente
- ✅ Coluna aparece na lista SELECT

**Teste Manual**:
1. Selecionar `Users` como base
2. Expandir `Profile` no catálogo
3. Arrastar coluna `bio` de `Profile` para SELECT
4. Verificar JOIN criado automaticamente
5. Verificar SQL gerado

### Caso 2: Múltiplos Relacionamentos

**Setup**:
- Tabela base: `Users`
- `Users` tem 2 FKs para `Profile` (profile_id, backup_profile_id)

**Resultado Esperado**:
- ✅ Modal `JoinPathSelector` abre
- ✅ Mostra 2 opções de relacionamento
- ✅ Usuário escolhe qual usar
- ✅ JOIN criado com relacionamento escolhido

**Teste Manual**:
1. Selecionar `Users` como base
2. Arrastar coluna de `Profile`
3. Verificar modal com 2 opções
4. Escolher uma opção
5. Verificar JOIN correto

### Caso 3: Caminho com 2 Hops (A → B → C)

**Setup**:
- Tabela base: `Users`
- `Users` → `Profile` → `Address`
- Adicionar coluna de `Address`

**Resultado Esperado**:
- ✅ Caminho encontrado: `Users` → `Profile` → `Address`
- ✅ 2 JOINs criados automaticamente
- ✅ SQL com ambos os JOINs

**Teste Manual**:
1. Selecionar `Users` como base
2. Arrastar coluna de `Address`
3. Verificar 2 JOINs criados
4. Verificar SQL correto

### Caso 4: Ausência de Relacionamento

**Setup**:
- Tabela base: `Users`
- Adicionar coluna de `Products` (sem relacionamento)

**Resultado Esperado**:
- ✅ Alerta: "Nenhum relacionamento encontrado"
- ✅ Opção de criar JOIN manual
- ✅ Modal para definir condição ON manualmente

**Teste Manual**:
1. Selecionar `Users` como base
2. Arrastar coluna de `Products`
3. Verificar alerta
4. Criar JOIN manual
5. Verificar SQL com JOIN manual

### Caso 5: Self-Join

**Setup**:
- Tabela base: `Users`
- Adicionar coluna de `Users` novamente (manager_id → id)

**Resultado Esperado**:
- ✅ Alias automático gerado (`Users u1`, `Users u2`)
- ✅ JOIN criado corretamente
- ✅ Colunas diferenciadas por alias

**Teste Manual**:
1. Selecionar `Users` como base
2. Arrastar coluna de `Users` novamente
3. Verificar aliases diferentes
4. Verificar JOIN correto

### Caso 6: Remover Coluna e Atualizar JOINs

**Setup**:
- Query com `Users` → `Profile` → `Address`
- Remover coluna de `Address`

**Resultado Esperado**:
- ✅ JOIN para `Address` removido automaticamente
- ✅ Se `Profile` não tiver outras colunas, JOIN também removido
- ✅ SQL atualizado

**Teste Manual**:
1. Criar query com 2 JOINs
2. Remover coluna da última tabela
3. Verificar JOIN removido
4. Remover todas as colunas de tabela intermediária
5. Verificar JOIN intermediário removido

---

## 💻 Código de Exemplo

Ver arquivos:
- `frontend/src/types/query-builder.ts` - Tipos TypeScript
- `frontend/src/utils/graph-path-finder.ts` - Algoritmo BFS
- `frontend/src/utils/sql-generator.ts` - Geração de SQL
- `frontend/src/hooks/useQueryBuilder.ts` - Hook principal
- `frontend/src/components/query-builder/TableExplorer.tsx` - Componente de catálogo
- `frontend/src/components/query-builder/SelectList.tsx` - Lista SELECT
- `frontend/src/pages/QueryBuilder.tsx` - Página principal

---

## 📝 Notas Técnicas

### Escaping de Identificadores

**MySQL**:
```sql
`schema`.`table`.`column`
```

**SQL Server**:
```sql
[schema].[table].[column]
```

**Estratégia**:
- Detectar tipo de banco via `connId`
- Aplicar escaping conforme dialeto
- Função: `escapeIdentifier(dialect, identifier)`

### Performance

- **Lazy loading de colunas**: Carregar colunas apenas quando tabela expandida
- **Virtualização**: Para schemas grandes (>100 tabelas), usar `react-window`
- **Memoização**: `useMemo` para cálculos pesados (caminhos, SQL)
- **Debounce**: Busca de tabelas com debounce

### Acessibilidade

- **ARIA labels**: Todos os elementos arrastáveis
- **Keyboard navigation**: Suporte completo via @dnd-kit
- **Screen readers**: Descrições claras de ações

---

**Última atualização**: Dezembro 2024
**Versão**: 1.0.0

