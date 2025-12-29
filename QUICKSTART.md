# Guia de Início Rápido - SQL Spy

## 🚀 Instalação Rápida

### 1. Instalar Dependências

```bash
# Na raiz do projeto
npm run install:all
```

Isso instalará as dependências do workspace root, backend e frontend.

### 2. Configurar Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto (opcional, valores padrão funcionam):

```env
PORT=3001
NODE_ENV=development
```

No frontend, crie `frontend/.env` (opcional):

```env
VITE_API_URL=http://localhost:3001
```

### 3. Iniciar Aplicação

#### Opção A: Desenvolvimento (Recomendado)

```bash
# Inicia backend e frontend simultaneamente
npm run dev
```

- Backend: http://localhost:3001
- Frontend: http://localhost:3000

#### Opção B: Separadamente

```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

### 4. Usar com Docker (MySQL de teste)

```bash
# Iniciar MySQL
docker-compose up -d mysql

# Aguardar MySQL estar pronto (10-20 segundos)
docker-compose ps

# Agora você pode criar uma conexão no SQL Spy:
# - Host: localhost
# - Porta: 3306
# - Usuário: app_user
# - Senha: app_password
# - Database: test_db
```

## 📝 Primeiros Passos

1. **Acesse o Frontend**: http://localhost:3000

2. **Crie uma Conexão**:
   - Vá em "Conexões"
   - Clique em "Nova Conexão"
   - Preencha os dados do seu banco
   - Clique em "Testar e Salvar"

3. **Visualize o Schema**:
   - No Dashboard, clique em "Ver Schema" em uma conexão
   - Explore o diagrama ER interativo
   - Clique em tabelas para ver detalhes das colunas

4. **Monitore Queries**:
   - Clique em "Monitorar" em uma conexão
   - Veja queries ativas em tempo real
   - Ative "Auto-refresh" para atualização automática

## 🔧 Solução de Problemas

### Erro: "Cannot find module"

```bash
# Reinstalar dependências
rm -rf node_modules backend/node_modules frontend/node_modules
npm run install:all
```

### Erro: "Port already in use"

Altere a porta no `.env` ou pare o processo que está usando a porta.

### MySQL não conecta

- Verifique se o MySQL está rodando
- Confirme usuário/senha/database
- Para Docker: `docker-compose logs mysql`

### WebSocket não funciona

- Verifique se o backend está rodando na porta 3001
- Confira o console do navegador para erros
- O WebSocket usa a mesma porta do HTTP

## 📚 Próximos Passos

- Leia [ARCHITECTURE.md](./ARCHITECTURE.md) para entender a arquitetura
- Explore o código em `backend/src` e `frontend/src`
- Personalize o tema em `frontend/tailwind.config.js`

## 🐛 Reportar Problemas

Se encontrar problemas:
1. Verifique os logs do backend no terminal
2. Verifique o console do navegador (F12)
3. Confirme que todas as dependências foram instaladas









