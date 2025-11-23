// Detectar se está no Vercel ou se DATABASE_URL está configurada
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const hasPostgresUrl = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL);

// Usar PostgreSQL se estiver no Vercel ou se DATABASE_URL estiver configurada
if (isVercel || hasPostgresUrl) {
  console.log('📊 Usando PostgreSQL (Vercel/Produção)');
  const pgDb = require('./database-pg');
  
  // Inicializar banco
  pgDb.initDatabase().catch(err => {
    console.error('❌ Erro ao inicializar PostgreSQL:', err);
  });
  
  module.exports = pgDb;
} else {
  // Usar SQLite localmente
  console.log('📊 Usando SQLite (Desenvolvimento Local)');
  
  const Database = require('better-sqlite3');
  const path = require('path');
  const fs = require('fs-extra');

  const DB_PATH = path.join(__dirname, 'data', 'database.db');

  // Garantir que o diretório existe
  fs.ensureDirSync(path.dirname(DB_PATH));

  // Criar conexão com o banco
  const db = new Database(DB_PATH);

  // Habilitar foreign keys
  db.pragma('foreign_keys = ON');

// Criar tabelas
function initDatabase() {
  // Tabela de usuários
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de configurações do YouTube por usuário
  db.exec(`
    CREATE TABLE IF NOT EXISTS youtube_configs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      config_path TEXT NOT NULL,
      channel_id TEXT,
      channel_name TEXT,
      is_authenticated INTEGER DEFAULT 0,
      refresh_token TEXT,
      access_token TEXT,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      authenticated_at DATETIME,
      default_video_folder TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id)
    )
  `);
  
  // Adicionar coluna default_video_folder se não existir (migração)
  try {
    db.exec('ALTER TABLE youtube_configs ADD COLUMN default_video_folder TEXT');
  } catch (e) {
    // Coluna já existe, ignorar erro
  }

  // Tabela de vídeos agendados
  db.exec(`
    CREATE TABLE IF NOT EXISTS scheduled_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      video_path TEXT NOT NULL,
      scheduled_time DATETIME NOT NULL,
      title TEXT,
      description TEXT,
      status TEXT DEFAULT 'pending',
      video_id TEXT,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processing_at DATETIME,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Tabela de vídeos publicados
  db.exec(`
    CREATE TABLE IF NOT EXISTS published_videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      video_path TEXT NOT NULL,
      video_id TEXT NOT NULL,
      video_url TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      thumbnail_path TEXT,
      published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  
  // Adicionar coluna thumbnail_path se não existir (migração)
  try {
    db.exec('ALTER TABLE published_videos ADD COLUMN thumbnail_path TEXT');
  } catch (e) {
    // Coluna já existe, ignorar erro
  }

  // Criar usuário admin padrão se não existir
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (username, email, password, role)
      VALUES (?, ?, ?, ?)
    `).run('admin', 'admin@example.com', hashedPassword, 'admin');
    console.log('✅ Usuário admin criado: admin / admin123');
  }

  console.log('✅ Banco de dados SQLite inicializado');
}

// Inicializar banco
initDatabase();

// Funções para usuários
const userQueries = {
  findByUsername: db.prepare('SELECT * FROM users WHERE username = ? OR email = ?'),
  findByUsernameOnly: db.prepare('SELECT * FROM users WHERE username = ?'),
  findByEmail: db.prepare('SELECT * FROM users WHERE email = ?'),
  findById: db.prepare('SELECT * FROM users WHERE id = ?'),
  create: db.prepare(`
    INSERT INTO users (username, email, password, role)
    VALUES (?, ?, ?, ?)
  `),
  delete: db.prepare('DELETE FROM users WHERE id = ?'),
  getAll: db.prepare('SELECT id, username, email, role, created_at FROM users ORDER BY id')
};

// Funções para configurações do YouTube
const configQueries = {
  findByUserId: db.prepare('SELECT * FROM youtube_configs WHERE user_id = ?'),
  upsert: db.prepare(`
    INSERT INTO youtube_configs (user_id, config_path, uploaded_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      config_path = excluded.config_path,
      uploaded_at = CURRENT_TIMESTAMP,
      is_authenticated = 0,
      channel_id = NULL,
      channel_name = NULL,
      refresh_token = NULL,
      access_token = NULL
  `),
  updateAuth: db.prepare(`
    UPDATE youtube_configs SET
      is_authenticated = ?,
      channel_id = ?,
      channel_name = ?,
      refresh_token = ?,
      access_token = ?,
      authenticated_at = CURRENT_TIMESTAMP
    WHERE user_id = ?
  `),
  updateDefaultFolder: db.prepare(`
    UPDATE youtube_configs SET default_video_folder = ? WHERE user_id = ?
  `),
  upsertDefaultFolder: db.prepare(`
    INSERT INTO youtube_configs (user_id, config_path, default_video_folder)
    VALUES (?, '', ?)
    ON CONFLICT(user_id) DO UPDATE SET default_video_folder = excluded.default_video_folder
  `)
};

// Funções para vídeos agendados
const scheduleQueries = {
  findByUserId: db.prepare('SELECT * FROM scheduled_videos WHERE user_id = ? ORDER BY scheduled_time'),
  findPending: db.prepare(`
    SELECT * FROM scheduled_videos 
    WHERE status = 'pending' 
    ORDER BY scheduled_time
  `),
  create: db.prepare(`
    INSERT INTO scheduled_videos (user_id, video_path, scheduled_time, title, description, thumbnail_path, status)
    VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `),
  updateStatus: db.prepare(`
    UPDATE scheduled_videos SET
      status = ?,
      video_id = ?,
      error = ?,
      processing_at = CASE WHEN ? = 'processing' THEN CURRENT_TIMESTAMP ELSE processing_at END,
      completed_at = CASE WHEN ? = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
    WHERE id = ?
  `)
};

// Funções para vídeos publicados
const publishedQueries = {
  findByUserId: db.prepare('SELECT * FROM published_videos WHERE user_id = ? ORDER BY published_at DESC'),
  create: db.prepare(`
    INSERT INTO published_videos (user_id, video_path, video_id, video_url, title, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `),
  findByVideoId: db.prepare('SELECT * FROM published_videos WHERE video_id = ?')
};

module.exports = {
  db,
  users: {
    findByUsername: (username) => userQueries.findByUsername.get(username, username),
    findByUsernameOnly: (username) => userQueries.findByUsernameOnly.get(username),
    findByEmail: (email) => userQueries.findByEmail.get(email),
    findById: (id) => userQueries.findById.get(id),
    create: (username, email, password, role = 'user') => {
      try {
        const result = userQueries.create.run(username, email, password, role);
        return result.lastInsertRowid;
      } catch (error) {
        // Re-lançar erro para tratamento no controller
        throw error;
      }
    },
    delete: (id) => {
      const result = userQueries.delete.run(id);
      return result.changes > 0; // Retorna true se deletou algo
    },
    getAll: () => userQueries.getAll.all()
  },
  configs: {
    findByUserId: (userId) => configQueries.findByUserId.get(userId),
    upsert: (userId, configPath) => configQueries.upsert.run(userId, configPath),
    updateAuth: (userId, isAuthenticated, channelId, channelName, refreshToken, accessToken) => {
      configQueries.updateAuth.run(
        isAuthenticated ? 1 : 0,
        channelId,
        channelName,
        refreshToken,
        accessToken,
        userId
      );
    },
    updateDefaultFolder: (userId, folderPath) => {
      // Verificar se o usuário tem registro na tabela
      const existing = configQueries.findByUserId.get(userId);
      if (existing) {
        // Atualizar se existir
        configQueries.updateDefaultFolder.run(folderPath || null, userId);
      } else {
        // Criar registro se não existir (com config_path vazio)
        configQueries.upsertDefaultFolder.run(userId, folderPath || null);
      }
    }
  },
  schedules: {
    findByUserId: (userId) => scheduleQueries.findByUserId.all(userId),
    findPending: () => scheduleQueries.findPending.all(),
    create: (userId, videoPath, scheduledTime, title, description, thumbnailPath = null) => {
      const result = scheduleQueries.create.run(userId, videoPath, scheduledTime, title, description, thumbnailPath);
      return result.lastInsertRowid;
    },
    updateStatus: (id, status, videoId = null, error = null) => {
      scheduleQueries.updateStatus.run(status, videoId, error, status, status, id);
    }
  },
  published: {
    findByUserId: (userId) => publishedQueries.findByUserId.all(userId),
    create: (userId, videoPath, videoId, videoUrl, title, description) => {
      publishedQueries.create.run(userId, videoPath, videoId, videoUrl, title, description);
    },
    findByVideoId: (videoId) => publishedQueries.findByVideoId.get(videoId)
  }
  };

  module.exports = {
    db,
    users: {
      findByUsername: (username) => userQueries.findByUsername.get(username, username),
      findByUsernameOnly: (username) => userQueries.findByUsernameOnly.get(username),
      findByEmail: (email) => userQueries.findByEmail.get(email),
      findById: (id) => userQueries.findById.get(id),
      create: (username, email, password, role = 'user') => {
        try {
          const result = userQueries.create.run(username, email, password, role);
          return result.lastInsertRowid;
        } catch (error) {
          throw error;
        }
      },
      delete: (id) => {
        const result = userQueries.delete.run(id);
        return result.changes > 0;
      },
      getAll: () => userQueries.getAll.all()
    },
    configs: {
      findByUserId: (userId) => configQueries.findByUserId.get(userId),
      upsert: (userId, configPath) => configQueries.upsert.run(userId, configPath),
      updateAuth: (userId, isAuthenticated, channelId, channelName, refreshToken, accessToken) => {
        configQueries.updateAuth.run(
          isAuthenticated ? 1 : 0,
          channelId,
          channelName,
          refreshToken,
          accessToken,
          userId
        );
      },
      updateDefaultFolder: (userId, folderPath) => {
        const existing = configQueries.findByUserId.get(userId);
        if (existing) {
          configQueries.updateDefaultFolder.run(folderPath || null, userId);
        } else {
          configQueries.upsertDefaultFolder.run(userId, folderPath || null);
        }
      }
    },
    schedules: {
      findByUserId: (userId) => scheduleQueries.findByUserId.all(userId),
      findPending: () => scheduleQueries.findPending.all(),
      create: (userId, videoPath, scheduledTime, title, description) => {
        const result = scheduleQueries.create.run(userId, videoPath, scheduledTime, title, description);
        return result.lastInsertRowid;
      },
      updateStatus: (id, status, videoId = null, error = null) => {
        scheduleQueries.updateStatus.run(status, videoId, error, status, status, id);
      }
    },
    published: {
      findByUserId: (userId) => publishedQueries.findByUserId.all(userId),
      create: (userId, videoPath, videoId, videoUrl, title, description, thumbnailPath = null) => {
        publishedQueries.create.run(userId, videoPath, videoId, videoUrl, title, description, thumbnailPath);
      },
      findByVideoId: (videoId) => publishedQueries.findByVideoId.get(videoId)
    }
  };
}

