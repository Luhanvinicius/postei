// Detectar se está no Vercel ou se DATABASE_URL está configurada
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const hasPostgresUrl = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL);

// Usar PostgreSQL se estiver no Vercel ou se DATABASE_URL estiver configurada
if (isVercel || hasPostgresUrl) {
  const dbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL;
  const isLocalhost = dbUrl && (dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1'));
  
  if (isVercel) {
    console.log('📊 Usando PostgreSQL (Vercel/Produção)');
  } else if (isLocalhost) {
    console.log('📊 Usando PostgreSQL (Local)');
  } else {
    console.log('📊 Usando PostgreSQL (URL configurada)');
  }
  
  const pgDb = require('./database-pg');
  
  // Inicializar banco
  pgDb.initDatabase().catch(err => {
    console.error('❌ Erro ao inicializar PostgreSQL:', err);
  });
  
  module.exports = pgDb;
} else {
  // Usar SQLite localmente
  console.log('📊 Usando SQLite (Desenvolvimento Local)');
  
  let Database;
  try {
    Database = require('better-sqlite3');
  } catch (err) {
    console.error('❌ better-sqlite3 não encontrado.');
    console.error('   Para desenvolvimento local: npm install better-sqlite3');
    console.error('   Para produção (Render/Vercel): Configure DATABASE_URL para usar PostgreSQL');
    throw new Error('better-sqlite3 não está instalado. Para desenvolvimento local, execute: npm install better-sqlite3. Para produção, configure DATABASE_URL.');
  }
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
      payment_status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Adicionar coluna payment_status se não existir (migração)
  try {
    db.exec('ALTER TABLE users ADD COLUMN payment_status TEXT DEFAULT \'pending\'');
  } catch (e) {
    // Coluna já existe, ignorar erro
  }

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

  // Tabela de planos
  db.exec(`
    CREATE TABLE IF NOT EXISTS plans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      price REAL NOT NULL,
      billing_period TEXT DEFAULT 'monthly',
      max_videos INTEGER,
      max_channels INTEGER,
      features TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de assinaturas
  db.exec(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      plan_id INTEGER NOT NULL,
      status TEXT DEFAULT 'active',
      asaas_subscription_id TEXT,
      current_period_start DATETIME,
      current_period_end DATETIME,
      canceled_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    )
  `);

  // Tabela de faturas
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subscription_id INTEGER,
      plan_id INTEGER NOT NULL,
      asaas_invoice_id TEXT UNIQUE,
      invoice_number TEXT,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_method TEXT,
      pix_qr_code TEXT,
      pix_copy_paste TEXT,
      due_date DATE,
      paid_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (subscription_id) REFERENCES subscriptions(id),
      FOREIGN KEY (plan_id) REFERENCES plans(id)
    )
  `);

  // Inserir planos padrão se não existirem
  const plansCheck = db.prepare('SELECT COUNT(*) as count FROM plans').get();
  if (plansCheck.count === 0) {
    db.exec(`
      INSERT INTO plans (name, slug, price, billing_period, max_videos, max_channels, features) VALUES
      ('Básico', 'basico', 29.00, 'monthly', 50, 1, '["Até 50 vídeos/mês", "Geração de conteúdo com IA", "Thumbnails automáticos", "Agendamento de vídeos", "1 canal do YouTube"]'),
      ('Profissional', 'profissional', 79.00, 'monthly', 200, 3, '["Até 200 vídeos/mês", "Geração de conteúdo com IA", "Thumbnails automáticos", "Agendamento ilimitado", "Até 3 canais do YouTube", "Suporte prioritário"]'),
      ('Enterprise', 'enterprise', 199.00, 'monthly', NULL, NULL, '["Vídeos ilimitados", "Geração de conteúdo com IA", "Thumbnails automáticos", "Agendamento ilimitado", "Canais ilimitados", "Suporte 24/7", "API personalizada"]')
    `);
    console.log('✅ Planos padrão criados');
  }

  // Criar usuário admin padrão se não existir
  const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO users (username, email, password, role, payment_status)
      VALUES (?, ?, ?, ?, ?)
    `).run('admin', 'admin@example.com', hashedPassword, 'admin', 'paid');
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
    INSERT INTO users (username, email, password, role, payment_status)
    VALUES (?, ?, ?, ?, 'pending')
  `),
  delete: db.prepare('DELETE FROM users WHERE id = ?'),
  getAll: db.prepare('SELECT id, username, email, role, created_at FROM users ORDER BY id'),
  updateRole: db.prepare('UPDATE users SET role = ? WHERE id = ?'),
  updatePassword: db.prepare('UPDATE users SET password = ? WHERE id = ?')
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
    INSERT INTO published_videos (user_id, video_path, video_id, video_url, title, description, thumbnail_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  findByVideoId: db.prepare('SELECT * FROM published_videos WHERE video_id = ?'),
  findById: db.prepare('SELECT * FROM published_videos WHERE id = ?'),
  delete: db.prepare('DELETE FROM published_videos WHERE id = ?'),
  findAll: db.prepare(`
    SELECT pv.*, u.username, u.email
    FROM published_videos pv
    JOIN users u ON pv.user_id = u.id
    ORDER BY pv.published_at DESC
  `)
};

// Funções para planos
const planQueries = {
  findAll: db.prepare('SELECT * FROM plans WHERE is_active = 1 ORDER BY price'),
  findBySlug: db.prepare('SELECT * FROM plans WHERE slug = ? AND is_active = 1'),
  findById: db.prepare('SELECT * FROM plans WHERE id = ?')
};

// Funções para assinaturas
const subscriptionQueries = {
  findByUserId: db.prepare(`
    SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.price, p.max_videos, p.max_channels
    FROM subscriptions s
    JOIN plans p ON s.plan_id = p.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
    LIMIT 1
  `),
  create: db.prepare(`
    INSERT INTO subscriptions (user_id, plan_id, asaas_subscription_id, current_period_start, current_period_end, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `),
  updateStatus: db.prepare('UPDATE subscriptions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  findAll: db.prepare(`
    SELECT s.*, u.username, u.email, p.name as plan_name, p.price
    FROM subscriptions s
    JOIN users u ON s.user_id = u.id
    JOIN plans p ON s.plan_id = p.id
    ORDER BY s.created_at DESC
  `)
};

// Funções para faturas
const invoiceQueries = {
  findByUserId: db.prepare(`
    SELECT i.*, p.name as plan_name, p.slug as plan_slug
    FROM invoices i
    JOIN plans p ON i.plan_id = p.id
    WHERE i.user_id = ?
    ORDER BY i.created_at DESC
  `),
  create: db.prepare(`
    INSERT INTO invoices (user_id, subscription_id, plan_id, amount, asaas_invoice_id, invoice_number, due_date, pix_qr_code, pix_copy_paste, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `),
  findByAsaasId: db.prepare('SELECT * FROM invoices WHERE asaas_invoice_id = ?'),
  updateStatus: db.prepare('UPDATE invoices SET status = ?, paid_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'),
  findAll: db.prepare(`
    SELECT i.*, u.username, u.email, p.name as plan_name, p.slug as plan_slug
    FROM invoices i
    JOIN users u ON i.user_id = u.id
    JOIN plans p ON i.plan_id = p.id
    ORDER BY i.created_at DESC
  `),
  findById: db.prepare(`
    SELECT i.*, u.username, u.email, p.name as plan_name, p.slug as plan_slug
    FROM invoices i
    JOIN users u ON i.user_id = u.id
    JOIN plans p ON i.plan_id = p.id
    WHERE i.id = ?
  `)
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
    getAll: () => userQueries.getAll.all(),
    updateRole: (id, role) => {
      const result = userQueries.updateRole.run(role, id);
      return result.changes > 0;
    },
    updatePassword: (id, hashedPassword) => {
      const result = userQueries.updatePassword.run(hashedPassword, id);
      return result.changes > 0;
    },
    updatePaymentStatus: (id, status) => {
      const result = userQueries.updatePaymentStatus.run(status, id);
      return result.changes > 0;
    }
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
      getAll: () => userQueries.getAll.all(),
      updateRole: (id, role) => {
        const result = userQueries.updateRole.run(role, id);
        return result.changes > 0;
      },
      updatePassword: (id, hashedPassword) => {
        const result = userQueries.updatePassword.run(hashedPassword, id);
        return result.changes > 0;
      }
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
      findByVideoId: (videoId) => publishedQueries.findByVideoId.get(videoId),
      findById: (id) => publishedQueries.findById.get(id),
      delete: (id) => {
        const result = publishedQueries.delete.run(id);
        return result.changes > 0;
      },
      findAll: () => publishedQueries.findAll.all()
    },
    plans: {
      findAll: () => planQueries.findAll.all(),
      findBySlug: (slug) => planQueries.findBySlug.get(slug),
      findById: (id) => planQueries.findById.get(id)
    },
    subscriptions: {
      findByUserId: (userId) => subscriptionQueries.findByUserId.get(userId),
      create: (userId, planId, asaasSubscriptionId = null) => {
        const periodStart = new Date();
        const periodEnd = new Date();
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        const result = subscriptionQueries.create.run(userId, planId, asaasSubscriptionId, periodStart.toISOString(), periodEnd.toISOString());
        return result.lastInsertRowid;
      },
      updateStatus: (id, status) => subscriptionQueries.updateStatus.run(status, id),
      findAll: () => subscriptionQueries.findAll.all()
    },
    invoices: {
      findByUserId: (userId) => invoiceQueries.findByUserId.all(userId),
      create: (userId, planId, subscriptionId, amount, asaasInvoiceId, invoiceNumber, dueDate, pixQrCode = null, pixCopyPaste = null) => {
        const result = invoiceQueries.create.run(userId, subscriptionId, planId, amount, asaasInvoiceId, invoiceNumber, dueDate, pixQrCode, pixCopyPaste);
        return result.lastInsertRowid;
      },
      findByAsaasId: (asaasInvoiceId) => invoiceQueries.findByAsaasId.get(asaasInvoiceId),
      updateStatus: (id, status, paidAt = null) => invoiceQueries.updateStatus.run(status, paidAt, id),
      findAll: () => invoiceQueries.findAll.all(),
      findById: (id) => invoiceQueries.findById.get(id)
    }
  };
}

