# Documentação - Análise de VIEWs e Extração de Relacionamentos

## Visão Geral

O sistema analisa definições SQL de VIEWs para extrair relacionamentos entre tabelas e views. Isso permite que o Query Builder sugira JOINs corretos mesmo quando a base da query é uma VIEW.

## Estratégias de Extração

### 1. Relacionamentos Explícitos (JOINs)

**Prioridade: ALTA**

O sistema identifica JOINs explícitos na definição SQL da VIEW:

```sql
SELECT ...
FROM tabela1 t1
INNER JOIN tabela2 t2 ON t1.col1 = t2.col2
LEFT JOIN tabela3 t3 ON t2.col3 = t3.col4
```

**Como funciona:**
- Analisa cláusulas `ON` para identificar condições de JOIN
- Mapeia colunas da VIEW para colunas das tabelas base
- Cria edges no grafo: `viewColuna → tabelaColuna`

**Vantagens:**
- Relacionamentos explícitos e confiáveis
- Baseados na estrutura real do banco

### 2. Relacionamentos Inferidos de Funções SQL

**Prioridade: MÉDIA**

O sistema analisa parâmetros de funções SQL para identificar relacionamentos:

```sql
SELECT 
  dbo.fnNomeProduto(dbo.tbProduto.cdProduto, dbo.tbProduto.cdEmpresa) AS nome,
  dbo.fnPessoaCNPJCPF(Fornecedor.cdPessoaComercial, 0) AS cnpj
FROM ...
```

**Como funciona:**
- Identifica padrões: `schema.funcao(tabela.coluna, ...)`
- Extrai tabelas referenciadas nos parâmetros
- Cria edges baseados nesses parâmetros

**Limitações:**
- Não analisa definições de funções recursivamente (por enquanto)
- Relacionamentos podem ser menos precisos que JOINs explícitos
- Funções podem ter lógica complexa não visível

**Exemplo de extração:**
- `fnNomeProduto(tbProduto.cdProduto, tbProduto.cdEmpresa)` → relacionamento com `tbProduto`
- `fnPessoaCNPJCPF(Fornecedor.cdPessoaComercial, 0)` → relacionamento com tabela/alias `Fornecedor`

### 3. Foreign Keys do Schema

**Prioridade: ALTA**

Relacionamentos definidos como Foreign Keys no banco de dados são sempre incluídos.

## Fluxo de Processamento

### Passo 1: Extração de Tabelas Referenciadas
```
VIEW Definition → Extrair tabelas de FROM/JOIN → Normalizar IDs
```

### Passo 2: Mapeamento de Colunas
```
SELECT da VIEW → Mapear colunas para tabelas base → Criar mapeamento
```

### Passo 3: Análise de JOINs
```
JOINs explícitos → Analisar condições ON → Extrair relacionamentos
```

### Passo 4: Análise de Funções (Nova)
```
Funções no SELECT → Extrair parâmetros → Identificar tabelas → Criar relacionamentos
```

### Passo 5: Criação de Edges
```
Relacionamentos → Validar colunas → Criar edges no grafo
```

## Estrutura de Dados

### Edge Criado
```typescript
{
  id: 'view_viewId_to_tableId_col1_col2',
  from: 'viewId',
  to: 'tableId',
  fromColumn: 'colunaDaView',
  toColumn: 'colunaDaTabela',
  label: 'view_join' | 'view_function'
}
```

### Mapeamento de Colunas
```typescript
Map<string, { tableId: string; columnName: string }>
// viewColumnName → { tableId, columnName }
```

## Validações

### Antes de Criar Edge
1. ✅ Tabela de origem existe no schema
2. ✅ Tabela de destino existe no schema
3. ✅ Coluna da VIEW existe
4. ✅ Coluna da tabela existe
5. ✅ Case-sensitive check das colunas

### Logs de Debug
- `[GraphBuilder] ✅ Edge criado` - Edge criado com sucesso
- `[GraphBuilder] ⚠️ Coluna não encontrada` - Coluna não existe
- `[GraphBuilder] 🔍 Função analisada` - Função processada

## Exemplo Completo

### VIEW de Entrada
```sql
CREATE VIEW VW_2D_CADASTRO_PRODUTO AS
SELECT 
  dbo.tbProduto.cdEmpresa,
  dbo.fnNomeProduto(dbo.tbProduto.cdProduto, dbo.tbProduto.cdEmpresa) AS nome,
  dbo.tbSuperProduto.cdClassificacaoProduto AS categoria
FROM dbo.tbProduto
INNER JOIN dbo.tbSuperProduto 
  ON dbo.tbProduto.cdSuperProduto = dbo.tbSuperProduto.cdSuperProduto
```

### Relacionamentos Extraídos

**De JOINs Explícitos:**
- `VW_2D_CADASTRO_PRODUTO` → `tbSuperProduto` (via `cdSuperProduto`)

**De Funções:**
- `VW_2D_CADASTRO_PRODUTO` → `tbProduto` (via parâmetros de `fnNomeProduto`)

**Resultado:**
- Edge 1: `view_VW_2D_CADASTRO_PRODUTO_to_tbSuperProduto_cdSuperProduto_cdSuperProduto` (JOIN)
- Edge 2: `view_VW_2D_CADASTRO_PRODUTO_to_tbProduto_cdProduto_cdProduto` (função)

## Melhorias Futuras

1. **Análise Recursiva de Funções:**
   - Acessar definições de funções do banco
   - Analisar JOINs dentro de funções
   - Criar relacionamentos indiretos

2. **Análise de Subconsultas:**
   - Identificar subconsultas no SELECT
   - Extrair relacionamentos de subconsultas

3. **Cache de Análises:**
   - Cachear resultados de análise de VIEWs
   - Invalidar cache quando VIEW é alterada

4. **Métricas de Confiança:**
   - Marcar relacionamentos com nível de confiança
   - JOINs explícitos: 100%
   - Funções: 70-80%
   - Heurísticas: 50-60%

## Troubleshooting

### Problema: Relacionamentos não aparecem
- Verificar se VIEW tem definição SQL disponível
- Verificar logs `[GraphBuilder]` no console
- Verificar se colunas existem nas tabelas

### Problema: Relacionamentos incorretos
- Verificar se JOINs estão corretos na VIEW
- Verificar se aliases estão sendo mapeados corretamente
- Verificar se funções estão sendo analisadas corretamente

### Problema: Performance lenta
- VIEWs muito complexas podem demorar
- Considerar cache de análises
- Limitar profundidade de análise recursiva






