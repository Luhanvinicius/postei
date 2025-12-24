# 🚨 CONFIGURAR DATABASE_URL NO RAILWAY (URGENTE)

O servidor está crashando porque `DATABASE_URL` não está configurada. Siga estes passos:

## 📋 Passo a Passo

### Opção 1: Criar PostgreSQL no Railway (Recomendado)

1. **No Railway, vá em seu projeto**
2. **Clique em "+ New"** (canto superior direito)
3. **Selecione "Database"**
4. **Clique em "Add PostgreSQL"**
5. **Aguarde o banco ser criado** (pode levar 1-2 minutos)
6. **O Railway criará automaticamente a variável `DATABASE_URL`**
7. **O deploy será reiniciado automaticamente**

✅ **Pronto!** O banco será criado e a variável configurada automaticamente.

---

### Opção 2: Configurar DATABASE_URL Manualmente

Se você já tem um banco PostgreSQL (Supabase, Neon, etc.):

1. **No Railway, vá em seu projeto**
2. **Clique em "Variables"** (menu lateral)
3. **Clique em "+ New Variable"**
4. **Configure:**
   - **Name:** `DATABASE_URL`
   - **Value:** Cole a connection string do seu banco
   - **Environment:** Selecione **Production**
5. **Clique em "Add"**
6. **O deploy será reiniciado automaticamente**

**Formato da connection string:**
```
postgresql://usuario:senha@host:porta/database?sslmode=require
```

---

## ✅ Verificar se Funcionou

1. **Aguarde o deploy terminar** (veja em "Deployments")
2. **Verifique os logs:**
   - Deve aparecer: `✅ DATABASE_URL encontrada e válida`
   - Deve aparecer: `✅ Conectado ao PostgreSQL`
   - **NÃO deve aparecer:** `❌ DATABASE_URL não encontrada`

3. **Se ainda estiver crashando:**
   - Verifique se a variável está realmente configurada em "Variables"
   - Verifique se o valor está correto (sem espaços extras)
   - Veja os logs completos para mais detalhes

---

## 🔧 Outras Variáveis Necessárias

Depois de configurar `DATABASE_URL`, você também precisa de:

- **SESSION_SECRET** - Gere com:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

Veja `RAILWAY_VARIABLES.md` para a lista completa.

