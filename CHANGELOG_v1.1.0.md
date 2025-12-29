# Changelog v1.1.0

**Data**: Janeiro 2025  
**Versão**: 1.1.0

## 🎉 Novas Funcionalidades

### Query Builder - Funcionalidades Avançadas

1. **UNION/UNION ALL**
   - ✅ Implementação completa de UNION e UNION ALL
   - ✅ Editor visual para criar queries UNION
   - ✅ Suporte a múltiplos UNIONs ordenados
   - ✅ Geração de SQL correta com UNIONs

2. **Subselects no SELECT**
   - ✅ Interface para criar subselects diretamente no SELECT
   - ✅ Editor visual usando SubqueryBuilder
   - ✅ Renderização com ícone de código
   - ✅ Edição de subselects existentes

3. **Funções de Agregação**
   - ✅ Suporte a COUNT, SUM, AVG, MIN, MAX
   - ✅ Diálogo para criar agregações
   - ✅ Suporte a COUNT(*) (sem coluna específica)
   - ✅ Renderização visual com ícone de camadas

4. **Menu Retrátil "Avançado"**
   - ✅ Menu dropdown para Subselect e Agregação
   - ✅ Interface mais limpa e organizada
   - ✅ Consistente com o menu de exportação

## 🔧 Melhorias

### Query Builder
- ✅ Limpeza automática de resultados quando não há colunas selecionadas
- ✅ Limpeza automática de tabela base e JOINs quando todas as colunas são removidas
- ✅ Melhorias na lógica de `includedTables` (só inclui tabelas com colunas selecionadas)
- ✅ Geração de SQL não ocorre quando não há colunas selecionadas
- ✅ Indicador visual durante drag (mostra apenas nome da coluna)

### UI/UX
- ✅ Menu retrátil para funcionalidades avançadas
- ✅ Visual mais limpo na área de campos SELECT
- ✅ Ícones coloridos para diferentes tipos de campos

## 🐛 Correções

- ✅ Corrigido problema onde tabelas apareciam como "INCLUÍDA" mesmo sem colunas selecionadas
- ✅ Corrigido problema onde queries eram executadas automaticamente mesmo sem colunas
- ✅ Corrigido problema de múltiplas colunas sendo adicionadas em um único drop
- ✅ Melhorada a lógica de auto-execução após drag and drop

## 📦 Arquivos Modificados

### Frontend
- `frontend/src/types/query-builder.ts` - Adicionados tipos para UNION e alias CTEDefinition
- `frontend/src/components/query-builder/UnionEditor.tsx` - Novo componente
- `frontend/src/components/query-builder/SelectList.tsx` - Suporte a subselects e agregações
- `frontend/src/hooks/useQueryBuilder.ts` - Funções para UNION, subselects e agregações
- `frontend/src/utils/query-builder/sql-generator.ts` - Geração de SQL para UNION, subselects e agregações
- `frontend/src/pages/QueryBuilder.tsx` - Integração de todas as novas funcionalidades

### Backend
- `backend/src/routes/query.ts` - Nova rota para execução de queries (já existia)

## 🚀 Próximos Passos

- [ ] Testes unitários para funções críticas
- [ ] Validação de AST
- [ ] Testes de todos os casos de uso da especificação
- [ ] Melhorias de performance para schemas grandes

---

**Nota**: Esta versão marca a implementação completa das funcionalidades avançadas do Query Builder, incluindo UNION, subselects no SELECT e funções de agregação.

