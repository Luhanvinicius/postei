# 🚀 Quick Start - PostgreSQL Local

## Passo 1: Instalar PostgreSQL

**Windows:**
- Baixe: https://www.postgresql.org/download/windows/
- Durante instalação, anote a senha do usuário `postgres`

## Passo 2: Criar Banco de Dados

Abra o **psql** ou **pgAdmin** e execute:

```sql
CREATE DATABASE youtube_automation;
```

## Passo 3: Criar arquivo .env

Na pasta `youtube-automation-node/`, crie um arquivo `.env`:

```env
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/youtube_automation
SESSION_SECRET=859ccf81c6ebc0251e9ab411a069544851472e140572898c2c9ec4c0d29fba02
GEMINI_API_KEY=sua-chave-gemini-aqui
```

**⚠️ IMPORTANTE:** Substitua `SUA_SENHA` pela senha do PostgreSQL que você configurou!

## Passo 4: Inicializar Tabelas

```bash
npm run init-db
```

Você deve ver:
```
✅ Tabela users criada
✅ Tabela youtube_configs criada
✅ Tabela scheduled_videos criada
✅ Tabela published_videos criada
✅ Usuário admin criado: admin / admin123
```

## Passo 5: Rodar o Servidor

```bash
npm start
```

Ou em modo desenvolvimento:

```bash
npm run dev
```

## Passo 6: Testar

1. Acesse: http://localhost:3000
2. Faça login: `admin` / `admin123`
3. Navegue pelas páginas - deve funcionar normalmente!

## Verificar Dados no PostgreSQL

### Via psql:
```bash
psql -U postgres -d youtube_automation
```

Depois execute:
```sql
SELECT * FROM users;
SELECT * FROM youtube_configs;
```

### Via pgAdmin:
1. Abra pgAdmin
2. Conecte ao servidor
3. Databases → youtube_automation → Schemas → public → Tables
4. Clique com botão direito em uma tabela → View/Edit Data → All Rows

## Voltar para SQLite

Se quiser voltar a usar SQLite:

1. Remova ou comente a linha `DATABASE_URL` no `.env`
2. Reinicie o servidor

## Problemas Comuns

### "password authentication failed"
- Verifique se a senha no `DATABASE_URL` está correta
- Tente resetar a senha do PostgreSQL

### "database does not exist"
- Certifique-se de que criou o banco `youtube_automation`
- Verifique o nome no `DATABASE_URL`

### "connection refused"
- Verifique se o PostgreSQL está rodando
- Windows: Services → PostgreSQL → Iniciar

### "relation does not exist"
- Execute `npm run init-db` novamente

