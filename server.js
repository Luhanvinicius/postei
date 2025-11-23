const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

// Inicializar banco de dados ANTES de carregar rotas
const db = require('./database');

// Garantir que o banco está inicializado antes de processar requisições
let dbReady = false;
if (db.initDatabase) {
  db.initDatabase()
    .then(() => {
      dbReady = true;
      console.log('✅ Banco de dados pronto');
    })
    .catch(err => {
      console.error('❌ Erro ao inicializar banco de dados:', err);
      // Não bloquear o servidor, mas logar o erro
    });
} else {
  // SQLite inicializa síncronamente
  dbReady = true;
}

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const apiRoutes = require('./routes/api');
const testRoutes = require('./routes/test');

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

// Criar diretórios necessários (apenas em desenvolvimento)
if (!isVercel) {
  const dirs = [
    'uploads',
    'videos',
    'scheduled',
    'posted',
    'thumbnails',
    'temp_frames',
    'user_configs',
    'public'
  ];

  dirs.forEach(dir => {
    fs.ensureDirSync(dir);
  });
}

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  createParentPath: true
}));

// Configuração de sessão
// No Vercel, usa memória (stateless). Em desenvolvimento, usa file-store
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'change-this-secret-key',
  resave: false, // Mudado para false para evitar problemas
  saveUninitialized: false,
  cookie: {
    secure: isVercel ? true : false, // HTTPS no Vercel
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    sameSite: isVercel ? 'none' : 'lax', // Necessário para HTTPS
    domain: isVercel ? undefined : undefined // Não definir domain no Vercel
  }
};

// Usar file-store apenas em desenvolvimento
if (!isVercel) {
  sessionConfig.store = new FileStore({
    path: path.join(__dirname, 'data', 'sessions'),
    ttl: 86400, // 24 horas
    retries: 0
  });
}

app.use(session(sessionConfig));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Servir thumbnails
app.use('/thumbnails', express.static(path.join(__dirname, 'thumbnails')));

// Middleware para garantir que o banco está pronto
app.use(async (req, res, next) => {
  // Rotas estáticas não precisam do banco
  if (req.path.startsWith('/thumbnails') || req.path.startsWith('/images') || req.path.startsWith('/css') || req.path.startsWith('/js')) {
    return next();
  }

  if (!dbReady && db.initDatabase) {
    try {
      console.log('🔄 Inicializando banco de dados na primeira requisição...');
      await db.initDatabase();
      dbReady = true;
      console.log('✅ Banco de dados pronto!');
    } catch (err) {
      console.error('❌ Erro ao inicializar banco na requisição:', err);
      console.error('Stack:', err.stack);
      // Não bloquear a requisição, apenas logar o erro
      // O banco pode estar inicializando em background
    }
  }
  next();
});

// Middleware de autenticação
const requireAuth = (req, res, next) => {
  if (req.session && req.session.user) {
    return next();
  }
  res.redirect('/auth/login');
};

const requireAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  res.status(403).send('Acesso negado. Apenas administradores.');
};

// Rotas
app.get('/', (req, res) => {
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') {
      res.redirect('/admin/dashboard');
    } else {
      res.redirect('/user/dashboard');
    }
  } else {
    res.render('index');
  }
});

// Redirecionar /login para /auth/login (compatibilidade)
app.get('/login', (req, res) => {
  res.redirect('/auth/login');
});

app.use('/auth', authRoutes);
app.use('/test', testRoutes); // Rota de teste (sem autenticação)
app.use('/admin', requireAuth, requireAdmin, adminRoutes);
app.use('/user', requireAuth, userRoutes);
app.use('/api', requireAuth, apiRoutes);

// Iniciar servidor apenas se não estiver no Vercel
// No Vercel, o app é exportado e o servidor é iniciado automaticamente
if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📁 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });

  // Iniciar scheduler apenas em desenvolvimento/local
  // No Vercel, use Vercel Cron Jobs (vercel.json)
  require('./services/scheduler').start();
}

// Exportar app para Vercel
module.exports = app;

