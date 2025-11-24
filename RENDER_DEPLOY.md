# 🚀 Deploy no Render

## ⚠️ Problema com better-sqlite3

O `better-sqlite3` não compila no Render com Node.js 25 porque requer C++20. 

**Solução:** Use PostgreSQL no Render (já está configurado automaticamente).

## ✅ Configuração no Render

### 1. Variáveis de Ambiente

No Render, adicione estas variáveis de ambiente:

1. **DATABASE_URL**
   - Crie um banco PostgreSQL no Render
   - Copie a Connection String
   - Adicione como variável de ambiente

2. **SESSION_SECRET**
   - Gere com: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - Adicione como variável de ambiente

3. **GEMINI_API_KEY**
   - Sua chave do Gemini
   - Adicione como variável de ambiente

### 2. Node.js Version

No Render, configure para usar Node.js 18 ou 20 (não 25):

- Vá em **Settings** → **Build & Deploy**
- **Node Version**: `18` ou `20`

Ou adicione no `package.json` (já está configurado):
```json
"engines": {
  "node": ">=18.0.0 <=22.0.0"
}
```

### 3. Build Command

- **Build Command**: Deixe vazio ou `npm install`
- **Start Command**: `npm start`

### 4. Inicializar Banco de Dados

Após o primeiro deploy, execute:

```bash
npm run init-db
```

Ou acesse o shell do Render e execute:
```bash
node init-postgres.js
```

## 📋 Checklist

- [ ] PostgreSQL criado no Render
- [ ] `DATABASE_URL` configurada nas variáveis de ambiente
- [ ] `SESSION_SECRET` configurada
- [ ] `GEMINI_API_KEY` configurada
- [ ] Node.js version: 18 ou 20 (não 25)
- [ ] Banco inicializado (`npm run init-db`)

## 🔍 Verificar se está funcionando

1. Acesse a URL do Render
2. Faça login com `admin` / `admin123`
3. Verifique os logs - deve aparecer: `📊 Usando PostgreSQL (URL configurada)`

## ⚠️ Nota sobre better-sqlite3

O `better-sqlite3` foi removido das dependências principais porque:
- Não compila no Render/Vercel com Node.js 25
- Não é necessário em produção (usamos PostgreSQL)
- Pode ser instalado localmente se necessário: `npm install better-sqlite3`

