/**
 * Formatador de SQL
 * Aplica indentação e formatação seguindo padrões comuns de SQL
 * 
 * Padrões aplicados:
 * - SELECT, FROM, JOIN, WHERE, GROUP BY, ORDER BY em linhas separadas
 * - Indentação de 2 espaços para subcláusulas (colunas, condições ON, etc.)
 * - Colunas do SELECT uma por linha quando múltiplas
 * - Condições ON indentadas abaixo do JOIN
 * - Condições WHERE com operadores lógicos (AND/OR) em linhas separadas
 * - GROUP BY e ORDER BY com múltiplos campos, um por linha
 */

export function formatSQL(sql: string): string {
  if (!sql || !sql.trim()) return sql;

  // Normalizar: remover espaços extras e quebras de linha existentes
  let normalized = sql
    .replace(/\s+/g, ' ') // Múltiplos espaços → um espaço
    .replace(/\s*,\s*/g, ', ') // Espaços ao redor de vírgulas
    .trim();

  // Dividir SQL em partes baseado em palavras-chave principais
  const result: string[] = [];
  
  // Regex para encontrar cláusulas principais
  const clausePatterns = [
    { regex: /\bSELECT\s+(TOP\s+\d+\s+)?(.+?)(?=\s+FROM\b)/is, name: 'SELECT' },
    { regex: /\bFROM\s+(.+?)(?=\s+(?:INNER|LEFT|RIGHT|FULL)\s+JOIN\b|\s+WHERE\b|\s+GROUP\s+BY\b|\s+ORDER\s+BY\b|\s+LIMIT\b|$)/is, name: 'FROM' },
    { regex: /\b(INNER|LEFT|RIGHT|FULL)\s+JOIN\s+(.+?)(?:\s+ON\s+(.+?))?(?=\s+(?:INNER|LEFT|RIGHT|FULL)\s+JOIN\b|\s+WHERE\b|\s+GROUP\s+BY\b|\s+ORDER\s+BY\b|\s+LIMIT\b|$)/is, name: 'JOIN' },
    { regex: /\bWHERE\s+(.+?)(?=\s+GROUP\s+BY\b|\s+ORDER\s+BY\b|\s+LIMIT\b|$)/is, name: 'WHERE' },
    { regex: /\bGROUP\s+BY\s+(.+?)(?=\s+ORDER\s+BY\b|\s+LIMIT\b|$)/is, name: 'GROUP BY' },
    { regex: /\bORDER\s+BY\s+(.+?)(?=\s+LIMIT\b|$)/is, name: 'ORDER BY' },
    { regex: /\bLIMIT\s+(\d+)/i, name: 'LIMIT' },
  ];

  // Extrair SELECT
  const selectMatch = normalized.match(/\bSELECT\s+(TOP\s+\d+\s+)?(.+?)(?=\s+FROM\b)/is);
  if (selectMatch) {
    const topClause = selectMatch[1] || '';
    const selectFields = selectMatch[2].trim();
    
    // Formatar SELECT
    if (selectFields === '*') {
      result.push(`SELECT${topClause ? ' ' + topClause.trim() : ''} *`);
    } else {
      // Dividir campos por vírgula
      const fields = selectFields.split(',').map(f => f.trim()).filter(f => f);
      if (fields.length === 1) {
        result.push(`SELECT${topClause ? ' ' + topClause.trim() : ''} ${fields[0]}`);
      } else {
        result.push(`SELECT${topClause ? ' ' + topClause.trim() : ''}`);
        fields.forEach((field, idx) => {
          result.push(`  ${field}${idx < fields.length - 1 ? ',' : ''}`);
        });
      }
    }
  }

  // Extrair FROM
  const fromMatch = normalized.match(/\bFROM\s+(.+?)(?=\s+(?:INNER|LEFT|RIGHT|FULL)\s+JOIN\b|\s+WHERE\b|\s+GROUP\s+BY\b|\s+ORDER\s+BY\b|\s+LIMIT\b|$)/is);
  if (fromMatch) {
    result.push(`FROM ${fromMatch[1].trim()}`);
  }

  // Extrair JOINs (pode haver múltiplos)
  const joinRegex = /\b(INNER|LEFT|RIGHT|FULL)\s+JOIN\s+(.+?)(?:\s+ON\s+(.+?))?(?=\s+(?:INNER|LEFT|RIGHT|FULL)\s+JOIN\b|\s+WHERE\b|\s+GROUP\s+BY\b|\s+ORDER\s+BY\b|\s+LIMIT\b|$)/gis;
  let joinMatch;
  while ((joinMatch = joinRegex.exec(normalized)) !== null) {
    const joinType = joinMatch[1].toUpperCase();
    const table = joinMatch[2].trim();
    const onCondition = joinMatch[3]?.trim();
    
    result.push(`  ${joinType} JOIN ${table}`);
    if (onCondition) {
      // Formatar condição ON com indentação extra
      // Se há AND/OR, quebrar em linhas
      if (onCondition.match(/\s+(AND|OR)\s+/i)) {
        const parts = onCondition.split(/\s+(AND|OR)\s+/i);
        let onLine = '    ON ' + parts[0].trim();
        result.push(onLine);
        for (let i = 1; i < parts.length; i += 2) {
          const op = parts[i].toUpperCase();
          const cond = parts[i + 1]?.trim() || '';
          result.push(`    ${op} ${cond}`);
        }
      } else {
        result.push(`    ON ${onCondition}`);
      }
    }
  }

  // Extrair WHERE
  const whereMatch = normalized.match(/\bWHERE\s+(.+?)(?=\s+GROUP\s+BY\b|\s+ORDER\s+BY\b|\s+LIMIT\b|$)/is);
  if (whereMatch) {
    const whereClause = whereMatch[1].trim();
    
    // Se há AND/OR, quebrar em linhas
    if (whereClause.match(/\s+(AND|OR)\s+/i)) {
      const parts = whereClause.split(/\s+(AND|OR)\s+/i);
      result.push(`WHERE ${parts[0].trim()}`);
      for (let i = 1; i < parts.length; i += 2) {
        const op = parts[i].toUpperCase();
        const cond = parts[i + 1]?.trim() || '';
        result.push(`  ${op} ${cond}`);
      }
    } else {
      result.push(`WHERE ${whereClause}`);
    }
  }

  // Extrair GROUP BY
  const groupByMatch = normalized.match(/\bGROUP\s+BY\s+(.+?)(?=\s+ORDER\s+BY\b|\s+LIMIT\b|$)/is);
  if (groupByMatch) {
    const fields = groupByMatch[1].trim().split(',').map(f => f.trim()).filter(f => f);
    if (fields.length === 1) {
      result.push(`GROUP BY ${fields[0]}`);
    } else {
      result.push('GROUP BY');
      fields.forEach((field, idx) => {
        result.push(`  ${field}${idx < fields.length - 1 ? ',' : ''}`);
      });
    }
  }

  // Extrair ORDER BY
  const orderByMatch = normalized.match(/\bORDER\s+BY\s+(.+?)(?=\s+LIMIT\b|$)/is);
  if (orderByMatch) {
    const fields = orderByMatch[1].trim().split(',').map(f => f.trim()).filter(f => f);
    if (fields.length === 1) {
      result.push(`ORDER BY ${fields[0]}`);
    } else {
      result.push('ORDER BY');
      fields.forEach((field, idx) => {
        result.push(`  ${field}${idx < fields.length - 1 ? ',' : ''}`);
      });
    }
  }

  // Extrair LIMIT
  const limitMatch = normalized.match(/\bLIMIT\s+(\d+)/i);
  if (limitMatch) {
    result.push(`LIMIT ${limitMatch[1]}`);
  }

  // Se não encontrou nenhuma cláusula, retornar SQL original
  if (result.length === 0) {
    return normalized;
  }

  return result.join('\n');
}
