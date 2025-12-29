# Configuração de Portas - RT SQL Studio

Este projeto permite configurar as portas do backend e frontend através de variáveis de ambiente.

## Arquivo de Configuração

Crie um arquivo `.env` na **raiz do projeto** (mesmo nível do `package.json`) com o seguinte conteúdo:

```env
# Porta do Backend (API)
BACKEND_PORT=3001

# Porta do Frontend (Vite Dev Server)
FRONTEND_PORT=3000

# URL da API (usada pelo frontend)
VITE_API_URL=http://localhost:3001

# URL do WebSocket (usada pelo frontend para monitoramento)
VITE_WS_URL=ws://localhost:3001
```

## Como Usar

1. **Copie o arquivo de exemplo:**
   ```bash
   cp config.env.example .env
   ```

2. **Edite o arquivo `.env`** e ajuste as portas conforme necessário:
   ```env
   BACKEND_PORT=3001    # Porta do backend
   FRONTEND_PORT=3000   # Porta do frontend
   VITE_API_URL=http://localhost:3001
   VITE_WS_URL=ws://localhost:3001
   ```

3. **Reinicie os servidores** após alterar as portas:
   ```bash
   npm run dev
   ```

## Valores Padrão

Se o arquivo `.env` não existir ou as variáveis não estiverem definidas, o sistema usará:

- **Backend:** Porta `3001`
- **Frontend:** Porta `3000`
- **API URL:** `http://localhost:3001`
- **WebSocket URL:** `ws://localhost:3001`

## Importante

- ⚠️ **Nunca commite o arquivo `.env`** no Git (já está no `.gitignore`)
- ✅ **Commite apenas o `config.env.example`** como template
- 🔄 **Reinicie os servidores** após alterar as portas
- 🔗 **Mantenha consistência:** Se mudar `BACKEND_PORT`, atualize também `VITE_API_URL` e `VITE_WS_URL`

## Exemplo de Configuração Personalizada

Se você quiser usar portas diferentes:

```env
BACKEND_PORT=8080
FRONTEND_PORT=3000
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
```

Neste exemplo:
- Backend rodará na porta `8080`
- Frontend rodará na porta `3000`
- Frontend se conectará ao backend na porta `8080`

