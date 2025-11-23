# 🚀 Como Configurar o Deploy no Vercel

## 📋 Passo a Passo na Tela de Importação

### 1. **Project Name** ✅
- Já está configurado: `postei`
- Pode deixar assim

### 2. **Framework Preset** ✅
- Já está configurado: `Express`
- Está correto!

### 3. **Root Directory** ✅
- Já está configurado: `./`
- Se o projeto está na raiz do repositório, está correto
- Se estiver em uma subpasta (ex: `youtube-automation-node`), mude para: `youtube-automation-node`

### 4. **Environment Variables** ⚠️ IMPORTANTE

Adicione as seguintes variáveis de ambiente:

#### Variáveis Obrigatórias:

1. **SESSION_SECRET**
   - **Key:** `SESSION_SECRET`
   - **Value:** Gere uma chave aleatória (veja abaixo como gerar)
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development

2. **GEMINI_API_KEY**
   - **Key:** `GEMINI_API_KEY`
   - **Value:** `AIzaSyCd2F9N7En-T7uxbSQJRpOKzJcUW73fxUU` (sua chave do Gemini)
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development

3. **NODE_ENV**
   - **Key:** `NODE_ENV`
   - **Value:** `production`
   - **Environments:** ✅ Production

#### Variáveis do Banco de Dados (Já configuradas automaticamente):

- `DATABASE_URL` - Já configurada pelo Prisma Postgres
- `POSTGRES_URL` - Já configurada pelo Prisma Postgres
- `PRISMA_DATABASE_URL` - Já configurada pelo Prisma Postgres

**⚠️ NÃO precisa adicionar essas manualmente!** Elas já foram criadas quando você criou o banco no Vercel.

### 5. **Build and Output Settings** (Opcional)

Se quiser ajustar:
- **Build Command:** Deixe vazio (não precisa build)
- **Output Directory:** Deixe vazio
- **Install Command:** `npm install`

### 6. **Deploy** 🚀

Clique no botão **"Deploy"** e aguarde!

## 🔑 Como Gerar SESSION_SECRET

Execute no terminal:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Ou use este valor de exemplo (mas é melhor gerar um novo):
```
859ccf81c6ebc0251e9ab411a069544851472e140572898c2c9ec4c0d29fba02
```

## ✅ Checklist Antes de Deployar

- [ ] Project Name configurado
- [ ] Framework Preset: Express
- [ ] Root Directory correto
- [ ] SESSION_SECRET adicionada
- [ ] GEMINI_API_KEY adicionada
- [ ] NODE_ENV = production (opcional)
- [ ] DATABASE_URL já existe (criada automaticamente)

## 🎯 Depois do Deploy

1. **Aguarde o deploy terminar** (2-5 minutos)
2. **Acesse a URL** fornecida pelo Vercel
3. **Teste o login:**
   - Usuário: `admin`
   - Senha: `admin123`
4. **Verifique os logs** se houver erros

## 🐛 Problemas Comuns

### Erro: "Cannot find module 'pg'"
- **Solução:** Certifique-se que `pg` está no `package.json` (já está ✅)

### Erro: "DATABASE_URL not found"
- **Solução:** Verifique se o banco foi criado no Vercel Storage

### Erro: "Module not found"
- **Solução:** Verifique se o Root Directory está correto

## 📝 Notas Importantes

- O banco de dados será criado automaticamente na primeira requisição
- As tabelas serão criadas automaticamente
- O usuário admin será criado automaticamente (`admin` / `admin123`)

