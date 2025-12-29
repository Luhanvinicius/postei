const { Pool } = require('pg');
require('dotenv').config();

// Usar DATABASE_URL (prioridade) ou POSTGRES_URL
// IMPORTANTE: PRISMA_DATABASE_URL não funciona diretamente com pg
// Use sempre DATABASE_URL ou POSTGRES_URL
let connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL não encontrada nas variáveis de ambiente!');
  console.error('📋 Variáveis de ambiente disponíveis relacionadas a banco:');
  const dbVars = Object.keys(process.env).filter(k => 
    k.includes('DATABASE') || k.includes('POSTGRES') || k.includes('PRISMA')
  );
  if (dbVars.length > 0) {
    dbVars.forEach(key => {
      const value = process.env[key];
      console.error(`  - ${key}: ${value ? value.substring(0, 30) + '...' : '(vazia)'}`);
    });
  } else {
    console.error('  Nenhuma variável de banco encontrada!');
  }
  console.error('');
  
  // Detectar plataforma
  const isRailway = process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID;
  const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
  
  console.error('🔧 SOLUÇÃO:');
  if (isRailway) {
    console.error('  1. Vá em Railway → Seu Projeto → Variables');
    console.error('  2. Clique em "New Variable"');
    console.error('  3. Nome: DATABASE_URL');
    console.error('  4. Valor: A Connection String do seu banco PostgreSQL');
    console.error('  5. Para criar um banco PostgreSQL no Railway:');
    console.error('     - Vá em "New" → "Database" → "Add PostgreSQL"');
    console.error('     - Depois vá em "Variables" e copie o valor de DATABASE_URL');
    throw new Error('DATABASE_URL é obrigatória. Configure no Railway: Variables → New Variable');
  } else if (isVercel) {
    console.error('  1. Vá em Vercel → Settings → Environment Variables');
    console.error('  2. Adicione DATABASE_URL com a Connection String do seu banco');
    console.error('  3. A Connection String está em: Storage → Seu Banco → Settings');
    throw new Error('DATABASE_URL é obrigatória. Configure no Vercel: Settings → Environment Variables');
  } else {
    console.error('  1. Configure DATABASE_URL nas variáveis de ambiente');
    console.error('  2. Formato: postgresql://usuario:senha@host:porta/database');
    throw new Error('DATABASE_URL é obrigatória. Configure a variável de ambiente DATABASE_URL');
  }
}

// Validar formato da URL
if (!connectionString.startsWith('postgres://') && !connectionString.startsWith('postgresql://')) {
  console.error('❌ DATABASE_URL inválida! Deve começar com postgres:// ou postgresql://');
  console.error('URL recebida:', connectionString.substring(0, 50) + '...');
  throw new Error('DATABASE_URL deve ser uma URL PostgreSQL válida (postgres://...)');
}

console.log('✅ DATABASE_URL encontrada e válida');
console.log('📍 URL do banco:', connectionString.replace(/:[^:@]+@/, ':****@')); // Ocultar senha nos logs

// Detectar se é local ou produção
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

