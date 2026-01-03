# Como Criar Usuários de Teste

## 📋 Usuários Criados

O script `create-users.js` cria automaticamente dois usuários:

### 🔴 ADMIN
- **Username:** `admin`
- **Email:** `admin@postei.pro`
- **Senha:** `admin123`
- **Role:** `admin`
- **Payment Status:** `paid` (acesso completo)

### 🟢 TESTE
- **Username:** `teste`
- **Email:** `teste@postei.pro`
- **Senha:** `teste123`
- **Role:** `user`
- **Payment Status:** `pending` (precisa pagar)

---

## 🚀 Como Executar

### **Localmente (SQLite)**

```bash
node create-users.js
```

### **No Render (PostgreSQL)**

#### **Opção 1: Via SSH/Console do Render**

1. No Render Dashboard → Seu Serviço → **"Shell"** ou **"Console"**
2. Execute:
```bash
node create-users.js
```

#### **Opção 2: Via Script de Deploy**

Adicione ao `package.json`:
```json
{
  "scripts": {
    "create-users": "node create-users.js"
  }
}
```

E execute após o deploy:
```bash
npm run create-users
```

#### **Opção 3: Via Render Shell (Recomendado)**

1. Render Dashboard → Seu Serviço → **"Shell"**
2. Execute:
```bash
cd /opt/render/project/src
node create-users.js
```

### **No Vercel (PostgreSQL)**

O Vercel não permite executar scripts diretamente. Você precisa:

1. **Criar uma rota temporária** no servidor para executar o script
2. Ou usar o **Vercel CLI localmente** com as variáveis de ambiente do Vercel

**Via Vercel CLI:**
```bash
vercel env pull .env.local
node create-users.js
```

---

## ⚠️ Importante

- O script verifica se os usuários já existem antes de criar
- Se já existirem, apenas mostra as credenciais
- As senhas são hasheadas com bcrypt antes de salvar
- **Altere as senhas padrão em produção!**

---

## 🔐 Alterar Senhas

Para alterar as senhas dos usuários criados, você pode:

1. **Via interface web:** Faça login e altere a senha no perfil
2. **Via banco de dados:** Execute um UPDATE direto no banco
3. **Via script:** Modifique o `create-users.js` e execute novamente

---

## 📝 Notas

- O usuário admin tem `payment_status = 'paid'` (acesso completo)
- O usuário teste tem `payment_status = 'pending'` (precisa pagar)
- Ambos podem fazer login normalmente
- O admin tem acesso ao painel administrativo



