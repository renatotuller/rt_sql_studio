# 📖 Guia de Subselects e CTEs no Query Builder

## 🎯 Onde Criar Subselects

O sistema suporta subselects em **4 lugares diferentes**:

---

## 1️⃣ **Subselect no FROM (Derived Table)**

### 📍 Onde encontrar:
- Abra o diálogo de **JOINs** (ícone `🔗 JOIN` na barra lateral)
- Na seção da **tabela base**, há um botão **"Subselect"** ao lado

### 🔧 Como usar:
1. Clique no botão **"Subselect"** ao lado da tabela base
2. Abre o `SubqueryBuilder` (um Query Builder completo dentro de um modal)
3. Monte sua subquery normalmente (arraste colunas, crie JOINs, WHERE, etc.)
4. Defina um **alias** para o subselect (ex: `sub1`, `derived_table`)
5. Salve

### 📝 SQL Gerado:
```sql
SELECT ...
FROM (SELECT col1, col2 FROM tabela WHERE ...) AS sub1
LEFT JOIN ...
```

### ✅ Quando usar:
- Quando você precisa de uma tabela derivada complexa
- Para pré-filtrar/agregar dados antes do JOIN principal
- Para criar "views temporárias" inline

---

## 2️⃣ **Subselect no WHERE**

### 📍 Onde encontrar:
- Abra o diálogo de **WHERE** (ícone `🔍 WHERE` na barra lateral)
- Ao criar/editar uma condição, use os operadores: **`IN`**, **`NOT IN`**, **`EXISTS`**, **`NOT EXISTS`**

### 🔧 Como usar:
1. Crie uma nova condição WHERE
2. Selecione o operador: **`IN`**, **`NOT IN`**, **`EXISTS`**, ou **`NOT EXISTS`**
3. Aparece um botão **"Criar/Editar Subselect"**
4. Clique e monte o subselect no `SubqueryBuilder`
5. Salve

### 📝 SQL Gerado:
```sql
SELECT ...
FROM tabela
WHERE coluna IN (SELECT id FROM outra_tabela WHERE ...)
  AND EXISTS (SELECT 1 FROM terceira_tabela WHERE ...)
```

### ✅ Quando usar:
- **`IN` / `NOT IN`**: Quando você quer filtrar por uma lista de valores retornados por outra query
- **`EXISTS` / `NOT EXISTS`**: Quando você quer verificar se há correspondência em outra tabela (mais eficiente que JOIN em alguns casos)

---

## 3️⃣ **Subselect no SELECT** ⚠️ (Suportado no tipo, mas UI ainda não implementada)

### 📍 Status:
- ✅ O tipo TypeScript já suporta (`SelectField` com `type: 'subquery'`)
- ❌ A UI ainda não permite criar diretamente
- 🔨 **Pode ser implementado se necessário**

### 📝 Como funcionaria:
```sql
SELECT 
  coluna1,
  (SELECT COUNT(*) FROM outra_tabela WHERE ...) AS total,
  coluna2
FROM tabela
```

### 💡 Workaround atual:
Você pode criar manualmente no SQL gerado ou editar o AST diretamente.

---

## 4️⃣ **Subselect no JOIN** ⚠️ (Suportado no tipo, mas UI ainda não implementada)

### 📍 Status:
- ✅ O tipo TypeScript já suporta (`QueryJoin` com `type: 'subquery'`)
- ❌ A UI ainda não permite criar diretamente
- 🔨 **Pode ser implementado se necessário**

### 📝 Como funcionaria:
```sql
SELECT ...
FROM tabela1 t1
LEFT JOIN (SELECT id, nome FROM tabela2 WHERE ...) AS sub2
  ON t1.id = sub2.id
```

### 💡 Workaround atual:
Você pode criar manualmente no SQL gerado ou editar o AST diretamente.

---

## 🔄 **Como Funciona o SubqueryBuilder**

O `SubqueryBuilder` é um **Query Builder completo recursivo**:

- ✅ Você pode arrastar colunas de tabelas
- ✅ Criar JOINs automaticamente
- ✅ Adicionar WHERE, GROUP BY, ORDER BY
- ✅ **E até criar subselects dentro de subselects!** (recursivo)

### 🎨 Interface:
- **Lado esquerdo**: Catálogo de tabelas (igual ao Query Builder principal)
- **Centro**: Área para arrastar colunas
- **Preview**: SQL do subselect sendo gerado em tempo real

---

## 📊 **CTEs (Common Table Expressions)**

### ⚠️ Status Atual:
- ✅ **Detecção**: O sistema já detecta CTEs no SQL Analyzer (`useSQLAnalysis.ts`)
- ❌ **Criação**: Ainda **não foi implementada** no Query Builder
- 🔨 **Pode ser implementada se necessário**

### 📝 Como funcionaria:
```sql
WITH 
  cte1 AS (SELECT ... FROM tabela1),
  cte2 AS (SELECT ... FROM tabela2)
SELECT ...
FROM cte1
JOIN cte2 ON ...
```

### 💡 Diferença entre CTE e Subselect:

| Característica | Subselect | CTE |
|---------------|-----------|-----|
| **Reutilização** | ❌ Não pode reutilizar | ✅ Pode usar múltiplas vezes |
| **Legibilidade** | ⚠️ Pode ficar complexo | ✅ Mais legível |
| **Performance** | ⚠️ Pode ser executado múltiplas vezes | ✅ Geralmente otimizado pelo banco |
| **Escopo** | 🔒 Apenas na query onde está | ✅ Pode ser referenciado várias vezes |

### 🎯 Quando usar CTE vs Subselect:

**Use CTE quando:**
- Você precisa reutilizar o mesmo resultado em múltiplos lugares
- A query fica mais legível com CTEs
- Você quer "quebrar" uma query complexa em partes menores

**Use Subselect quando:**
- Você só precisa do resultado uma vez
- A lógica é simples e não precisa ser reutilizada
- Você quer manter tudo inline

---

## 🚀 **Próximos Passos (Se Desejar)**

Posso implementar:

1. ✅ **Subselect no SELECT** - Botão para adicionar subselect como campo
2. ✅ **Subselect no JOIN** - Opção para usar subselect como tabela no JOIN
3. ✅ **CTEs** - Seção completa para criar e gerenciar CTEs

---

## 📝 **Exemplo Completo com Subselects**

```sql
-- Subselect no FROM
SELECT 
  sub1.nome,
  sub1.total,
  t2.descricao
FROM (
  SELECT 
    id,
    nome,
    COUNT(*) AS total
  FROM produtos
  WHERE ativo = 1
  GROUP BY id, nome
) AS sub1
LEFT JOIN categorias t2 ON sub1.categoria_id = t2.id
WHERE sub1.total > 10
  AND sub1.id IN (
    -- Subselect no WHERE
    SELECT produto_id 
    FROM vendas 
    WHERE data > '2024-01-01'
  )
  AND EXISTS (
    -- Subselect EXISTS no WHERE
    SELECT 1 
    FROM estoque 
    WHERE estoque.produto_id = sub1.id 
      AND estoque.quantidade > 0
  )
```

---

## ❓ **Dúvidas?**

Se precisar de ajuda ou quiser que eu implemente alguma funcionalidade adicional (CTEs, subselects no SELECT/JOIN), é só avisar!







