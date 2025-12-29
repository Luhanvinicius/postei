# Guia de Deploy no Render

## 🚀 Passo a Passo para Deploy no Render

### 1. **Criar Conta no Render**
   - Acesse: https://render.com
   - Faça login ou crie uma conta (pode usar GitHub)

### 2. **Criar Novo Web Service**
   - No dashboard do Render, clique em **"New +"**
   - Selecione **"Web Service"**
   - Conecte seu repositório GitHub: `Luhanvinicius/postei`
   - Branch: `main`

### 3. **Configurar o Serviço**

#### **Configurações Básicas:**
- **Name:** `postei` (ou o nome que preferir)
- **Region:** Escolha a região mais próxima (ex: `Oregon (US West)`)
- **Branch:** `main`
- **Root Directory:** Deixe vazio (ou `./` se necessário)
- **Runtime:** `Node`
- **Build Command:** `npm install`
- **Start Command:** `npm start`

#### **Plano:**
- Escolha o plano **Starter** (gratuito) ou **Standard** (pago)

### 4. **Configurar Banco de Dados PostgreSQL**

#### **Opção A: Criar PostgreSQL no Render**
1. No dashboard do Render, clique em **"New +"**
2. Selecione **"PostgreSQL"**
3. Configure:
   - **Name:** `postei-db` (ou o nome que preferir)
   - **Database:** `postei` (ou deixe o padrão)
   - **User:** Deixe o padrão
   - **Region:** Mesma região do seu Web Service
   - **Plan:** Escolha o plano (Free tier disponível)
4. Clique em **"Create Database"**
5. Após criar, vá em **"Info"** e copie a **"Internal Database URL"** ou **"External Database URL"**

#### **Opção B: Usar PostgreSQL Existente**
- Use a mesma `DATABASE_URL` que você já tem do Prisma

### 5. **Configurar Variáveis de Ambiente**

No Render, vá em **"Environment"** e adicione as seguintes variáveis:

#### **🔴 OBRIGATÓRIAS:**

```
DATABASE_URL=postgres://8ef24adb75de8e9bb80012c01dacf72ee18e40c62e78b6cd5df15da79faf08a8:sk_BVLwPIuZCTcqLbczGxs1r@db.prisma.io:5432/postgres?sslmode=require

SESSION_SECRET=GERAR_UM_VALOR_ALEATORIO_AQUI_MINIMO_32_CARACTERES

NODE_ENV=production

PORT=10000
```

#### **🟡 IMPORTANTES:**

```
FRONTEND_URL=https://seu-app.onrender.com

CORS_ORIGIN=https://seu-app.onrender.com

BASE_URL=https://seu-app.onrender.com
```

**⚠️ IMPORTANTE:** Substitua `seu-app.onrender.com` pela URL real do seu app no Render (você verá após criar o serviço).

#### **🟢 OPCIONAIS:**

```
GEMINI_API_KEY=AIzaSyCd2F9N7En-T7uxbSQJRpOKzJcUW...

ASAAS_API_KEY=aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFjOGQyZmYyLWExY2MtNDY0ZC04YzBlLThlMjBlYzM1YWE2NDo6JGFhY2hfMWJmYjE1YTMtMWZkZi00ZTk4LWEzNWEtNmI2ZTJiNjBmNzY3

ASAAS_ENVIRONMENT=sandbox

POSTGRES_URL=postgres://8ef24adb75de8e9bb80012c01dacf72ee18e40c62e78b6cd5df15da79faf08a8:sk_BVLwPIuZCTcqLbczGxs1r@db.prisma.io:5432/postgres?sslmode=require

PRISMA_DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqd3RfaWQiOjEsInNlY3VyZV9rZXkiOiJza19CVkx3UEl1WkNUY3FMYmN6R3hzMXIiLCJhcGlfa2V5IjoiMDFLQVIyREJHODlXMzZZUTA5V1JSODFONUgiLCJ0ZW5hbnRfaWQiOiI4ZWYyNGFkYjc1ZGU4ZTliYjgwMDEyYzAxZGFjZjcyZWUxOGU0MGM2MmU3OGI2Y2Q1ZGYxNWRhNzlmYWYwOGE4IiwiaW50ZXJuYWxfc2VjcmV0IjoiMGJkNzFiYmEtYzhiMi00YWJjLWJhMTktY2Q2YzU4M2MwMjU3In0.9-IGE9UK2E3lB1u25x5DYgtECwnbC6CjnfXDdx7Xswo
```

