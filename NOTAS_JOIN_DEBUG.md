# Notas - Debug de JOINs Incorretos

## Problema Reportado

O usuário está recebendo JOINs incorretos no Query Builder. Especificamente:

1. **Erro SQL**: `Invalid column name 'cdEmpresaProduto'`
2. **Problema**: Relacionamentos sendo exibidos incorretamente no modal de seleção de JOINs
3. **Sintoma**: Todos os relacionamentos mostram a mesma coluna de origem (`cdEmpresa`) mesmo quando outros relacionamentos deveriam existir

## Mudanças Implementadas

### Backend (`backend/src/utils/graph-builder.ts`)

1. **Removida função heurística** `findColumnBasedRelationships`:
   - Esta função criava relacionamentos baseados em correspondência de nomes de colunas
   - Agora o sistema usa APENAS relacionamentos reais do schema:
     - Foreign Keys (FKs) reais do banco
     - JOINs explícitos extraídos das definições SQL das views

2. **Melhorada função `extractJoinRelationshipsFromView`**:
   - Melhor lógica para determinar qual coluna pertence à view e qual pertence à tabela
   - Usa aliases/tabelas mencionados na cláusula ON para identificar corretamente as colunas

3. **Comentários adicionados**:
   - Documentação clara de que não devemos usar heurísticas
   - Apenas relacionamentos reais do schema devem ser usados

### Frontend (`frontend/src/hooks/useQueryBuilder.ts`)

1. **Validação de colunas antes de criar JOINs**:
   - Adicionada validação para verificar se as colunas existem nas tabelas antes de criar JOINs
   - Logs de debug detalhados quando uma coluna não é encontrada
   - JOINs inválidos são ignorados (usando `return` em `forEach`)

2. **Logs de debug**:
   - `✅ [Join Debug] JOIN X criado:` - quando um JOIN válido é criado
   - `⚠️ [Join Debug] Coluna não encontrada no JOIN X:` - quando uma coluna não existe
   - Mostra todas as colunas disponíveis nas tabelas para facilitar debug

3. **Correção de variáveis**:
   - Uso correto de `sourceColumn` e `targetColumn` em vez de referenciar diretamente `firstEdge.fromColumn/toColumn`

## Estado Atual

### O que está funcionando:
- ✅ Validação de colunas antes de criar JOINs
- ✅ Logs de debug detalhados
- ✅ Backend não usa mais heurísticas (apenas relacionamentos reais)

### O que precisa ser testado/verificado:
- ⚠️ **Atualizar o cache do schema** - O usuário precisa clicar em "Atualizar Schema" para recriar o cache com apenas relacionamentos reais
- ⚠️ **Verificar se os relacionamentos do backend estão corretos** - Os logs mostrarão se as colunas existem ou não
- ⚠️ **Verificar normalização de colunas** - Se ainda houver problemas, pode ser na forma como normalizamos as colunas dos edges

## Melhorias Implementadas (Sessão Atual)

### Backend (`backend/src/utils/graph-builder.ts`)

1. **Análise melhorada de VIEWs**:
   - Extração robusta de aliases de tabelas
   - Mapeamento de colunas do SELECT da VIEW para colunas das tabelas base
   - Análise detalhada de JOINs explícitos com validação de colunas
   - Logs de debug detalhados para troubleshooting

2. **Análise de Funções SQL (Nova Funcionalidade)**:
   - Extração de relacionamentos baseados em parâmetros de funções
   - Identificação de padrões: `schema.funcao(tabela.coluna, ...)`
   - Criação de edges adicionais baseados em funções
   - Priorização: JOINs explícitos > Relacionamentos de funções

3. **Validação melhorada**:
   - Verificação case-sensitive das colunas antes de criar edges
   - Validação que as colunas realmente existem nas tabelas/views
   - Validação de parâmetros de funções

### Frontend (`frontend/src/hooks/useQueryBuilder.ts`)

1. **Nova função `validateEdge`**:
   - Valida se um edge tem colunas válidas antes de ser usado
   - Verifica se as tabelas existem nos nodes
   - Verifica se as colunas existem nas tabelas correspondentes
   - Retorna `false` se o edge for inválido

2. **Filtragem de edges inválidos**:
   - `validDirectEdges` filtra apenas edges válidos antes de processar
   - Logs mostram quantos edges foram encontrados vs quantos são válidos
   - Remoção de duplicatas usando `edge.id` ao invés de chave baseada em colunas

3. **Validação em múltiplos pontos**:
   - Validação antes de criar JOIN direto (único relacionamento)
   - Validação antes de criar múltiplos JOINs (em `selectJoinPath`)
   - Logs detalhados em cada ponto de validação

4. **Criação de JOINs Manuais**:
   - Botão "Adicionar JOIN" disponível mesmo quando não há JOINs
   - Lista de tabelas de origem sem duplicatas
   - Validação de colunas antes de criar JOIN manual

## Próximos Passos

1. **Testar após atualizar o schema**:
   - Pedir ao usuário para clicar em "Atualizar Schema" para recriar o cache
   - Testar criação de JOINs novamente
   - Verificar logs no console do navegador (F12)
   - Procurar por:
     - `[GraphBuilder]` - logs do backend (no terminal do servidor)
     - `[Join Debug]` - logs do frontend (no console do navegador)
     - `[Edge Validation]` - logs de validação de edges

2. **Se o problema persistir**:
   - Verificar os logs de debug no console
   - Verificar se as colunas listadas nos logs realmente existem nas tabelas
   - Verificar se o backend está retornando relacionamentos corretos
   - Verificar se há edges inválidos sendo filtrados

3. **Possíveis causas restantes**:
   - Problema na extração de JOINs das views (função `extractJoinRelationshipsFromView`)
   - Cache antigo ainda sendo usado (precisa atualizar schema)
   - Views com definições SQL complexas que não são parseadas corretamente

## Arquivos Modificados

1. `backend/src/utils/graph-builder.ts`
   - Removida chamada para `findColumnBasedRelationships`
   - Melhorada `extractJoinRelationshipsFromView`

2. `frontend/src/hooks/useQueryBuilder.ts`
   - Adicionada validação de colunas em `selectJoinPath`
   - Adicionados logs de debug
   - Correção de uso de variáveis

## Comandos Úteis

Para verificar o cache do schema:
- O cache está em `backend/storage/schema-cache/`
- Pode ser necessário deletar o cache e recriar

Para debugar:
- Abrir console do navegador (F12)
- Procurar por logs `[Join Debug]`
- Verificar se as colunas listadas existem nas tabelas


