# 🚨 CONFIGURAR VARIÁVEIS NO VERCEL (URGENTE)

O servidor está crashando porque `DATABASE_URL` não está configurada. Siga estes passos:

## 📋 Passo a Passo Rápido

### 1. Configurar DATABASE_URL (OBRIGATÓRIA)

1. **Acesse:** https://vercel.com/seu-projeto/settings/environment-variables
   - Ou: Vercel Dashboard → Seu Projeto → Settings → Environment Variables

2. **Clique em "Add New"**

3. **Configure:**
   - **Key:** `DATABASE_URL`
   - **Value:** Cole a connection string do seu banco PostgreSQL
   - **Environment:** Marque **Production**, **Preview** e **Development**

4. **Clique em "Save"**

**Formato da connection string:**
```
postgresql://usuario:senha@host:porta/database?sslmode=require
```

**Onde obter:**
- Se você tem um banco no Supabase, Neon, Render, etc., copie a connection string de lá
- Formato geral: `postgresql://postgres:senha@host.region.provider.com:5432/database?sslmode=require`

---

### 2. Configurar SESSION_SECRET (OBRIGATÓRIA)

1. **Gere uma chave secreta:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

2. **No Vercel, adicione:**
   - **Key:** `SESSION_SECRET`
   - **Value:** Cole o resultado do comando acima
   - **Environment:** Marque **Production**, **Preview** e **Development**

3. **Clique em "Save"**

---

### 3. Após Configurar

1. **O Vercel fará um novo deploy automaticamente**
2. **Aguarde o deploy terminar** (veja em "Deployments")
3. **Verifique os logs:**
   - Vercel Dashboard → Seu Projeto → Logs
   - Deve aparecer: `✅ DATABASE_URL encontrada e válida`
   - Deve aparecer: `✅ Conectado ao PostgreSQL`
   - **NÃO deve aparecer:** `❌ DATABASE_URL não encontrada`

---

## ✅ Checklist Mínimo

Para o servidor funcionar, você precisa de:

- [ ] `DATABASE_URL` - **OBRIGATÓRIA** (Connection string do PostgreSQL)
- [ ] `SESSION_SECRET` - **OBRIGATÓRIA** (Chave secreta para sessões)

---

## 🔧 Outras Variáveis (Opcionais mas Recomendadas)

Se você usa essas funcionalidades, configure também:

- [ ] `GEMINI_API_KEY` - Para IA (geração de títulos/descrições)
- [ ] `ASAAS_API_KEY` - Para pagamentos
- [ ] `ASAAS_ENVIRONMENT` - `sandbox` ou `production`

---

## 🚨 Se Ainda Estiver Crashando

1. **Verifique se as variáveis estão realmente salvas:**
   - Vercel Dashboard → Settings → Environment Variables
   - Certifique-se de que aparecem na lista

2. **Verifique se o valor está correto:**
   - `DATABASE_URL` deve começar com `postgresql://` ou `postgres://`
   - Não deve ter espaços extras no início ou fim

3. **Veja os logs completos:**
   - Vercel Dashboard → Seu Projeto → Logs
   - Procure por erros específicos

4. **Force um novo deploy:**
   - Vercel Dashboard → Deployments → Clique nos 3 pontos → "Redeploy"

---

## 📚 Documentação Completa

Veja `VERCEL_ENV_SETUP.md` para mais detalhes sobre todas as variáveis.

