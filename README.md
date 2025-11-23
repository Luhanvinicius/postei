# 🚀 POSTEI AUTOMAÇÕES - YouTube Automation

Sistema de automação de upload para YouTube com multi-usuário, geração de conteúdo com IA (Google Gemini) e agendamento inteligente.

## 📋 Funcionalidades

- ✅ **Multi-usuário**: Cada usuário pode vincular seu próprio canal do YouTube
- ✅ **IA Generativa**: Gera títulos e descrições baseados no conteúdo real do vídeo usando Google Gemini
- ✅ **Thumbnails Automáticos**: A IA escolhe o melhor frame do vídeo para criar thumbnails
- ✅ **Agendamento Inteligente**: Agende seus vídeos para publicação automática
- ✅ **Publicação Instantânea**: Publique seus vídeos diretamente no YouTube
- ✅ **Dashboard Completo**: Acompanhe seus vídeos publicados, agendados e estatísticas

## 🛠️ Tecnologias

- **Node.js** + **Express.js**
- **EJS** (Templating)
- **SQLite** (Banco de dados)
- **Google Gemini API** (IA)
- **YouTube Data API v3**
- **FFmpeg** (Processamento de vídeo)
- **Bootstrap 5** (UI)

## 📦 Instalação

### Pré-requisitos

- Node.js >= 18.0.0
- npm >= 9.0.0
- FFmpeg instalado no sistema (ou use `ffmpeg-static` e `ffprobe-static` que já estão incluídos)

### Passos

1. **Clone o repositório**
```bash
git clone <seu-repositorio>
cd youtube-automation-node
```

2. **Instale as dependências**
```bash
npm install
```

3. **Configure as variáveis de ambiente**

Crie um arquivo `.env` na raiz do projeto:

```env
# Servidor
PORT=3000
NODE_ENV=development

# Sessão
SESSION_SECRET=seu-secret-key-super-seguro-aqui

# Google Gemini API
GEMINI_API_KEY=sua-chave-do-gemini-aqui
```

4. **Inicie o servidor**
```bash
npm start
```

Para desenvolvimento com auto-reload:
```bash
npm run dev
```

5. **Acesse a aplicação**
```
http://localhost:3000
```

## 🔐 Primeiro Acesso

1. Acesse `/auth/login`
2. Faça login com um usuário admin (crie via banco de dados ou use o primeiro usuário criado)
3. Para criar usuários, acesse `/admin/dashboard`

## 📝 Configuração do YouTube

1. Acesse `/user/accounts` (Vincular Contas)
2. Faça upload do arquivo `client_secrets.json` do seu projeto Google Cloud
3. Clique em "Autenticar Canal do YouTube"
4. Autorize o acesso ao seu canal

## ⚠️ IMPORTANTE: SQLite no Vercel

**SQLite NÃO funciona bem no Vercel** porque:
- Vercel é serverless (stateless)
- Cada requisição pode estar em um container diferente
- O sistema de arquivos é temporário
- Dados não persistem entre invocações

### 📚 Documentação Completa

- **`SQLITE_VERCEL.md`** - Explicação detalhada sobre limitações
- **`MIGRACAO_POSTGRESQL.md`** - Guia completo de migração

### Alternativas Recomendadas:

1. **PostgreSQL** ⭐ (Recomendado)
   - [Supabase](https://supabase.com) - Grátis até 500MB
   - [Neon](https://neon.tech) - Grátis até 512MB
   - [Railway](https://railway.app) - Grátis com créditos

2. **MongoDB**
   - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) - Grátis até 512MB

3. **Outras opções**
   - [PlanetScale](https://planetscale.com) - MySQL serverless
   - [Turso](https://turso.tech) - SQLite distribuído (pago)

### Migração para PostgreSQL

Veja o arquivo `MIGRACAO_POSTGRESQL.md` para instruções detalhadas.

## 🚀 Deploy no Vercel

1. **Instale o Vercel CLI**
```bash
npm i -g vercel
```

2. **Faça login**
```bash
vercel login
```

3. **Deploy**
```bash
vercel
```

4. **Configure as variáveis de ambiente no Vercel Dashboard**
   - Acesse: https://vercel.com/seu-projeto/settings/environment-variables
   - Adicione: `SESSION_SECRET`, `GEMINI_API_KEY`, etc.

## 📁 Estrutura do Projeto

```
youtube-automation-node/
├── routes/          # Rotas da aplicação
│   ├── auth.js      # Autenticação
│   ├── admin.js     # Painel admin
│   ├── user.js      # Painel usuário
│   └── api.js       # API endpoints
├── services/        # Serviços
│   ├── gemini-service.js    # Integração Gemini
│   ├── youtube-uploader.js   # Upload YouTube
│   ├── youtube-auth.js       # Autenticação YouTube
│   └── scheduler.js          # Agendador
├── views/           # Templates EJS
│   ├── index.ejs    # Home page
│   ├── auth/        # Login/Register
│   ├── admin/       # Dashboard admin
│   └── user/        # Dashboard usuário
├── public/          # Arquivos estáticos
├── database.js      # Banco de dados SQLite
├── server.js        # Servidor principal
└── package.json     # Dependências
```

## 🔧 Variáveis de Ambiente

| Variável | Descrição | Obrigatório |
|----------|-----------|-------------|
| `PORT` | Porta do servidor | Não (padrão: 3000) |
| `NODE_ENV` | Ambiente (development/production) | Não |
| `SESSION_SECRET` | Chave secreta para sessões | Sim |
| `GEMINI_API_KEY` | Chave da API do Google Gemini | Sim |

## 📄 Licença

MIT

## 👨‍💻 Autor

POSTEI AUTOMAÇÕES

## 🆘 Suporte

Para problemas ou dúvidas, abra uma issue no repositório.