const pool = new Pool({
  connectionString: connectionString,
  // SSL apenas se NÃO for localhost (para funcionar com Vercel/Neon/Supabase)
  ssl: !isLocalhost ? { rejectUnauthorized: false } : false,
  max: 20, // Máximo de conexões no pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Aumentado para 10 segundos
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
  let client;
  try {
    console.log('🔄 Tentando conectar ao PostgreSQL...');
    console.log('📍 Ambiente:', process.env.VERCEL ? 'Vercel' : process.env.RAILWAY_ENVIRONMENT ? 'Railway' : 'Local');
    console.log('📍 Pool config:', {
      max: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount
    });
    console.log('📍 Connection String (oculto):', connectionString ? connectionString.substring(0, 20) + '...' : 'NÃO CONFIGURADA');
    console.log('📍 DATABASE_URL configurada:', !!process.env.DATABASE_URL);
    console.log('📍 POSTGRES_URL configurada:', !!process.env.POSTGRES_URL);
    
    // Tentar conectar com timeout
    const connectPromise = pool.connect();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout ao conectar ao PostgreSQL (10s)')), 10000)
    );
    
    client = await Promise.race([connectPromise, timeoutPromise]);
    console.log('✅ Conexão com PostgreSQL estabelecida');
    // Tabela de usuários
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        payment_status VARCHAR(50) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Adicionar coluna payment_status se não existir (migração)
    try {
      await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT \'pending\'');
    } catch (e) {
      // Coluna já existe, ignorar erro
    }

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

    // Tabela de planos
    await client.query(`
      CREATE TABLE IF NOT EXISTS plans (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) UNIQUE NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        billing_period VARCHAR(20) DEFAULT 'monthly',
        max_videos INTEGER,
        max_channels INTEGER,
        features JSONB,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de assinaturas
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_id INTEGER NOT NULL REFERENCES plans(id),
        status VARCHAR(50) DEFAULT 'active',
        asaas_subscription_id VARCHAR(255),
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        canceled_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de faturas
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subscription_id INTEGER REFERENCES subscriptions(id),
        plan_id INTEGER NOT NULL REFERENCES plans(id),
        asaas_invoice_id VARCHAR(255) UNIQUE,
        invoice_number VARCHAR(100),
        amount DECIMAL(10,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        payment_method VARCHAR(50),
        pix_qr_code TEXT,
        pix_copy_paste TEXT,
        due_date DATE,
        paid_at TIMESTAMP,
        customer_name VARCHAR(255),
        customer_cpf VARCHAR(20),
        customer_phone VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Adicionar colunas de dados do cliente se não existirem (migração)
    try {
      await client.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_name VARCHAR(255)');
    } catch (e) {
      // Coluna já existe, ignorar erro
    }
    try {
      await client.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_cpf VARCHAR(20)');
    } catch (e) {
      // Coluna já existe, ignorar erro
    }
    try {
      await client.query('ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20)');
    } catch (e) {
      // Coluna já existe, ignorar erro
    }

    // Inserir planos padrão se não existirem
    const plansCheck = await client.query('SELECT COUNT(*) FROM plans');
    if (parseInt(plansCheck.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO plans (name, slug, price, billing_period, max_videos, max_channels, features) VALUES
        ('Básico', 'basico', 29.00, 'monthly', 50, 1, '["Até 50 vídeos/mês", "Geração de conteúdo com IA", "Thumbnails automáticos", "Agendamento de vídeos", "1 canal do YouTube"]'::jsonb),
        ('Profissional', 'profissional', 79.00, 'monthly', 200, 3, '["Até 200 vídeos/mês", "Geração de conteúdo com IA", "Thumbnails automáticos", "Agendamento ilimitado", "Até 3 canais do YouTube", "Suporte prioritário"]'::jsonb),
        ('Enterprise', 'enterprise', 199.00, 'monthly', NULL, NULL, '["Vídeos ilimitados", "Geração de conteúdo com IA", "Thumbnails automáticos", "Agendamento ilimitado", "Canais ilimitados", "Suporte 24/7", "API personalizada"]'::jsonb)
      `);
      console.log('✅ Planos padrão criados');
    }

    // Criar usuário admin padrão se não existir
    const adminResult = await client.query('SELECT id FROM users WHERE username = $1', ['admin']);
    if (adminResult.rows.length === 0) {
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      await client.query(
        'INSERT INTO users (username, email, password, role, payment_status) VALUES ($1, $2, $3, $4, $5)',
        ['admin', 'admin@example.com', hashedPassword, 'admin', 'paid']
      );
      console.log('✅ Usuário admin criado: admin / admin123');
    }

    console.log('✅ Banco de dados PostgreSQL inicializado');
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    console.error('Stack:', error.stack);
    if (error.code) {
      console.error('Código do erro:', error.code);
    }
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

