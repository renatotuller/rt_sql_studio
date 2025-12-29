# 🧪 Teste de Importação/Exportação do Query Builder

## ✅ Correções Implementadas

### 1. **SubqueryBuilder agora usa `importAST` corretamente**
   - ✅ Antes: Tentava inicializar manualmente, perdendo subselects, WHERE, etc.
   - ✅ Agora: Usa `importAST` para carregar o AST completo

### 2. **Validação melhorada na importação**
   - ✅ Valida estrutura básica do AST
   - ✅ Valida subselects recursivos (até 10 níveis de profundidade)
   - ✅ Detecta referências circulares
   - ✅ Valida subselects em: FROM, SELECT, JOIN, WHERE

### 3. **Tratamento de erros melhorado**
   - ✅ Mensagens de erro mais descritivas
   - ✅ Validação de arquivo vazio
   - ✅ Tratamento de erros de leitura de arquivo

## 📋 Casos de Teste

### Teste 1: Exportação/Importação Básica
```json
{
  "from": {
    "tableId": "dbo.tabela1",
    "alias": "t1"
  },
  "select": [
    {
      "id": "field-1",
      "tableId": "dbo.tabela1",
      "column": "coluna1",
      "order": 0
    }
  ],
  "joins": []
}
```

**Resultado esperado**: ✅ Deve exportar e importar corretamente

---

### Teste 2: Exportação/Importação com Subselect no FROM
```json
{
  "from": {
    "subquery": {
      "from": {
        "tableId": "dbo.tabela2",
        "alias": "t2"
      },
      "select": [
        {
          "id": "field-1",
          "tableId": "dbo.tabela2",
          "column": "coluna1",
          "order": 0
        }
      ],
      "joins": []
    },
    "alias": "sub1"
  },
  "select": [
    {
      "id": "field-1",
      "tableId": "sub1",
      "column": "coluna1",
      "order": 0
    }
  ],
  "joins": []
}
```

**Resultado esperado**: ✅ Deve exportar e importar corretamente, preservando o subselect

---

### Teste 3: Exportação/Importação com Subselect no WHERE
```json
{
  "from": {
    "tableId": "dbo.tabela1",
    "alias": "t1"
  },
  "select": [
    {
      "id": "field-1",
      "tableId": "dbo.tabela1",
      "column": "coluna1",
      "order": 0
    }
  ],
  "joins": [],
  "where": [
    {
      "id": "where-1",
      "tableId": "dbo.tabela1",
      "column": "id",
      "operator": "IN",
      "subquery": {
        "from": {
          "tableId": "dbo.tabela2",
          "alias": "t2"
        },
        "select": [
          {
            "id": "field-1",
            "tableId": "dbo.tabela2",
            "column": "id",
            "order": 0
          }
        ],
        "joins": []
      },
      "logicalOperator": "AND",
      "order": 0
    }
  ]
}
```

**Resultado esperado**: ✅ Deve exportar e importar corretamente, preservando o subselect no WHERE

---

### Teste 4: Exportação/Importação com Subselect Recursivo (2 níveis)
```json
{
  "from": {
    "subquery": {
      "from": {
        "subquery": {
          "from": {
            "tableId": "dbo.tabela3",
            "alias": "t3"
          },
          "select": [
            {
              "id": "field-1",
              "tableId": "dbo.tabela3",
              "column": "coluna1",
              "order": 0
            }
          ],
          "joins": []
        },
        "alias": "sub2"
      },
      "select": [
        {
          "id": "field-1",
          "tableId": "sub2",
          "column": "coluna1",
          "order": 0
        }
      ],
      "joins": []
    },
    "alias": "sub1"
  },
  "select": [
    {
      "id": "field-1",
      "tableId": "sub1",
      "column": "coluna1",
      "order": 0
    }
  ],
  "joins": []
}
```

**Resultado esperado**: ✅ Deve exportar e importar corretamente, preservando subselects aninhados

---

### Teste 5: Validação de Erros

#### 5.1. AST sem estrutura FROM
```json
{
  "select": [],
  "joins": []
}
```
**Resultado esperado**: ❌ Deve mostrar erro: "AST inválido: falta estrutura FROM"

#### 5.2. AST com subselect circular (profundidade > 10)
```json
{
  "from": {
    "subquery": {
      "from": {
        "subquery": {
          // ... 10+ níveis aninhados
        }
      }
    }
  }
}
```
**Resultado esperado**: ❌ Deve mostrar erro: "AST inválido: profundidade de subselect muito grande"

#### 5.3. Arquivo vazio
**Resultado esperado**: ❌ Deve mostrar erro: "Erro: Arquivo vazio"

---

## 🔍 Como Testar Manualmente

1. **Criar uma query simples**:
   - Adicione uma tabela base
   - Adicione algumas colunas
   - Clique em "Exportar"
   - Salve o arquivo JSON

2. **Importar a query**:
   - Limpe a query atual (remova todas as colunas)
   - Clique em "Importar"
   - Selecione o arquivo JSON exportado
   - Verifique se a query foi restaurada corretamente

3. **Testar com subselect no FROM**:
   - Crie uma query
   - No diálogo de JOINs, clique em "Subselect" na tabela base
   - Monte um subselect
   - Exporte
   - Limpe tudo
   - Importe
   - Verifique se o subselect foi restaurado

4. **Testar com subselect no WHERE**:
   - Crie uma query
   - Adicione uma condição WHERE com operador `IN`
   - Crie um subselect para essa condição
   - Exporte
   - Limpe tudo
   - Importe
   - Verifique se o subselect no WHERE foi restaurado

---

## ✅ Checklist de Funcionalidades

- [x] Exportação de AST básico
- [x] Importação de AST básico
- [x] Exportação com subselect no FROM
- [x] Importação com subselect no FROM
- [x] Exportação com subselect no WHERE
- [x] Importação com subselect no WHERE
- [x] Exportação com subselects recursivos
- [x] Importação com subselects recursivos
- [x] Validação de estrutura
- [x] Validação de profundidade
- [x] Tratamento de erros
- [x] Feedback ao usuário

---

## 🐛 Problemas Conhecidos

Nenhum problema conhecido no momento. Se encontrar algum, reporte!

---

## 📝 Notas

- A exportação/importação usa `JSON.stringify` e `JSON.parse`, que preservam a estrutura completa do AST, incluindo subselects recursivos
- A validação limita a profundidade de subselects a 10 níveis para evitar referências circulares ou estruturas muito complexas
- O `SubqueryBuilder` agora usa `importAST` corretamente, permitindo que subselects sejam carregados completamente







