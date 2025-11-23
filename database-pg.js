const { Pool } = require('pg');
require('dotenv').config();

// Usar DATABASE_URL ou POSTGRES_URL (Vercel pode usar qualquer uma)
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL não encontrada nas variáveis de ambiente!');
  throw new Error('DATABASE_URL é obrigatória');
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' || process.env.VERCEL ? { rejectUnauthorized: false } : false,
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Testar conexão
pool.on('connect', () => {
  console.log('✅ Conectado ao PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no PostgreSQL:', err);
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
    }

    console.log('✅ Banco de dados PostgreSQL inicializado');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Funções para usuários
const userQueries = {
  findByUsername: async (username) => {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1 OR email = $1',
      [username]
    );
    return result.rows[0] || null;
  },
  
  findByUsernameOnly: async (username) => {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return result.rows[0] || null;
  },
  
  findByEmail: async (email) => {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  },
  
  findById: async (id) => {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  create: async (username, email, password, role = 'user') => {
    try {
      const result = await pool.query(
        'INSERT INTO users (username, email, password, role) VALUES ($1, $2, $3, $4) RETURNING id',
        [username, email, password, role]
      );
      return result.rows[0].id;
    } catch (error) {
      throw error;
    }
  },
  
  delete: async (id) => {
    const result = await pool.query('DELETE FROM users WHERE id = $1', [id]);
    return result.rowCount > 0;
  },
  
  getAll: async () => {
    const result = await pool.query('SELECT id, username, email, role, created_at FROM users ORDER BY id');
    return result.rows;
  }
};

// Funções para configurações do YouTube
const configQueries = {
  findByUserId: async (userId) => {
    const result = await pool.query('SELECT * FROM youtube_configs WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  },
  
  upsert: async (userId, configPath) => {
    await pool.query(`
      INSERT INTO youtube_configs (user_id, config_path, uploaded_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id) DO UPDATE SET
        config_path = EXCLUDED.config_path,
        uploaded_at = CURRENT_TIMESTAMP,
        is_authenticated = 0,
        channel_id = NULL,
        channel_name = NULL,
        refresh_token = NULL,
        access_token = NULL
    `, [userId, configPath]);
  },
  
  updateAuth: async (userId, isAuthenticated, channelId, channelName, refreshToken, accessToken) => {
    await pool.query(`
      UPDATE youtube_configs SET
        is_authenticated = $1,
        channel_id = $2,
        channel_name = $3,
        refresh_token = $4,
        access_token = $5,
        authenticated_at = CURRENT_TIMESTAMP
      WHERE user_id = $6
    `, [
      isAuthenticated ? 1 : 0,
      channelId,
      channelName,
      refreshToken,
      accessToken,
      userId
    ]);
  },
  
  updateDefaultFolder: async (userId, folderPath) => {
    const existing = await configQueries.findByUserId(userId);
    if (existing) {
      await pool.query(
        'UPDATE youtube_configs SET default_video_folder = $1 WHERE user_id = $2',
        [folderPath || null, userId]
      );
    } else {
      await pool.query(`
        INSERT INTO youtube_configs (user_id, config_path, default_video_folder)
        VALUES ($1, '', $2)
        ON CONFLICT (user_id) DO UPDATE SET default_video_folder = EXCLUDED.default_video_folder
      `, [userId, folderPath || null]);
    }
  }
};

// Funções para vídeos agendados
const scheduleQueries = {
  findByUserId: async (userId) => {
    const result = await pool.query(
      'SELECT * FROM scheduled_videos WHERE user_id = $1 ORDER BY scheduled_time',
      [userId]
    );
    return result.rows;
  },
  
  findPending: async () => {
    const result = await pool.query(`
      SELECT * FROM scheduled_videos 
      WHERE status = 'pending' 
      ORDER BY scheduled_time
    `);
    return result.rows;
  },
  
  create: async (userId, videoPath, scheduledTime, title, description, thumbnailPath = null) => {
    const result = await pool.query(`
      INSERT INTO scheduled_videos (user_id, video_path, scheduled_time, title, description, thumbnail_path, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'pending')
      RETURNING id
    `, [userId, videoPath, scheduledTime, title, description, thumbnailPath]);
    return result.rows[0].id;
  },
  
  updateStatus: async (id, status, videoId = null, error = null) => {
    await pool.query(`
      UPDATE scheduled_videos SET
        status = $1,
        video_id = $2,
        error = $3,
        processing_at = CASE WHEN $1 = 'processing' THEN CURRENT_TIMESTAMP ELSE processing_at END,
        completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE id = $4
    `, [status, videoId, error, id]);
  }
};

// Funções para vídeos publicados
const publishedQueries = {
  findByUserId: async (userId) => {
    const result = await pool.query(
      'SELECT * FROM published_videos WHERE user_id = $1 ORDER BY published_at DESC',
      [userId]
    );
    return result.rows;
  },
  
  create: async (userId, videoPath, videoId, videoUrl, title, description, thumbnailPath = null) => {
    await pool.query(`
      INSERT INTO published_videos (user_id, video_path, video_id, video_url, title, description, thumbnail_path)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [userId, videoPath, videoId, videoUrl, title, description, thumbnailPath]);
  },
  
  findByVideoId: async (videoId) => {
    const result = await pool.query('SELECT * FROM published_videos WHERE video_id = $1', [videoId]);
    return result.rows[0] || null;
  }
};

// Inicializar banco
let initPromise = null;
function ensureInitialized() {
  if (!initPromise) {
    initPromise = initDatabase();
  }
  return initPromise;
}

module.exports = {
  pool,
  initDatabase: ensureInitialized,
  users: userQueries,
  configs: configQueries,
  schedules: scheduleQueries,
  published: publishedQueries
};

