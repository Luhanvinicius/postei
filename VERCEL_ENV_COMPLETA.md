# 🔐 Variáveis de Ambiente para Vercel - Lista Completa

## 📋 Copie e Cole no Vercel

Acesse: **Vercel Dashboard → Seu Projeto → Settings → Environment Variables**

---

## ✅ VARIÁVEIS OBRIGATÓRIAS (Configure estas primeiro!)

### 1. DATABASE_URL
```
postgres://8ef24adb75de8e9bb80012c01dacf72ee18e40c62e78b6cd5df15da79faf08a8:sk_BVLwPIuZCTcqLbczGxs1r@db.prisma.io:5432/postgres?sslmode=require
```

### 2. SESSION_SECRET
```
1a06477bd7f8a8793312eb6d6f153a958e339b53bd003a64cad0210c89de05e2
```
*(Este valor foi gerado automaticamente - você pode usar este ou gerar um novo)*

---

## ⚠️ VARIÁVEIS IMPORTANTES (Recomendadas)

### 3. ASAAS_API_KEY
```
aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFjOGQyZmYyLWExY2MtNDY0ZC04YzBlLThlMjBlYzM1YWE2NDo6JGFhY2hfMWJmYjE1YTMtMWZkZi00ZTk4LWEzNWEtNmI2ZTJiNjBmNzY3
```
**⚠️ IMPORTANTE:** Remova o `$` do início se houver. O código já trata isso.

### 4. ASAAS_ENVIRONMENT
```
sandbox
```
*(Use `production` quando estiver pronto para produção)*

### 5. GEMINI_API_KEY
```
SUA_CHAVE_GEMINI_AQUI
```
*(Opcional - necessário apenas se usar funcionalidades de IA)*

---

## 🌐 VARIÁVEIS DE URL (Configure após o primeiro deploy)

Após fazer o primeiro deploy, o Vercel fornecerá uma URL. Use essa URL nas variáveis abaixo:

### 6. FRONTEND_URL
```
https://seu-projeto.vercel.app
```
*(Substitua `seu-projeto.vercel.app` pela URL real do seu projeto)*

### 7. CORS_ORIGIN
```
https://seu-projeto.vercel.app
```
*(Mesma URL do FRONTEND_URL)*

### 8. BASE_URL
```
https://seu-projeto.vercel.app
```
*(Para callbacks do YouTube OAuth)*

---

## 🔧 VARIÁVEIS OPCIONAIS

### 9. NODE_ENV
```
production
```

### 10. YOUTUBE_CLIENT_ID
```
SEU_YOUTUBE_CLIENT_ID
```
*(Opcional - apenas se usar integração com YouTube)*

### 11. YOUTUBE_CLIENT_SECRET
```
SEU_YOUTUBE_CLIENT_SECRET
```
*(Opcional - apenas se usar integração com YouTube)*

### 12. YOUTUBE_REDIRECT_URI
```
https://seu-projeto.vercel.app/user/auth/callback
```
*(Opcional - apenas se usar integração com YouTube)*

---

## 📝 Variáveis Adicionais do Banco (Opcionais)

Se quiser usar as outras URLs fornecidas:

### POSTGRES_URL
```
postgres://8ef24adb75de8e9bb80012c01dacf72ee18e40c62e78b6cd5df15da79faf08a8:sk_BVLwPIuZCTcqLbczGxs1r@db.prisma.io:5432/postgres?sslmode=require
```

### PRISMA_DATABASE_URL
```
prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19CVkx3UEl1WkNUY3FMYmN6R3hzMXIiLCJhcGlfa2V5IjoiMDFLQVIyREJHODlXMzZZUTA5V1JSODFONUgiLCJ0ZW5hbnRfaWQiOiI4ZWYyNGFkYjc1ZGU4ZTliYjgwMDEyYzAxZGFjZjcyZWUxOGU0MGM2MmU3OGI2Y2Q1ZGYxNWRhNzlmYWYwOGE4IiwiaW50ZXJuYWxfc2VjcmV0IjoiMGJkNzFiYmEtYzhiMi00YWJjLWJhMTktY2Q2YzU4M2MwMjU3In0.9-IGE9UK2E3lB1u25x5DYgtECwnbC6CjnfXDdx7Xswo
```

---

## 🚀 Passo a Passo no Vercel

1. **Acesse:** https://vercel.com/dashboard
2. **Selecione** seu projeto
3. **Vá em:** Settings → Environment Variables
4. **Para cada variável:**
   - Clique em **Add New**
   - **Key:** Nome da variável (ex: `DATABASE_URL`)
   - **Value:** Cole o valor correspondente
   - **Environment:** Selecione **Production**, **Preview** e **Development**
   - Clique em **Save**
5. **Após adicionar todas:** Faça um novo deploy ou aguarde o deploy automático

---

## ✅ Checklist Mínimo

- [ ] `DATABASE_URL` ✅ (você já forneceu)
- [ ] `SESSION_SECRET` ✅ (gerado acima)
- [ ] `ASAAS_API_KEY` ✅ (você já forneceu)
- [ ] `ASAAS_ENVIRONMENT` ✅ (`sandbox` ou `production`)
- [ ] `FRONTEND_URL` ⚠️ (configure após primeiro deploy com a URL do Vercel)

---

## 🔍 Após o Deploy

1. Verifique os logs: **Vercel Dashboard → Deployments → Logs**
2. Procure por:
   - ✅ `Banco de dados pronto` = Sucesso!
   - ❌ `DATABASE_URL é obrigatória` = Configure a variável
   - ❌ `Erro ao inicializar PostgreSQL` = Verifique a URL do banco

---

## 💡 Dica

**Para gerar um novo SESSION_SECRET:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

