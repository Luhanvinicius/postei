# 🔧 Como Adicionar DATABASE_URL no Vercel

## ⚠️ Problema

O erro `500: INTERNAL_SERVER_ERROR` ocorre porque a `DATABASE_URL` não está configurada no Vercel.

## ✅ Solução: Adicionar DATABASE_URL

### Passo 1: Obter a Connection String

1. **No Vercel Dashboard:**
   - Vá em **Storage** (menu lateral)
   - Clique no seu banco de dados (ex: `postei-db` ou similar)
   - Vá em **Settings** (ou **.env.local**)
   - Procure por **"Connection String"** ou **"DATABASE_URL"**
   - Copie a URL completa (formato: `postgres://usuario:senha@host:porta/database`)

### Passo 2: Adicionar no Environment Variables

1. **No Vercel Dashboard:**
   - Vá em seu projeto → **Settings**
   - Clique em **Environment Variables** (menu lateral)
   - Clique em **Add New**

2. **Configurar a variável:**
   - **Key:** `DATABASE_URL`
   - **Value:** Cole a Connection String que você copiou
   - **Environments:** Marque todas as opções:
     - ✅ Production
     - ✅ Preview  
     - ✅ Development

3. **Salvar:**
   - Clique em **Save**
   - Aguarde alguns segundos

### Passo 3: Fazer Novo Deploy

1. **Opção 1 - Automático:**
   - O Vercel pode detectar a mudança e fazer redeploy automaticamente
   - Aguarde alguns minutos

2. **Opção 2 - Manual:**
   - Vá em **Deployments**
   - Clique nos 3 pontinhos do último deploy
   - Selecione **Redeploy**
   - Aguarde o deploy terminar

### Passo 4: Verificar

1. Acesse sua aplicação no Vercel
2. Se ainda der erro, verifique os **Runtime Logs**:
   - Vá em **Deployments** → Seu deploy → **Runtime Logs**
   - Procure por mensagens de erro relacionadas ao banco

## 📋 Exemplo de DATABASE_URL

```
postgres://usuario:senha@host.prisma.io:5432/database?sslmode=require
```

## ⚠️ Importante

- **NÃO use `PRISMA_DATABASE_URL`** - Ela não funciona diretamente com o driver `pg`
- **Use sempre `DATABASE_URL`** - É a URL direta do PostgreSQL
- A URL deve começar com `postgres://` ou `postgresql://`

## 🔍 Verificar se Está Configurado

No Vercel:
1. Settings → Environment Variables
2. Procure por `DATABASE_URL`
3. Se existir, está configurado ✅
4. Se não existir, adicione seguindo os passos acima

## 🆘 Ainda com Erro?

1. Verifique os **Runtime Logs** no Vercel
2. Confirme que a `DATABASE_URL` está correta
3. Verifique se o banco está ativo no Storage
4. Tente fazer um novo deploy

