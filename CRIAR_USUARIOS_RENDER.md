# Como Criar Usuários no Render (Plano Gratuito)

Como o plano gratuito do Render não oferece acesso ao Shell, você pode criar os usuários através de uma rota HTTP especial.

## 🚀 Passo a Passo

### 1. **Configure a Variável de Ambiente SETUP_SECRET**

No Render Dashboard → Seu Serviço → **"Environment"** → Adicione:

```
SETUP_SECRET=GERAR_UM_VALOR_ALEATORIO_AQUI
```

**Gere um valor aleatório:**
- Use: https://randomkeygen.com/ (escolha "CodeIgniter Encryption Keys")
- Ou gere no terminal: `openssl rand -base64 32`

### 2. **Faça o Deploy**

Aguarde o deploy terminar no Render.

### 3. **Acesse a Rota de Criação**

Após o deploy, acesse no navegador:

```
https://seu-app.onrender.com/setup/create-users?secret=SUA_CHAVE_SECRETA_AQUI
```

**Substitua:**
- `seu-app.onrender.com` pela URL real do seu app no Render
- `SUA_CHAVE_SECRETA_AQUI` pelo valor que você configurou em `SETUP_SECRET`

### 4. **Verificar Resultado**

Você verá um JSON com o resultado:

```json
{
  "success": true,
  "message": "Processo concluído",
  "results": {
    "admin": {
      "success": true,
      "message": "Usuário admin criado com sucesso",
      "username": "admin",
      "email": "admin@postei.pro",
      "password": "admin123",
      "role": "admin",
      "payment_status": "paid"
    },
    "teste": {
      "success": true,
      "message": "Usuário de teste criado com sucesso",
      "username": "teste",
      "email": "teste@postei.pro",
      "password": "teste123",
      "role": "user",
      "payment_status": "pending"
    }
  },
  "credentials": {
    "admin": {
      "username": "admin",
      "email": "admin@postei.pro",
      "password": "admin123",
      "role": "admin"
    },
    "teste": {
      "username": "teste",
      "email": "teste@postei.pro",
      "password": "teste123",
      "role": "user"
    }
  }
}
```

## 📋 Credenciais Criadas

### 🔴 ADMIN
- **Username:** `admin`
- **Email:** `admin@postei.pro`
- **Senha:** `admin123`
- **Role:** `admin`
- **Payment Status:** `paid`

### 🟢 TESTE
- **Username:** `teste`
- **Email:** `teste@postei.pro`
- **Senha:** `teste123`
- **Role:** `user`
- **Payment Status:** `pending`

## ⚠️ Segurança

**IMPORTANTE:** Após criar os usuários:

1. **Remova ou desative a rota `/setup`** em produção
2. **Ou altere o `SETUP_SECRET`** para um valor muito seguro
3. **Não compartilhe a URL** com a chave secreta

## 🔄 Executar Novamente

Se precisar executar novamente, basta acessar a mesma URL. O script verifica se os usuários já existem antes de criar.

## 🆘 Problemas

**Erro: "Chave secreta inválida"**
- Verifique se `SETUP_SECRET` está configurada no Render
- Verifique se está usando o mesmo valor na URL

**Erro: "Cannot find module"**
- Verifique se todas as dependências estão instaladas
- O Render executa `npm install` automaticamente

**Usuários não criados**
- Verifique os logs do Render
- Verifique se `DATABASE_URL` está configurada corretamente

