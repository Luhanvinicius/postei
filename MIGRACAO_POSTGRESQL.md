# 🔄 Migração de SQLite para PostgreSQL

Este guia explica como migrar o projeto de SQLite para PostgreSQL para funcionar no Vercel.

## ⚠️ Por que migrar?

- SQLite não funciona bem no Vercel (serverless)
- PostgreSQL é suportado nativamente
- Melhor performance e escalabilidade
- Dados persistentes

## 📦 Opções de PostgreSQL Gratuito

### 1. Supabase (Recomendado)
- **Grátis até 500MB**
- **URL**: https://supabase.com
- **Setup**: 5 minutos
- **Inclui**: Dashboard, backups automáticos

### 2. Neon
- **Grátis até 512MB**
- **URL**: https://neon.tech
- **Setup**: 3 minutos
- **Inclui**: Branching de banco de dados

### 3. Railway
- **Grátis com créditos**
- **URL**: https://railway.app
- **Setup**: 5 minutos

## 🔧 Passos para Migração

### 1. Instalar dependências

```bash
npm install pg
# ou
npm install postgres
```

### 2. Criar arquivo de conexão

Crie `database-pg.js`:

```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Criar tabelas
async function initDatabase() {
  const client = await pool.connect();
  try {
    // Tabela de usuários
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de configurações do YouTube
    await client.query(`
      CREATE TABLE IF NOT EXISTS youtube_configs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        client_secrets_path TEXT,
        access_token TEXT,
        refresh_token TEXT,
        channel_id TEXT,
        channel_name TEXT,
        default_video_folder TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de vídeos agendados
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_videos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        video_path TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        thumbnail_path TEXT,
        scheduled_time TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de vídeos publicados
    await client.query(`
      CREATE TABLE IF NOT EXISTS published_videos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        video_path TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        thumbnail_path TEXT,
        youtube_video_id TEXT,
        youtube_url TEXT,
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✅ Banco de dados PostgreSQL inicializado');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pool,
  initDatabase
};
```

### 3. Atualizar `database.js`

Substitua as funções SQLite por PostgreSQL:

```javascript
const { pool } = require('./database-pg');

const userQueries = {
  findByUsername: async (username) => {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    return result.rows[0];
  },
  
  findById: async (id) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  },
  
  create: async (username, email, password, role) => {
    const result = await pool.query(
      'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
      [username, email, password, role || 'user']
    );
    return result.rows[0].id;
  },
  
  // ... outras funções
};
```

### 4. Adicionar variável de ambiente

No `.env`:
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

No Vercel, adicione `DATABASE_URL` nas variáveis de ambiente.

### 5. Atualizar `server.js`

```javascript
const { initDatabase } = require('./database-pg');

// Inicializar banco de dados
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
  });
});
```

## 📊 Migração de Dados (Opcional)

Se você já tem dados no SQLite:

```javascript
const Database = require('better-sqlite3');
const { pool } = require('./database-pg');

const sqlite = new Database('database.db');

// Migrar usuários
const users = sqlite.prepare('SELECT * FROM users').all();
for (const user of users) {
  await pool.query(
    'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
    [user.username, user.email, user.password, user.role]
  );
}

// Migrar outras tabelas...
```

## ✅ Testar

1. Configure o `DATABASE_URL`
2. Execute `npm start`
3. Verifique se as tabelas foram criadas
4. Teste criar um usuário

## 🚀 Deploy no Vercel

1. Adicione `DATABASE_URL` nas variáveis de ambiente do Vercel
2. Faça o deploy
3. Verifique os logs para confirmar a conexão

## 📚 Recursos

- [Documentação PostgreSQL](https://www.postgresql.org/docs/)
- [Node Postgres](https://node-postgres.com/)
- [Supabase Docs](https://supabase.com/docs)

