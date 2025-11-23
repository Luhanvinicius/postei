/**
 * Script para inicializar tabelas no PostgreSQL
 * Executa antes da migração
 */

const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL não encontrada no .env!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' || process.env.VERCEL ? { rejectUnauthorized: false } : false,
});

async function initTables() {
  const client = await pool.connect();
  try {
    console.log('🔄 Criando tabelas no PostgreSQL...\n');

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
    console.log('✅ Tabela users criada');

    // Tabela de configurações do YouTube
    await client.query(`
      CREATE TABLE IF NOT EXISTS youtube_configs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        config_path TEXT,
        channel_id TEXT,
        channel_name TEXT,
        is_authenticated INTEGER DEFAULT 0,
        refresh_token TEXT,
        access_token TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        authenticated_at TIMESTAMP,
        default_video_folder TEXT,
        UNIQUE(user_id)
      )
    `);
    console.log('✅ Tabela youtube_configs criada');

    // Tabela de vídeos agendados
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_videos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        video_path TEXT NOT NULL,
        scheduled_time TIMESTAMP NOT NULL,
        title TEXT,
        description TEXT,
        thumbnail_path TEXT,
        status VARCHAR(50) DEFAULT 'pending',
        video_id TEXT,
        error TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        processing_at TIMESTAMP,
        completed_at TIMESTAMP
      )
    `);
    console.log('✅ Tabela scheduled_videos criada');

    // Tabela de vídeos publicados
    await client.query(`
      CREATE TABLE IF NOT EXISTS published_videos (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        video_path TEXT NOT NULL,
        video_id TEXT NOT NULL,
        video_url TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        thumbnail_path TEXT,
        published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ Tabela published_videos criada');

    // Criar usuário admin padrão se não existir
    const adminResult = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (adminResult.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await client.query(
        'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4)',
        ['admin', 'admin@example.com', hashedPassword, 'admin']
      );
      console.log('✅ Usuário admin criado: admin / admin123');
    } else {
      console.log('ℹ️  Usuário admin já existe');
    }

    console.log('\n✅ Todas as tabelas foram criadas com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao criar tabelas:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initTables()
  .then(() => {
    console.log('\n🎉 Inicialização concluída!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Falha na inicialização:', error);
    process.exit(1);
  });

