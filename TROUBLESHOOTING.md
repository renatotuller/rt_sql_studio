# Solução de Problemas - SQL Spy

## Avisos do Console do Navegador

### ✅ Avisos do React Router (Corrigidos)

Se você vê avisos como:
```
⚠️ React Router Future Flag Warning: React Router will begin wrapping state updates...
```

**Status**: ✅ **Corrigido** - As flags futuras foram adicionadas no código.

### ⚠️ Erros de Extensões do Chrome

Se você vê erros como:
```
chrome-extension://fhamhppabjaafimidmelnmpfangjdnhj/icons/pin-32.png
PIN Company Discounts Provider: Error: Invalid data
```

**Status**: ✅ **Suprimidos automaticamente**

Esses erros são causados por extensões do Chrome instaladas no seu navegador (como "PIN Company Discounts"). Eles não afetam o funcionamento do SQL Spy.

**O que foi feito**: O SQL Spy agora suprime automaticamente esses erros no console para manter os logs limpos.

**Se ainda aparecerem**: Você pode ignorar esses erros ou desabilitar extensões problemáticas nas configurações do Chrome (`chrome://extensions/`).

### ℹ️ Aviso do React DevTools

```
Download the React DevTools for a better development experience
```

**Status**: ℹ️ **Apenas informativo**

Este é apenas um aviso informativo sugerindo instalar as React DevTools. Não é um erro.

**Solução**: Instale a extensão [React Developer Tools](https://reactjs.org/link/react-devtools) se quiser, mas não é necessário.

## Problemas Comuns

### Backend não inicia

**Sintomas**: Erro ao executar `npm run dev:backend`

**Soluções**:
1. Verifique se a porta 3001 está livre:
   ```bash
   # Windows
   netstat -ano | findstr :3001
   
   # Linux/Mac
   lsof -i :3001
   ```

2. Altere a porta no `.env`:
   ```env
   PORT=3002
   ```

3. Reinstale dependências:
   ```bash
   cd backend
   rm -rf node_modules
   npm install
   ```

### Frontend não conecta ao backend

**Sintomas**: Erro 404 ou "Failed to fetch" no console

**Soluções**:
1. Verifique se o backend está rodando:
   ```bash
   curl http://localhost:3001/health
   ```

2. Verifique a URL da API em `frontend/.env`:
   ```env
   VITE_API_URL=http://localhost:3001
   ```

3. Limpe o cache do Vite:
   ```bash
   cd frontend
   rm -rf node_modules/.vite
   npm run dev
   ```

### WebSocket não funciona

**Sintomas**: Monitoramento não atualiza em tempo real

**Soluções**:
1. Verifique se o backend suporta WebSocket (deve estar na mesma porta HTTP)

2. Verifique o console do navegador para erros de conexão

3. Teste a conexão WebSocket manualmente:
   ```javascript
   const ws = new WebSocket('ws://localhost:3001');
   ws.onopen = () => console.log('Conectado!');
   ws.onerror = (e) => console.error('Erro:', e);
   ```

### Erro ao conectar ao banco de dados

**Sintomas**: "Falha ao conectar" ao criar conexão

**Soluções**:
1. **MySQL**:
   - Verifique se o MySQL está rodando
   - Confirme usuário, senha e database
   - Teste conexão manual:
     ```bash
     mysql -h localhost -u usuario -p database
     ```

2. **SQL Server**:
   - Verifique se o SQL Server está rodando
   - Confirme que o TCP/IP está habilitado
   - Verifique firewall

3. **Docker**:
   - Verifique se o container está rodando:
     ```bash
     docker-compose ps
     ```
   - Veja logs:
     ```bash
     docker-compose logs mysql
     ```

### Diagrama ER não carrega

**Sintomas**: Tela em branco ou erro ao visualizar schema

**Soluções**:
1. Verifique se há tabelas no banco de dados

2. Verifique o console do navegador para erros

3. Tente recarregar a página (F5)

4. Verifique se o React Flow está instalado:
   ```bash
   cd frontend
   npm list reactflow
   ```

### Erro de TypeScript

**Sintomas**: Erros de tipo ao compilar

**Soluções**:
1. Reinstale dependências:
   ```bash
   npm run install:all
   ```

2. Limpe cache do TypeScript:
   ```bash
   rm -rf node_modules/.cache
   rm -rf dist
   ```

3. Verifique versão do Node.js (deve ser 18+):
   ```bash
   node --version
   ```

## Logs e Debug

### Habilitar logs detalhados

No backend, adicione no início de `backend/src/index.ts`:
```typescript
process.env.DEBUG = 'sql-spy:*';
```

### Verificar requisições HTTP

Abra o DevTools (F12) → Aba "Network" para ver todas as requisições.

### Verificar WebSocket

No DevTools → Aba "Network" → Filtre por "WS" para ver mensagens WebSocket.

## Suporte

Se o problema persistir:
1. Verifique os logs do backend no terminal
2. Verifique o console do navegador (F12)
3. Confirme que todas as dependências foram instaladas corretamente
4. Verifique se está usando Node.js 18+

