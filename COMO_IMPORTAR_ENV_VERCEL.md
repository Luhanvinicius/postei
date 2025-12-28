# Como Importar Variáveis de Ambiente no Vercel

## 📋 Passo a Passo

### 1. **Acesse o Vercel Dashboard**
   - https://vercel.com/dashboard
   - Faça login

### 2. **Crie um Novo Projeto ou Edite o Existente**

#### **Opção A: Criar Novo Projeto**
   - Clique em "New Project"
   - Conecte com GitHub
   - Selecione o repositório: `Luhanvinicius/postei`
   - Branch: `main`

#### **Opção B: Editar Projeto Existente**
   - Vá em "Settings" → "Environment Variables"

### 3. **Importe as Variáveis de Ambiente**

#### **Método 1: Importar arquivo .env**
   1. Na página de criação/edição do projeto
   2. Role até a seção "Environment Variables"
   3. Clique em **"Import .env"**
   4. Cole o conteúdo do arquivo `.env.vercel` ou `ENV_VERCEL_COM_VALORES.txt`
   5. Clique em "Import"

#### **Método 2: Adicionar manualmente**
   1. Na seção "Environment Variables"
   2. Para cada variável abaixo, clique em **"+ Add More"**
   3. Adicione Key e Value
   4. Selecione os ambientes: **Production**, **Preview**, **Development**

### 4. **Variáveis Obrigatórias para Adicionar:**

```
DATABASE_URL=postgres://8ef24adb75de8e9bb80012c01dacf72ee18e40c62e78b6cd5df15da79faf08a8:sk_BVLwPIuZCTcqLbczGxs1r@db.prisma.io:5432/postgres?sslmode=require

SESSION_SECRET=GERAR_UM_VALOR_ALEATORIO_AQUI_MINIMO_32_CARACTERES

FRONTEND_URL=https://postei-three.vercel.app

CORS_ORIGIN=https://postei-three.vercel.app

BASE_URL=https://postei-three.vercel.app

NODE_ENV=production
```

### 5. **Variáveis Opcionais (mas recomendadas):**

```
GEMINI_API_KEY=AIzaSyCd2F9N7En-T7uxbSQJRpOKzJcUW...

ASAAS_API_KEY=aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFjOGQyZmYyLWExY2MtNDY0ZC04YzBlLThlMjBlYzM1YWE2NDo6JGFhY2hfMWJmYjE1YTMtMWZkZi00ZTk4LWEzNWEtNmI2ZTJiNjBmNzY3

ASAAS_ENVIRONMENT=sandbox

POSTGRES_URL=postgres://8ef24adb75de8e9bb80012c01dacf72ee18e40c62e78b6cd5df15da79faf08a8:sk_BVLwPIuZCTcqLbczGxs1r@db.prisma.io:5432/postgres?sslmode=require
```

### 6. **⚠️ IMPORTANTE: SESSION_SECRET**

**Você PRECISA gerar um valor aleatório para `SESSION_SECRET`:**

- **Opção 1:** Use este gerador online: https://randomkeygen.com/
  - Escolha "CodeIgniter Encryption Keys"
  - Copie uma das chaves geradas

- **Opção 2:** No terminal (Linux/Mac):
  ```bash
  openssl rand -base64 32
  ```

- **Opção 3:** No PowerShell (Windows):
  ```powershell
  -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | % {[char]$_})
  ```

**Substitua `GERAR_UM_VALOR_ALEATORIO_AQUI_MINIMO_32_CARACTERES` pelo valor gerado!**

### 7. **Finalizar**

1. Após adicionar todas as variáveis
2. Clique em **"Deploy"** (se criando novo projeto)
3. Ou salve as variáveis (se editando projeto existente)
4. Aguarde o deploy (1-2 minutos)

### 8. **Verificar**

Após o deploy:
- Acesse: `https://postei-three.vercel.app/health`
- Deve retornar um JSON com status do servidor
- Se der erro, verifique os logs em: Deployments → Logs

## 📝 Checklist

- [ ] `DATABASE_URL` configurada
- [ ] `SESSION_SECRET` configurada (valor aleatório gerado)
- [ ] `FRONTEND_URL` configurada
- [ ] `CORS_ORIGIN` configurada
- [ ] `BASE_URL` configurada
- [ ] `NODE_ENV` = `production`
- [ ] Variáveis opcionais adicionadas (se necessário)
- [ ] Deploy iniciado

## 🆘 Problemas Comuns

**Erro: "DATABASE_URL não encontrada"**
- Verifique se a variável está configurada
- Verifique se não há espaços extras
- Verifique se está selecionada para "Production"

**Erro: "Internal Server Error"**
- Verifique os logs de runtime
- Verifique se `SESSION_SECRET` foi gerada corretamente
- Verifique se todas as variáveis obrigatórias estão configuradas

