# Variáveis de Ambiente para Vercel

## 📋 Lista Completa de Variáveis de Ambiente

Configure todas essas variáveis no Vercel: **Settings → Environment Variables**

---

## 🔴 OBRIGATÓRIAS (Críticas)

### 1. Banco de Dados PostgreSQL
```bash
DATABASE_URL="postgres://8ef24adb75de8e9bb80012c01dacf72ee18e40c62e78b6cd5df15da79faf08a8:sk_BVLwPIuZCTcqLbczGxs1r@db.prisma.io:5432/postgres?sslmode=require"
```

### 2. Secret para Sessões
```bash
SESSION_SECRET="gere_um_secret_aleatorio_super_seguro_aqui_minimo_32_caracteres"
```
**⚠️ IMPORTANTE:** Gere um valor aleatório seguro. Exemplo:
```bash
# No terminal Linux/Mac:
openssl rand -base64 32

# Ou use um gerador online:
# https://randomkeygen.com/
```

---

## 🟡 IMPORTANTES (Recomendadas)

### 3. Frontend URL (para CORS)
```bash
FRONTEND_URL="https://seu-dominio.vercel.app"
```
**Ou se usar domínio customizado:**
```bash
FRONTEND_URL="https://postei.pro"
```

### 4. CORS Origin
```bash
CORS_ORIGIN="https://seu-dominio.vercel.app"
```
**Ou:**
```bash
CORS_ORIGIN="https://postei.pro"
```

### 5. Base URL (para YouTube OAuth)
```bash
BASE_URL="https://seu-dominio.vercel.app"
```
**Ou:**
```bash
BASE_URL="https://postei.pro"
```

### 6. Ambiente Node
```bash
NODE_ENV="production"
```

---

## 🟢 OPCIONAIS (Mas Recomendadas)

### 7. Gemini API Key (para IA)
```bash
GEMINI_API_KEY="sua_chave_gemini_aqui"
```
**Onde obter:** https://makersuite.google.com/app/apikey

### 8. Asaas API Key (para Pagamentos)
```bash
ASAAS_API_KEY="aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFjOGQyZmYyLWExY2MtNDY0ZC04YzBlLThlMjBlYzM1YWE2NDo6JGFhY2hfMWJmYjE1YTMtMWZkZi00ZTk4LWEzNWEtNmI2ZTJiNjBmNzY3"
```
**⚠️ IMPORTANTE:** Remova o `$` do início se houver.

### 9. Asaas Environment
```bash
ASAAS_ENVIRONMENT="sandbox"
```
**Para produção:**
```bash
ASAAS_ENVIRONMENT="production"
```

### 10. YouTube OAuth (Opcional - pode ser configurado por usuário)
```bash
YOUTUBE_CLIENT_ID="seu_client_id"
YOUTUBE_CLIENT_SECRET="seu_client_secret"
YOUTUBE_REDIRECT_URI="https://seu-dominio.vercel.app/user/auth/callback"
```

---

## 📝 Variáveis Adicionais do PostgreSQL (Opcionais)

Se você quiser usar as outras URLs do Prisma:

```bash
POSTGRES_URL="postgres://8ef24adb75de8e9bb80012c01dacf72ee18e40c62e78b6cd5df15da79faf08a8:sk_BVLwPIuZCTcqLbczGxs1r@db.prisma.io:5432/postgres?sslmode=require"

PRISMA_DATABASE_URL="prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19CVkx3UEl1WkNUY3FMYmN6R3hzMXIiLCJhcGlfa2V5IjoiMDFLQVIyREJHODlXMzZZUTA5V1JSODFONUgiLCJ0ZW5hbnRfaWQiOiI4ZWYyNGFkYjc1ZGU4ZTliYjgwMDEyYzAxZGFjZjcyZWUxOGU0MGM2MmU3OGI2Y2Q1ZGYxNWRhNzlmYWYwOGE4IiwiaW50ZXJuYWxfc2VjcmV0IjoiMGJkNzFiYmEtYzhiMi00YWJjLWJhMTktY2Q2YzU4M2MwMjU3In0.9-IGE9UK2E3lB1u25x5DYgtECwnbC6CjnfXDdx7Xswo"
```

---

## 🚀 Como Configurar no Vercel

1. Acesse: https://vercel.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **Environment Variables**
4. Adicione cada variável:
   - **Key:** Nome da variável (ex: `DATABASE_URL`)
   - **Value:** Valor da variável
   - **Environment:** Selecione **Production**, **Preview** e **Development** (ou apenas Production)
5. Clique em **Save**
6. Faça um novo deploy ou aguarde o próximo deploy automático

---

## ✅ Checklist de Configuração

- [ ] `DATABASE_URL` configurada
- [ ] `SESSION_SECRET` configurada (valor aleatório seguro)
- [ ] `FRONTEND_URL` configurada (URL do seu site no Vercel)
- [ ] `CORS_ORIGIN` configurada (mesma URL do FRONTEND_URL)
- [ ] `BASE_URL` configurada (mesma URL do FRONTEND_URL)
- [ ] `NODE_ENV` configurada como `production`
- [ ] `GEMINI_API_KEY` configurada (se usar recursos de IA)
- [ ] `ASAAS_API_KEY` configurada (sem o `$` no início)
- [ ] `ASAAS_ENVIRONMENT` configurada (`sandbox` ou `production`)

---

## 🔍 Verificar se Está Funcionando

Após configurar as variáveis e fazer o deploy:

1. Acesse seu site no Vercel
2. Verifique os logs no Vercel Dashboard → Deployments → Logs
3. Procure por mensagens:
   - ✅ `Banco de dados pronto`
   - ✅ `Servidor rodando`
   - ❌ Se aparecer erros sobre variáveis, verifique se todas foram configuradas

---

## 📞 Suporte

Se tiver problemas:
1. Verifique os logs do Vercel
2. Confirme que todas as variáveis obrigatórias estão configuradas
3. Verifique se não há espaços extras ou caracteres especiais nas variáveis
