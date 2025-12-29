# Problema: Query Builder - Tela em Branco

## Data: Dezembro 2024

## Descrição do Problema
Após a implementação de subselects e CTEs, o Query Builder está exibindo uma tela completamente em branco, sem erros no console do navegador.

## Contexto
- O problema começou após a inclusão completa de subselects e CTEs no sistema
- A página não renderiza nada, nem mostra erros no console
- URL: `http://localhost:3000/schema/{connId}/query-builder`

## Mudanças Implementadas Recentemente

### 1. Inicialização do AST
- **Antes**: `ast` era inicializado como `null`
- **Depois**: `ast` é inicializado como um objeto vazio `QueryAST`:
  ```typescript
  const [ast, setAST] = useState<QueryAST>({
    from: {
      alias: '',
    },
    select: [],
    joins: [],
  });
  ```

### 2. Import de Tipos
- Adicionado import de `Column` em `QueryBuilder.tsx`
- Adicionado import de `CTEDefinition` em `useQueryBuilder.ts`

### 3. Verificações de `ast`
- Removidas verificações `if (!ast)` que não são mais necessárias
- Ajustadas verificações para usar `ast.select`, `ast.joins`, `ast.from` diretamente
- Adicionadas verificações de segurança para arrays (`Array.isArray()`)

### 4. SelectList e Subselects
- Adicionado `onUpdateIncludeInSelect` no primeiro `SelectList` (estava faltando)
- Adicionadas verificações de segurança no `SortableContext` para lidar com subselects
- Verificações de tipo para garantir que `ast.select` seja um array válido

### 5. Verificações no Hook `useQueryBuilder`
- Ajustado `sql` useMemo para verificar `ast.from` e `ast.select` corretamente
- Removida verificação desnecessária `if (!ast)` no `exportAST`

## Arquivos Modificados

### `frontend/src/hooks/useQueryBuilder.ts`
- Inicialização do `ast` mudou de `null` para objeto vazio
- Adicionado estado `ctes` para gerenciar CTEs
- Ajustadas verificações de `ast` em várias funções
- Adicionado import de `CTEDefinition`

### `frontend/src/pages/QueryBuilder.tsx`
- Adicionado import de `Column`
- Ajustadas verificações de `ast` em `useMemo` hooks
- Adicionado `onUpdateIncludeInSelect` no primeiro `SelectList`
- Adicionadas verificações de segurança no `SortableContext` para subselects
- Removida verificação `if (!ast) return;` no `handleDragEnd`

### `frontend/src/components/query-builder/SelectList.tsx`
- Componente já estava preparado para lidar com subselects
- Renderiza subselects de forma diferente dos campos normais

## Possíveis Causas do Problema

1. **Erro Silencioso no Hook**: O `useQueryBuilder` pode estar lançando um erro que não está sendo capturado
2. **Problema com Subselects/CTEs**: A inicialização do AST pode não estar compatível com a estrutura esperada pelos componentes
3. **Problema de Renderização**: Algum componente pode estar retornando `null` ou `undefined` silenciosamente
4. **Problema de Dependências**: Alguma dependência do hook pode estar causando um loop infinito ou erro

## Próximos Passos Sugeridos

1. **Adicionar Error Boundary**: Criar um componente Error Boundary para capturar erros de renderização
2. **Adicionar Logs de Debug**: Adicionar `console.log` estratégicos para identificar onde o componente está falhando
3. **Verificar Renderização Condicional**: Verificar se há alguma condição que está impedindo a renderização
4. **Testar sem Subselects/CTEs**: Temporariamente desabilitar a funcionalidade de subselects/CTEs para verificar se o problema está relacionado
5. **Verificar Console do Navegador**: Insistir para o usuário verificar o console do navegador (F12) para erros que podem não estar visíveis
6. **Verificar Network Tab**: Verificar se as requisições à API estão sendo feitas corretamente

## Código Relevante

### Inicialização do AST
```typescript
const [ast, setAST] = useState<QueryAST>({
  from: {
    alias: '',
  },
  select: [],
  joins: [],
});
```

### Verificação no SortableContext
```typescript
{ast.select && Array.isArray(ast.select) && ast.select.length > 0 ? (
  <SortableContext
    items={ast.select.map(f => {
      if (typeof f === 'object' && f !== null && 'id' in f) {
        return f.id;
      }
      return '';
    }).filter(id => id !== '')}
    strategy={verticalListSortingStrategy}
  >
```

### Estrutura de Subselects no Select
```typescript
select: Array<SelectField | {
  type: 'subquery';
  id: string;
  subquery: QueryAST;
  alias: string;
  order: number;
}>;
```

## Notas Adicionais

- O problema não mostra erros no console, o que sugere que pode ser um problema de renderização condicional ou um erro silencioso
- A tela está completamente em branco, não apenas sem conteúdo
- O problema começou especificamente após a implementação de subselects e CTEs
- Todas as verificações de tipo foram ajustadas, mas o problema persiste

## Status
🔴 **PROBLEMA NÃO RESOLVIDO** - Requer investigação mais profunda






