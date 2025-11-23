const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cookieParser = require('cookie-parser');
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
app.use(cookieParser()); // Para ler cookies
app.use(fileUpload({
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  createParentPath: true
}));

// Configuração de sessão
// No Vercel, MemoryStore não funciona bem (cada requisição pode estar em container diferente)
// Vamos usar MemoryStore mas com aviso, ou considerar usar Redis/Upstash no futuro
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'change-this-secret-key',
  resave: true, // Mudado para true no Vercel para garantir que salva
  saveUninitialized: false,
  name: 'sessionId', // Nome customizado para evitar conflitos
  rolling: true, // Renovar cookie a cada requisição
  cookie: {
    secure: isVercel ? true : false, // HTTPS no Vercel
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    sameSite: isVercel ? 'none' : 'lax', // Necessário para HTTPS no Vercel com cross-site
    path: '/',
    domain: undefined // Não definir domain para funcionar em todos os subdomínios do Vercel
  }
};

// Usar file-store apenas em desenvolvimento local
if (!isVercel) {
  sessionConfig.store = new FileStore({
    path: path.join(__dirname, 'data', 'sessions'),
    ttl: 86400, // 24 horas
    retries: 0
  });
} else {
  // No Vercel, usar MemoryStore (limitação do serverless)
  // TODO: Considerar usar Upstash Redis para produção
  console.warn('⚠️  Usando MemoryStore para sessões (não ideal para produção serverless)');
  console.warn('⚠️  Considere usar Upstash Redis para sessões persistentes');
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
const requireAuth = async (req, res, next) => {
  console.log('🔒 Verificando autenticação...');
  console.log('📝 Session ID:', req.sessionID);
  console.log('👤 Session user:', req.session?.user);
  console.log('🍪 Cookies recebidos:', Object.keys(req.cookies || {}));
  console.log('🍪 Cookie user_data existe?', !!req.cookies?.user_data);
  
  // Verificar sessão normal primeiro
  if (req.session && req.session.user) {
    console.log('✅ Usuário autenticado via sessão:', req.session.user.username);
    return next();
  }
  
  // Verificar cookie de backup se a sessão não existir (sempre, não só no Vercel)
  // O cookie pode estar em req.cookies (não assinado) ou req.signedCookies (assinado)
  const cookieValue = req.cookies?.user_data || req.signedCookies?.user_data;
  
  if (cookieValue) {
    try {
      console.log('🔍 Tentando restaurar sessão do cookie de backup...');
      const crypto = require('crypto');
      const signedData = cookieValue;
      
      if (!signedData || !signedData.includes('.')) {
        console.log('⚠️  Cookie de backup inválido (sem assinatura)');
      } else {
        const [userData, signature] = signedData.split('.');
        const secret = process.env.SESSION_SECRET || 'change-this-secret-key';
        const expectedSignature = crypto.createHmac('sha256', secret).update(userData).digest('hex');
        
        console.log('🔐 Verificando assinatura do cookie...');
        console.log('   Assinatura recebida:', signature.substring(0, 20) + '...');
        console.log('   Assinatura esperada:', expectedSignature.substring(0, 20) + '...');
        
        if (signature === expectedSignature) {
          const user = JSON.parse(userData);
          console.log('✅ Assinatura válida! Restaurando usuário:', user.username);
          
          // Restaurar sessão do cookie
          req.session.user = user;
          
          // Salvar a sessão restaurada
          await new Promise((resolve, reject) => {
            req.session.save((err) => {
              if (err) {
                console.error('❌ Erro ao salvar sessão restaurada:', err);
                reject(err);
              } else {
                console.log('✅ Sessão restaurada do cookie e salva:', user.username);
                resolve();
              }
            });
          });
          
          console.log('✅ Usuário autenticado via cookie de backup:', user.username);
          return next();
        } else {
          console.log('❌ Assinatura do cookie inválida!');
          console.log('   Recebida:', signature);
          console.log('   Esperada:', expectedSignature);
        }
      }
    } catch (err) {
      console.error('❌ Erro ao verificar cookie de backup:', err);
      console.error('Stack:', err.stack);
    }
  } else {
    console.log('⚠️  Cookie de backup não encontrado');
    console.log('   Cookies disponíveis:', Object.keys(req.cookies || {}));
  }
  
  console.log('❌ Usuário não autenticado, redirecionando para login');
  return res.redirect('/auth/login');
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

