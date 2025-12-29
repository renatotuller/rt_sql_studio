# Checkpoint v1.5.0 - Melhorias em JOINs Manuais com VIEWs

**Data**: Dezembro 2024  
**Versão**: 1.5.0

## 📋 Resumo das Alterações

Esta versão foca em melhorias significativas no sistema de JOINs manuais, especialmente para VIEWs, com correções importantes de alias e adição automática de colunas.

## ✨ Novas Funcionalidades

### 1. Correção de Alias na Criação de JOIN Manual
- **Problema corrigido**: Sistema agora usa o alias correto da tabela selecionada como origem, não a última tabela na query
- **Impacto**: Resolve erros SQL como "Invalid column name" quando múltiplas tabelas estão na query
- **Arquivos modificados**:
  - `frontend/src/hooks/useQueryBuilder.ts` - Função `addManualJoin`

### 2. Adição Automática de Coluna após Criar JOIN
- **Funcionalidade**: Ao arrastar coluna de VIEW e criar JOIN, a coluna é automaticamente adicionada ao SELECT
- **Implementação**: Callback `onJoinCreated` notifica quando JOIN é criado
- **Arquivos modificados**:
  - `frontend/src/hooks/useQueryBuilder.ts` - Adicionado callback `onJoinCreated`
  - `frontend/src/pages/QueryBuilder.tsx` - Implementado callback com `useRef` para evitar problemas de closure

### 3. Múltiplas Condições AND em JOINs
- **Funcionalidade**: Suporte a múltiplas condições ON conectadas com AND em um único JOIN
- **Interface**: Editor de JOIN permite adicionar/remover condições dinamicamente
- **Consolidação**: JOINs para a mesma tabela são automaticamente consolidados
- **Arquivos modificados**:
  - `frontend/src/components/query-builder/ManualJoinCreator.tsx`
  - `frontend/src/utils/query-builder/sql-generator.ts` - Função `consolidateJoins`

### 4. Edição de JOINs Existentes
- **Funcionalidade**: Clique em "Editar" abre a mesma interface de criação com dados preenchidos
- **Arquivos modificados**:
  - `frontend/src/components/query-builder/JoinEditor.tsx`
  - `frontend/src/components/query-builder/ManualJoinCreator.tsx` - Prop `editingJoin`

## 🔧 Correções Técnicas

### Problema de Closure no Callback
- **Solução**: Uso de `useRef` para armazenar `pendingViewColumn` e `addColumn`
- **Motivo**: Callback precisa acessar valores atualizados mesmo quando criado antes

### Determinação Correta de SourceAlias
- **Antes**: Sempre usava alias da última tabela na query
- **Depois**: Busca alias correto baseado na tabela selecionada pelo usuário
- **Lógica**:
  1. Se `sourceTableId` é a tabela base → usa `ast.from.alias`
  2. Se não → busca JOIN onde `targetTableId === sourceTableId` → usa `targetAlias`
  3. Fallback: última tabela (comportamento antigo)

## 📝 Documentação Atualizada

### specs.md
- Adicionada seção "Correções e Melhorias Recentes (v1.5.0)"
- Documentadas todas as novas funcionalidades
- Atualizada lista de casos de uso suportados

### Wiki.tsx
- Adicionada seção "JOINs Manuais com VIEWs"
- Adicionada seção "Múltiplas Condições AND"
- Adicionada seção "Edição de JOINs"
- Atualizada seção de dicas e truques

## 🧪 Testes Recomendados

1. **Teste de Alias Correto**:
   - Criar query com múltiplas tabelas
   - Criar JOIN manual selecionando tabela intermediária como origem
   - Verificar que SQL gerado usa alias correto

2. **Teste de Adição Automática**:
   - Arrastar coluna de VIEW
   - Criar JOIN manual
   - Verificar que coluna aparece automaticamente no SELECT

3. **Teste de Múltiplas Condições**:
   - Criar JOIN manual com múltiplas condições AND
   - Verificar que SQL gerado consolida em um único JOIN

4. **Teste de Edição**:
   - Criar JOIN manual
   - Clicar em "Editar"
   - Modificar condições
   - Verificar que mudanças refletem no SQL

## 📦 Arquivos Modificados

### Frontend
- `frontend/src/hooks/useQueryBuilder.ts`
- `frontend/src/pages/QueryBuilder.tsx`
- `frontend/src/components/query-builder/JoinEditor.tsx`
- `frontend/src/components/query-builder/ManualJoinCreator.tsx`
- `frontend/src/utils/query-builder/sql-generator.ts`
- `frontend/src/pages/Wiki.tsx`

### Documentação
- `specs.md`

## 🚀 Próximos Passos Sugeridos

1. Adicionar testes unitários para `addManualJoin`
2. Melhorar validação de colunas com sugestões automáticas
3. Adicionar preview em tempo real do SQL durante criação de JOIN
4. Suporte a JOINs com subqueries

## ✅ Checklist de Validação

- [x] Correção de alias implementada e testada
- [x] Adição automática de coluna funcionando
- [x] Múltiplas condições AND suportadas
- [x] Edição de JOINs implementada
- [x] Documentação atualizada
- [x] Checkpoint criado

---

**Nota**: Este checkpoint marca uma melhoria significativa na usabilidade do Query Builder, especialmente para trabalhar com VIEWs que requerem JOINs manuais.






