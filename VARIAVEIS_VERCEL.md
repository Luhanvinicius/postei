# Variáveis de Ambiente no Vercel

## Variáveis Obrigatórias

### 1. `SESSION_SECRET` ou `JWT_SECRET`
**O que é:** Chave secreta usada para assinar os tokens JWT de autenticação.

**Como gerar:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Valor exemplo:** `859ccf81c6ebc0251e9ab411a069544851472e140572898c2c9ec4c0d29fba02`

**Importante:** Use a mesma chave em produção e desenvolvimento para manter compatibilidade.

### 2. `DATABASE_URL`
**O que é:** URL de conexão com o banco de dados PostgreSQL.

**Formato:** `postgres://usuario:senha@host:porta/database`

**Exemplo:** `postgres://user:password@host.vercel-postgres.com:5432/database`

### 3. `GEMINI_API_KEY`
**O que é:** Chave da API do Google Gemini para geração de conteúdo com IA.

**Onde obter:** https://makersuite.google.com/app/apikey

## Variáveis Opcionais

### `NODE_ENV`
**Valor:** `production` (já configurado automaticamente pelo Vercel)

## Como Adicionar no Vercel

1. Acesse seu projeto no Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione cada variável:
   - **Key:** `SESSION_SECRET`
   - **Value:** (cole o valor gerado)
   - **Environment:** Production, Preview, Development (marque todos)
4. Clique em **Save**
5. Faça um novo deploy para aplicar as mudanças

## ⚠️ IMPORTANTE

- **NÃO** adicione o token JWT nas variáveis de ambiente
- O token é gerado dinamicamente no login e enviado para o cliente
- Apenas o `SESSION_SECRET` precisa estar nas variáveis de ambiente
- Mantenha o `SESSION_SECRET` seguro e não compartilhe publicamente

