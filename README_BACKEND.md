# Backend - Postei.pro API

Backend da plataforma Postei.pro - Sistema de automação de upload para YouTube com IA.

## 🚀 Deploy no Railway

### 1. Conectar ao Railway

1. Acesse [Railway](https://railway.app)
2. Clique em "New Project"
3. Selecione "Deploy from GitHub repo"
4. Conecte o repositório `back-end-esposito`

### 2. Configurar Variáveis de Ambiente

No Railway, vá em **Variables** e adicione:

#### OBRIGATÓRIAS:
- `DATABASE_URL` - Connection string do PostgreSQL
- `SESSION_SECRET` - Gere com: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

#### RECOMENDADAS:
- `GEMINI_API_KEY` - Para funcionalidades de IA
- `ASAAS_API_KEY` - Para pagamentos
- `ASAAS_ENVIRONMENT` - `sandbox` ou `production`
- `FRONTEND_URL` - URL do frontend (ex: `https://postei.vercel.app`) para CORS
- `CORS_ORIGIN` - Mesmo que FRONTEND_URL (alternativa)

### 3. Configurar Banco de Dados

O Railway pode criar um PostgreSQL automaticamente:
1. No projeto Railway, clique em **+ New**
2. Selecione **Database** → **Add PostgreSQL**
3. Railway criará automaticamente a variável `DATABASE_URL`

### 4. Deploy Automático

Após conectar o repositório, o Railway fará deploy automaticamente a cada push na branch `main`.

## 📋 Variáveis de Ambiente

Crie um arquivo `.env` localmente (baseado no `env.example`):

```env
# Porta (Railway define automaticamente)
PORT=3000

# Secret para sessões
SESSION_SECRET=seu_secret_super_seguro_aqui

# Gemini API Key
GEMINI_API_KEY=sua_chave_gemini_aqui

# Asaas API (Sistema de Pagamento)
ASAAS_API_KEY=sua_chave_asaas
ASAAS_ENVIRONMENT=sandbox

# Frontend URL (para CORS)
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# Database (Railway fornece automaticamente)
DATABASE_URL=postgres://...
```

## 🛠️ Desenvolvimento Local

```bash
# Instalar dependências
npm install

# Rodar em desenvolvimento
npm run dev

# Inicializar banco PostgreSQL
npm run init-db
```

## 📡 API Endpoints

### Autenticação
- `POST /auth/login` - Login
- `POST /auth/register` - Registro
- `POST /auth/logout` - Logout

### Usuário
- `GET /user/dashboard` - Dashboard do usuário
- `GET /user/profile` - Perfil do usuário
- `GET /user/videos` - Lista de vídeos
- `GET /user/plans` - Planos disponíveis

### Pagamento
- `GET /payment/checkout/:planSlug` - Checkout
- `POST /payment/checkout/:planSlug` - Criar pagamento
- `GET /payment/pending` - Pagamento pendente
- `POST /payment/webhook/asaas` - Webhook do Asaas

### Admin
- `GET /admin/dashboard` - Dashboard admin
- `GET /admin/users` - Gerenciar usuários
- `GET /admin/invoices` - Gerenciar faturas

## 🔒 CORS

O backend está configurado para aceitar requisições do frontend. Configure `FRONTEND_URL` ou `CORS_ORIGIN` no Railway.

## 📝 Notas

- O Railway detecta automaticamente Node.js e executa `npm start`
- O banco de dados PostgreSQL é criado automaticamente pelo Railway
- Sessões são armazenadas em memória no Railway (use Redis para produção)
- Uploads de arquivos são temporários no Railway (use S3 ou similar para produção)

## 🐛 Troubleshooting

### Erro: "Internal Server Error"
- Verifique se `DATABASE_URL` está configurada
- Verifique os logs no Railway Dashboard

### Erro: CORS
- Configure `FRONTEND_URL` ou `CORS_ORIGIN` no Railway
- Verifique se a URL do frontend está correta

### Erro: Sessão não persiste
- No Railway, sessões são em memória
- Para produção, considere usar Redis (Upstash no Railway)