### 6. **Gerar SESSION_SECRET**

**Opção 1:** Use este gerador online: https://randomkeygen.com/
- Escolha "CodeIgniter Encryption Keys"
- Copie uma das chaves geradas

**Opção 2:** No terminal:
```bash
openssl rand -base64 32
```

**Opção 3:** No PowerShell (Windows):
```powershell
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
```

### 7. **Deploy**

1. Após configurar tudo, clique em **"Create Web Service"**
2. O Render começará a fazer o build automaticamente
3. Aguarde o deploy terminar (pode levar 5-10 minutos na primeira vez)
4. Após o deploy, você verá a URL do seu app (ex: `https://postei.onrender.com`)

### 8. **Atualizar Variáveis de Ambiente**

Após o deploy, atualize as variáveis `FRONTEND_URL`, `CORS_ORIGIN` e `BASE_URL` com a URL real do Render:
- Vá em **"Environment"**
- Edite as variáveis:
  - `FRONTEND_URL=https://seu-app.onrender.com`
  - `CORS_ORIGIN=https://seu-app.onrender.com`
  - `BASE_URL=https://seu-app.onrender.com`
- Clique em **"Save Changes"**
- O Render fará um novo deploy automaticamente

### 9. **Verificar se Está Funcionando**

1. Acesse: `https://seu-app.onrender.com/health`
2. Deve retornar um JSON com status `ok`
3. Acesse: `https://seu-app.onrender.com`
4. Deve carregar a página inicial

## 📋 Checklist de Configuração

- [ ] Conta criada no Render
- [ ] Web Service criado
- [ ] PostgreSQL criado (ou usando existente)
- [ ] `DATABASE_URL` configurada
- [ ] `SESSION_SECRET` configurada (valor aleatório gerado)
- [ ] `NODE_ENV` = `production`
- [ ] `PORT` = `10000`
- [ ] `FRONTEND_URL` configurada (URL do Render)
- [ ] `CORS_ORIGIN` configurada (mesma URL)
- [ ] `BASE_URL` configurada (mesma URL)
- [ ] Variáveis opcionais adicionadas (se necessário)
- [ ] Deploy concluído
- [ ] Testado `/health`
- [ ] Testado página principal

## 🔍 Verificar Logs

Se houver problemas:
1. No Render Dashboard → Seu Serviço → **"Logs"**
2. Procure por mensagens de erro
3. Verifique se todas as variáveis estão configuradas

## ⚠️ Diferenças entre Vercel e Render

- **Vercel:** Serverless functions, não mantém estado entre requisições
- **Render:** Servidor tradicional, mantém estado, pode usar `app.listen()`
- **Render:** Precisa de `PORT` configurado (geralmente `10000`)
- **Render:** Pode usar PostgreSQL interno ou externo

## 🆘 Problemas Comuns

**Erro: "Cannot find module"**
- Verifique se todas as dependências estão no `package.json`
- O Render executa `npm install` automaticamente

**Erro: "Port already in use"**
- Configure `PORT=10000` nas variáveis de ambiente
- O Render usa a porta especificada na variável `PORT`

**Erro: "Database connection failed"**
- Verifique se `DATABASE_URL` está correta
- Se usar PostgreSQL do Render, use a "Internal Database URL" para melhor performance

**App não inicia**
- Verifique os logs no Render
- Confirme que `npm start` está correto no `package.json`