// Funções para usuários
const userQueries = {
  findByUsername: async (username) => {
    const result = await pool.query(
      'SELECT *, COALESCE(payment_status, \'pending\') as payment_status FROM users WHERE username = $1 OR email = $1',
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
    const result = await pool.query('SELECT *, COALESCE(payment_status, \'pending\') as payment_status FROM users WHERE id = $1', [id]);
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
  },
  
  updateRole: async (id, role) => {
    const result = await pool.query('UPDATE users SET role = $1 WHERE id = $2', [role, id]);
    return result.rowCount > 0;
  },
  
  updatePassword: async (id, hashedPassword) => {
    const result = await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedPassword, id]);
    return result.rowCount > 0;
  },
  
  updatePaymentStatus: async (id, status) => {
    const result = await pool.query('UPDATE users SET payment_status = $1 WHERE id = $2', [status, id]);
    return result.rowCount > 0;
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
  
  findNeedingAI: async () => {
    const result = await pool.query(`
      SELECT * FROM scheduled_videos 
      WHERE status = 'pending' 
      AND (title IS NULL OR title = '')
      AND scheduled_time <= NOW() + INTERVAL '10 minutes'
      AND scheduled_time > NOW()
      ORDER BY scheduled_time
    `);
    return result.rows;
  },
  
  updateContent: async (id, title, description, thumbnailPath) => {
    await pool.query(`
      UPDATE scheduled_videos SET
        title = $1,
        description = $2,
        thumbnail_path = $3
      WHERE id = $4
    `, [title, description, thumbnailPath, id]);
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
  },
  
  findById: async (id) => {
    const result = await pool.query('SELECT * FROM published_videos WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  delete: async (id) => {
    const result = await pool.query('DELETE FROM published_videos WHERE id = $1', [id]);
    return result.rowCount > 0;
  },
  
  findAll: async () => {
    const result = await pool.query(`
      SELECT pv.*, u.username, u.email
      FROM published_videos pv
      JOIN users u ON pv.user_id = u.id
      ORDER BY pv.published_at DESC
    `);
    return result.rows;
  }
};

// Funções para planos
const planQueries = {
  findAll: async () => {
    // Buscar planos ativos (is_active = true ou NULL, já que NULL significa ativo por padrão)
    const result = await pool.query('SELECT * FROM plans WHERE (is_active = true OR is_active IS NULL) ORDER BY price');
    return result.rows;
  },
  
  findBySlug: async (slug) => {
    // Buscar plano por slug (is_active = true ou NULL)
    const result = await pool.query('SELECT * FROM plans WHERE slug = $1 AND (is_active = true OR is_active IS NULL)', [slug]);
    return result.rows[0] || null;
  },
  
  findById: async (id) => {
    const result = await pool.query('SELECT * FROM plans WHERE id = $1', [id]);
    return result.rows[0] || null;
  }
};

// Funções para assinaturas
const subscriptionQueries = {
  findByUserId: async (userId) => {
    const result = await pool.query(`
      SELECT s.*, p.name as plan_name, p.slug as plan_slug, p.price, p.max_videos, p.max_channels, p.billing_period, p.id as plan_id
      FROM subscriptions s
      JOIN plans p ON s.plan_id = p.id
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT 1
    `, [userId]);
    return result.rows[0] || null;
  },
  
  create: async (userId, planId, asaasSubscriptionId = null) => {
    const periodStart = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    
    const result = await pool.query(`
      INSERT INTO subscriptions (user_id, plan_id, asaas_subscription_id, current_period_start, current_period_end, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING id
    `, [userId, planId, asaasSubscriptionId, periodStart, periodEnd]);
    return result.rows[0].id;
  },
  
  updateStatus: async (id, status) => {
    await pool.query('UPDATE subscriptions SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [status, id]);
  },
  
  findAll: async () => {
    const result = await pool.query(`
      SELECT s.*, u.username, u.email, p.name as plan_name, p.price
      FROM subscriptions s
      JOIN users u ON s.user_id = u.id
      JOIN plans p ON s.plan_id = p.id
      ORDER BY s.created_at DESC
    `);
    return result.rows;
  }
};

// Funções para faturas
const invoiceQueries = {
  findByUserId: async (userId) => {
    const result = await pool.query(`
      SELECT i.*, p.name as plan_name, p.slug as plan_slug
      FROM invoices i
      JOIN plans p ON i.plan_id = p.id
      WHERE i.user_id = $1
      ORDER BY i.created_at DESC
    `, [userId]);
    return result.rows;
  },
  
  create: async (userId, planId, subscriptionId, amount, asaasInvoiceId, invoiceNumber, dueDate, pixQrCode = null, pixCopyPaste = null, paymentMethod = 'PIX', customerName = null, customerCpf = null, customerPhone = null) => {
    const result = await pool.query(`
      INSERT INTO invoices (user_id, subscription_id, plan_id, amount, asaas_invoice_id, invoice_number, due_date, pix_qr_code, pix_copy_paste, payment_method, customer_name, customer_cpf, customer_phone, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'pending')
      RETURNING id
    `, [userId, subscriptionId, planId, amount, asaasInvoiceId, invoiceNumber, dueDate, pixQrCode, pixCopyPaste, paymentMethod, customerName, customerCpf, customerPhone]);
    return result.rows[0].id;
  },
  
  findByAsaasId: async (asaasInvoiceId) => {
    const result = await pool.query('SELECT * FROM invoices WHERE asaas_invoice_id = $1', [asaasInvoiceId]);
    return result.rows[0] || null;
  },
  
  updateStatus: async (id, status, paidAt = null) => {
    await pool.query(`
      UPDATE invoices 
      SET status = $1, paid_at = $2, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $3
    `, [status, paidAt, id]);
  },
  
  findAll: async () => {
    const result = await pool.query(`
      SELECT i.*, u.username, u.email, p.name as plan_name, p.slug as plan_slug
      FROM invoices i
      JOIN users u ON i.user_id = u.id
      JOIN plans p ON i.plan_id = p.id
      ORDER BY i.created_at DESC
    `);
    return result.rows;
  },
  
  findById: async (id) => {
    const result = await pool.query(`
      SELECT i.*, u.username, u.email, p.name as plan_name, p.slug as plan_slug
      FROM invoices i
      JOIN users u ON i.user_id = u.id
      JOIN plans p ON i.plan_id = p.id
      WHERE i.id = $1
    `, [id]);
    return result.rows[0] || null;
  }
};

// Inicializar banco
let initPromise = null;
let isInitialized = false;
let initError = null;

function ensureInitialized() {
  if (!initPromise) {
    initPromise = initDatabase()
      .then(() => {
        isInitialized = true;
        initError = null;
        console.log('✅ Banco de dados PostgreSQL inicializado com sucesso');
      })
      .catch((err) => {
        console.error('❌ Erro ao inicializar PostgreSQL:', err);
        console.error('Stack:', err.stack);
        isInitialized = false;
        initError = err;
        // Não relançar o erro, apenas logar
        // Permite que o servidor continue funcionando
      });
  }
  return initPromise;
}

// Inicializar imediatamente (não esperar) - apenas logar erros
// No Vercel, a inicialização pode falhar na primeira vez, mas funcionar nas requisições
ensureInitialized().catch(err => {
  console.error('❌ Falha na inicialização inicial do banco:', err.message);
  console.error('⚠️ O banco será inicializado na primeira requisição');
});

module.exports = {
  pool,
  initDatabase: ensureInitialized,
  users: userQueries,
  configs: configQueries,
  schedules: scheduleQueries,
  published: {
    findByUserId: publishedQueries.findByUserId,
    create: publishedQueries.create,
    findByVideoId: publishedQueries.findByVideoId,
    findById: publishedQueries.findById,
    delete: publishedQueries.delete,
    findAll: publishedQueries.findAll
  },
  plans: planQueries,
  subscriptions: subscriptionQueries,
  invoices: invoiceQueries
};

