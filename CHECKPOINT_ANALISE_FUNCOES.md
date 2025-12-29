# Checkpoint - Análise de Funções SQL em VIEWs

## Data: 2024-12-19

## Estado Atual do Sistema

### Funcionalidades Implementadas
1. ✅ Extração de relacionamentos de VIEWs baseada em JOINs explícitos
2. ✅ Mapeamento de colunas do SELECT da VIEW para colunas das tabelas base
3. ✅ Criação de JOINs manuais
4. ✅ Validação de edges antes de criar JOINs
5. ✅ Remoção de duplicatas na lista de tabelas de origem

### Problema Identificado
- VIEWs usam funções SQL que podem referenciar outras tabelas
- Exemplo: `dbo.fnNomeProduto(dbo.tbProduto.cdProduto, dbo.tbProduto.cdEmpresa)`
- Essas funções podem indicar relacionamentos que não são explícitos em JOINs

## Objetivo da Implementação

### Meta
Extrair relacionamentos adicionais analisando parâmetros de funções SQL dentro das definições de VIEWs.

### Abordagem
1. **Análise de Parâmetros de Funções:**
   - Identificar padrões: `schema.funcao(tabela.coluna, ...)`
   - Extrair tabelas referenciadas nos parâmetros
   - Criar relacionamentos baseados nesses parâmetros

2. **Priorização:**
   - Relacionamentos explícitos (JOINs) têm prioridade
   - Relacionamentos inferidos de funções são complementares
   - Marcar relacionamentos inferidos para diferenciação

3. **Limitações Conhecidas:**
   - Não analisamos definições de funções recursivamente (por enquanto)
   - Relacionamentos inferidos podem ser menos precisos
   - Performance pode ser afetada em VIEWs muito complexas

## Estrutura de Implementação

### Backend (`graph-builder.ts`)
- Nova função: `extractFunctionBasedRelationships`
- Analisa parâmetros de funções no SELECT e WHERE
- Cria edges adicionais baseados em parâmetros de funções

### Exemplo de VIEW Analisada
```sql
SELECT 
  dbo.fnNomeProduto(dbo.tbProduto.cdProduto, dbo.tbProduto.cdEmpresa) AS nome,
  dbo.fnPessoaCNPJCPF(Fornecedor.cdPessoaComercial, 0) AS cnpj
FROM ...
```

### Relacionamentos a Extrair
- `fnNomeProduto` recebe `tbProduto.cdProduto` e `tbProduto.cdEmpresa` → relacionamento com `tbProduto`
- `fnPessoaCNPJCPF` recebe `Fornecedor.cdPessoaComercial` → relacionamento com tabela/alias `Fornecedor`

## Implementação Concluída ✅

### Funcionalidades Implementadas

1. ✅ **Função `extractFunctionBasedRelationships`**:
   - Analisa funções SQL no SELECT da VIEW
   - Extrai parâmetros que são referências a tabelas (formato: `tabela.coluna`)
   - Identifica tabelas referenciadas usando aliases e nomes de tabelas
   - Cria edges baseados em parâmetros de funções

2. ✅ **Prevenção de Duplicatas**:
   - Verifica se relacionamento já existe via JOIN explícito
   - Evita criar relacionamentos duplicados
   - Prioriza JOINs explícitos sobre relacionamentos de funções

3. ✅ **Logs de Debug**:
   - Log quando função é analisada
   - Log quando edge é criado via função
   - Log quando relacionamento é ignorado (já existe via JOIN)

### Estrutura de Edge Criado

```typescript
{
  id: 'view_function_viewId_to_tableId_viewCol_tableCol',
  from: 'viewId',
  to: 'tableId',
  fromColumn: 'viewColumnName',
  toColumn: 'tableColumnName',
  label: 'view_function'
}
```

## Próximos Passos

1. ⏳ **Testar com VIEWs reais que usam funções**
2. ⏳ Verificar se relacionamentos extraídos são válidos
3. ⏳ Ajustar lógica de extração se necessário
4. ⏳ Considerar análise recursiva de definições de funções (futuro)

## Notas Técnicas

- Regex para identificar funções: `\w+\.\w+\s*\(`
- Regex para extrair parâmetros: `tabela\.coluna` dentro dos parâmetros
- Considerar aliases de tabelas ao mapear relacionamentos
- Validar que tabelas referenciadas existem no schema

