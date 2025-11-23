# 🔄 Como Migrar Dados do SQLite para PostgreSQL

## 📋 Pré-requisitos

1. ✅ Banco SQLite local existe em `data/database.db`
2. ✅ PostgreSQL configurado no Vercel (ou localmente)
3. ✅ `DATABASE_URL` configurada no `.env` (ou no Vercel)

## 🚀 Passo a Passo

### Opção 1: Migração Local (Recomendado)

1. **Configure o `.env` local:**
   ```env
   DATABASE_URL=postgres://usuario:senha@host:porta/database
   ```
   (Use a Connection String do seu banco no Vercel)

2. **Execute o script de migração:**
   ```bash
   npm run migrate
   ```
   ou
   ```bash
   node migrate-sqlite-to-postgres.js
   ```

3. **Aguarde a migração:**
   - O script vai ler todos os dados do SQLite
   - Inserir no PostgreSQL
   - Mostrar progresso e estatísticas

### Opção 2: Migração no Vercel (via CLI)

1. **Instale o Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Faça login:**
   ```bash
   vercel login
   ```

3. **Execute o script localmente com DATABASE_URL do Vercel:**
   ```bash
   # Pegue a DATABASE_URL do Vercel (Settings → Environment Variables)
   export DATABASE_URL="sua-url-do-vercel"
   npm run migrate
   ```

## 📊 O que é Migrado

- ✅ **Users** - Todos os usuários (admin, users, etc.)
- ✅ **YouTube Configs** - Configurações e tokens de autenticação
- ✅ **Scheduled Videos** - Vídeos agendados
- ✅ **Published Videos** - Vídeos já publicados

## ⚠️ Importante

1. **IDs podem mudar:**
   - PostgreSQL usa SERIAL (auto-increment)
   - Os IDs podem ser diferentes do SQLite
   - Foreign keys são atualizadas automaticamente

2. **Duplicatas são ignoradas:**
   - Se um registro já existe (por username/email único), será ignorado
   - Você pode executar o script múltiplas vezes sem problemas

3. **Backup recomendado:**
   - Faça backup do SQLite antes de migrar
   - Copie o arquivo `data/database.db` para um local seguro

## 🔍 Verificar Migração

Após a migração, você pode verificar:

1. **No Vercel:**
   - Acesse Storage → Seu banco → Data
   - Veja as tabelas e registros

2. **Via código:**
   ```javascript
   const db = require('./database');
   const users = await db.users.getAll();
   console.log('Usuários:', users);
   ```

## 🐛 Problemas Comuns

### Erro: "Tabelas não existem"
**Solução:** Execute o servidor uma vez para criar as tabelas:
```bash
npm start
# Deixe rodar alguns segundos, depois pare (Ctrl+C)
npm run migrate
```

### Erro: "DATABASE_URL não encontrada"
**Solução:** Configure no `.env`:
```env
DATABASE_URL=postgres://...
```

### Erro: "Connection timeout"
**Solução:** Verifique se a `DATABASE_URL` está correta e se o banco está acessível.

## ✅ Após a Migração

1. ✅ Dados migrados com sucesso
2. ✅ Teste o login com seus usuários
3. ✅ Verifique se os vídeos agendados estão lá
4. ✅ Confirme que as configurações do YouTube foram migradas

## 🎉 Pronto!

Seus dados do SQLite agora estão no PostgreSQL e funcionando no Vercel!

