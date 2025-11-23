# 🔍 Como Pegar a DATABASE_URL no Vercel

## 📋 Passo a Passo

### Opção 1: No Vercel Dashboard (Recomendado)

1. **Acesse o Vercel Dashboard:**
   - https://vercel.com
   - Faça login

2. **Vá em Storage:**
   - Menu lateral → **Storage**
   - Clique no seu banco de dados (ex: `postei-db` ou nome que você deu)

3. **Acesse Settings:**
   - Clique em **Settings** (ou **.env.local**)
   - Procure por **"Connection String"** ou **"DATABASE_URL"**

4. **Copie a URL:**
   - Formato: `postgres://usuario:senha@host:porta/database?sslmode=require`
   - Copie a URL completa

### Opção 2: Via Environment Variables (se já existe)

1. **No Vercel Dashboard:**
   - Vá em seu projeto → **Settings**
   - Clique em **Environment Variables**
   - Procure por `DATABASE_URL` ou `POSTGRES_URL`
   - Se existir, copie o valor

### Opção 3: Criar Nova Connection String

Se não encontrar, você pode criar uma nova:

1. **No Storage do Vercel:**
   - Vá em **Storage** → Seu banco
   - Clique em **Settings**
   - Procure por **"Connection String"** ou **"Create Connection String"**
   - Gere uma nova se necessário

## ⚠️ IMPORTANTE

- **NÃO use `PRISMA_DATABASE_URL`** - Ela não funciona diretamente
- **Use `DATABASE_URL` ou `POSTGRES_URL`** - URL direta do PostgreSQL
- A URL deve começar com `postgres://` ou `postgresql://`

## 📝 Exemplo de DATABASE_URL

```
postgres://usuario:senha@host.prisma.io:5432/database?sslmode=require
```

ou

```
postgresql://usuario:senha@host.prisma.io:5432/database?sslmode=require
```

## 🔧 Se Não Encontrar

1. Verifique se o banco foi criado corretamente no Storage
2. Tente criar um novo banco se necessário
3. Use a Connection String que aparece no Storage → Settings

## ✅ Depois de Pegar

1. Vá em **Settings** → **Environment Variables**
2. Adicione:
   - **Key:** `DATABASE_URL`
   - **Value:** Cole a URL que você copiou
   - **Environments:** Marque todas (Production, Preview, Development)
3. Salve e faça redeploy

