// Log inicial para debug
console.log('🚀 Iniciando servidor...');
console.log('📍 Ambiente:', process.env.NODE_ENV || 'development');
console.log('📍 Vercel:', process.env.VERCEL || 'não detectado');
console.log('📍 VERCEL_ENV:', process.env.VERCEL_ENV || 'não detectado');

try {
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

console.log('✅ Módulos básicos carregados');

// Inicializar banco de dados ANTES de carregar rotas
let db;
try {
  console.log('🔄 Carregando módulo de banco de dados...');
  db = require('./database');
  console.log('✅ Módulo de banco de dados carregado');
} catch (err) {
  console.error('❌ Erro ao carregar módulo de banco de dados:', err);
  console.error('Stack:', err.stack);
  // No Vercel, não lançar erro - deixar inicializar na primeira requisição
  // throw err;
  db = null; // Será inicializado na primeira requisição
}

// Importar middlewares de autenticação
let requireAuth, requireAdmin;
try {
  console.log('🔄 Carregando middlewares de autenticação...');
  const authMiddleware = require('./middleware/auth');
  requireAuth = authMiddleware.requireAuth;
  requireAdmin = authMiddleware.requireAdmin;
  console.log('✅ Middlewares de autenticação carregados');
} catch (err) {
  console.error('❌ Erro ao carregar middlewares de autenticação:', err);
  console.error('Stack:', err.stack);
  // No Vercel, não lançar erro - usar fallback
  requireAuth = (req, res, next) => {
    if (!req.session || !req.session.user) {
      return res.redirect('/auth/login');
    }
    next();
  };
  requireAdmin = (req, res, next) => {
    if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
      return res.status(403).send('Acesso negado');
    }
    next();
  };
}

// Garantir que o banco está inicializado antes de processar requisições
let dbReady = false;
let dbInitPromise = null;

if (db && db.initDatabase) {
  // Iniciar inicialização imediatamente (não bloquear)
  dbInitPromise = db.initDatabase()
    .then(() => {
      dbReady = true;
      console.log('✅ Banco de dados pronto');
      return true;
    })
    .catch(err => {
      console.error('❌ Erro ao inicializar banco de dados:', err);
      console.error('Stack:', err.stack);
      // Não bloquear o servidor, mas logar o erro
      // O banco será inicializado na primeira requisição
      return false;
    });
} else if (db) {
  // SQLite inicializa síncronamente
  dbReady = true;
  dbInitPromise = Promise.resolve(true);
} else {
  // db não foi carregado - será inicializado na primeira requisição
  dbReady = false;
  dbInitPromise = Promise.resolve(false);
}

// Carregar rotas com tratamento de erro
let authRoutes, adminRoutes, userRoutes, apiRoutes, testRoutes, paymentRoutes;
try {
  console.log('🔄 Carregando rotas...');
  authRoutes = require('./routes/auth');
  adminRoutes = require('./routes/admin');
  userRoutes = require('./routes/user');
  apiRoutes = require('./routes/api');
  testRoutes = require('./routes/test');
  paymentRoutes = require('./routes/payment');
  console.log('✅ Rotas carregadas');
} catch (err) {
  console.error('❌ Erro ao carregar rotas:', err);
  console.error('Stack:', err.stack);
  // No Vercel, não lançar erro - criar rotas vazias como fallback
  authRoutes = { router: require('express').Router() };
  adminRoutes = { router: require('express').Router() };
  userRoutes = { router: require('express').Router() };
  apiRoutes = { router: require('express').Router() };
  testRoutes = { router: require('express').Router() };
  paymentRoutes = { router: require('express').Router() };
  console.warn('⚠️ Usando rotas vazias como fallback');
}

const app = express();
const PORT = process.env.PORT || 3000;
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const isRailway = process.env.RAILWAY_ENVIRONMENT === 'production' || process.env.RAILWAY_ENVIRONMENT_NAME;
const isRender = process.env.RENDER === 'true' || process.env.RENDER_SERVICE_NAME;

// Criar diretórios necessários (apenas em desenvolvimento)
if (!isVercel && !isRailway) {
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

// CORS - Permitir requisições do frontend
const corsOptions = {
  origin: process.env.FRONTEND_URL || process.env.CORS_ORIGIN || '*', // Permitir qualquer origem em desenvolvimento
  credentials: true, // Permitir cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser()); // Para ler cookies
app.use(fileUpload({
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
  createParentPath: true
}));

// Configuração de sessão
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'change-this-secret-key',
  resave: false, // Não salvar sessão se não foi modificada
  saveUninitialized: false, // Não criar sessão até que algo seja salvo
  name: 'youtube_automation_session', // Nome customizado
  rolling: true, // Renovar cookie a cada requisição
  cookie: {
    secure: (isVercel || isRailway || isRender) ? true : false, // HTTPS no Vercel/Railway/Render, HTTP localmente
    httpOnly: true, // Cookie não acessível via JavaScript (segurança)
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    sameSite: (isVercel || isRailway || isRender) ? 'none' : 'lax', // Necessário para HTTPS no Vercel/Railway/Render
    path: '/'
  }
};

// Usar file-store em desenvolvimento local (persistente)
if (!isVercel && !isRailway && !isRender) {
  sessionConfig.store = new FileStore({
    path: path.join(__dirname, 'data', 'sessions'),
    ttl: 7 * 24 * 60 * 60, // 7 dias em segundos
    retries: 0
  });
  console.log('📁 Usando FileStore para sessões (desenvolvimento local)');
} else {
  // No Vercel, usar MemoryStore (padrão do express-session)
  // IMPORTANTE: MemoryStore funciona no Vercel porque:
  // 1. O Vercel mantém funções "quentes" por ~10 minutos após última requisição
  // 2. Durante esse período, a sessão persiste na memória
  // 3. Após inatividade ou deploy, a sessão é perdida (usuário precisa fazer login novamente)
  // 
  // Para produção com muitas requisições, considere usar Redis (Upstash):
  // https://vercel.com/docs/storage/upstash
  console.log('💾 Usando MemoryStore para sessões (Vercel)');
  console.log('✅ Funciona bem para a maioria dos casos');
  console.log('⚠️  Nota: Sessões podem ser perdidas após ~10min de inatividade ou entre deploys');
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
  if (req.path.startsWith('/thumbnails') || req.path.startsWith('/images') || req.path.startsWith('/css') || req.path.startsWith('/js') || req.path.startsWith('/favicon')) {
    return next();
  }

  // Se db não foi carregado, tentar carregar agora
  if (!db) {
    try {
      console.log('🔄 Tentando carregar banco de dados na requisição...');
      db = require('./database');
      if (db && db.initDatabase) {
        dbInitPromise = db.initDatabase()
          .then(() => {
            dbReady = true;
            console.log('✅ Banco de dados inicializado na requisição');
            return true;
          })
          .catch(err => {
            console.error('❌ Erro ao inicializar banco na requisição:', err);
            return false;
          });
      } else if (db) {
        dbReady = true;
        dbInitPromise = Promise.resolve(true);
      }
    } catch (err) {
      console.error('❌ Erro ao carregar banco na requisição:', err);
    }
  }

  // Aguardar inicialização do banco se ainda não estiver pronto
  if (!dbReady && dbInitPromise) {
    try {
      console.log('🔄 Aguardando inicialização do banco de dados...');
      await Promise.race([
        dbInitPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout na inicialização do banco (10s)')), 10000))
      ]);
      dbReady = true;
      console.log('✅ Banco de dados pronto!');
    } catch (err) {
      console.error('❌ Erro ao inicializar banco na requisição:', err.message);
      // Não bloquear requisições - tentar novamente na próxima
      // Em produção, algumas rotas podem funcionar sem banco
    }
  }
  
  next();
});

// Middleware global: anexar usuário da sessão em todas as requisições
app.use((req, res, next) => {
  // Se tem sessão com usuário, anexar ao req.user
  if (req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
});

// Rotas públicas
app.get('/', async (req, res, next) => {
  console.log('📍 Rota principal acessada:', req.url);
  console.log('📍 Usuário autenticado:', !!req.user);
  
  try {
    // Se já está autenticado, redirecionar para dashboard apropriado
    if (req.user) {
      console.log('📍 Usuário encontrado, redirecionando...');
      // Admin sempre vai para dashboard
      if (req.user.role === 'admin') {
        return res.redirect('/admin/dashboard');
      }
      
      // Todos os usuários (com ou sem pagamento) vão para dashboard
      // O dashboard mostrará aviso se payment_status for 'pending'
      try {
        const { invoices } = require('./database');
        let pendingInvoice = null;
        
        // Verificar se tem fatura pendente
        if (req.user.payment_status === 'pending' && invoices && invoices.findByUserId) {
          try {
            let userInvoices;
            if (invoices.findByUserId.constructor && invoices.findByUserId.constructor.name === 'AsyncFunction') {
              userInvoices = await invoices.findByUserId(req.user.id);
            } else {
              userInvoices = invoices.findByUserId(req.user.id);
            }
            
            if (userInvoices && Array.isArray(userInvoices)) {
              pendingInvoice = userInvoices.find(inv => inv.status === 'pending');
            }
          } catch (err) {
            console.error('Erro ao buscar faturas na home:', err);
          }
          
          if (pendingInvoice) {
            // Se tem fatura pendente, redirecionar para página de pagamento
            return res.redirect(`/payment/pending?invoice=${pendingInvoice.id}`);
          }
        }
      } catch (dbErr) {
        console.error('Erro ao acessar banco para verificar faturas:', dbErr);
        // Continuar mesmo com erro - redirecionar para dashboard
      }
      
      // Ir para dashboard (com ou sem plano ativo)
      return res.redirect('/user/dashboard');
    }
  
    // Mostrar página inicial (com planos) apenas para visitantes não autenticados
    console.log('📍 Renderizando página inicial para visitante não autenticado');
    
    // Buscar planos para exibir na página inicial
    let allPlans = [];
    try {
      // Aguardar banco estar pronto antes de buscar planos
      if (!dbReady && dbInitPromise) {
        try {
          console.log('📍 Aguardando banco estar pronto...');
          await Promise.race([
            dbInitPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
          ]);
          dbReady = true;
          console.log('📍 Banco pronto após espera');
        } catch (err) {
          console.warn('⚠️ Banco não inicializado - renderizando sem planos:', err.message);
        }
      }
      
      if (dbReady && db) {
        try {
          const { plans } = require('./database');
          if (plans && plans.findAll) {
            const isAsync = plans.findAll.constructor && plans.findAll.constructor.name === 'AsyncFunction';
            if (isAsync) {
              allPlans = await plans.findAll();
            } else {
              allPlans = plans.findAll();
            }
            console.log('📍 Planos encontrados:', allPlans.length);
          }
        } catch (planErr) {
          console.error('Erro ao buscar planos:', planErr);
          allPlans = [];
        }
      } else {
        console.warn('⚠️ Banco não está pronto, renderizando sem planos');
      }
    } catch (err) {
      console.error('Erro ao buscar planos para página inicial:', err);
      console.error('Stack:', err.stack);
      // Continuar mesmo sem planos - página inicial ainda funciona
      allPlans = [];
    }
  
    // Renderizar página inicial mesmo se não houver planos
    console.log('📍 Tentando renderizar template index.ejs com', allPlans.length, 'planos');
    try {
      res.render('index', { plans: allPlans || [] });
      console.log('✅ Página inicial renderizada com sucesso');
    } catch (renderErr) {
      console.error('❌ Erro ao renderizar página inicial:', renderErr);
      console.error('Stack:', renderErr.stack);
      console.error('Message:', renderErr.message);
      // Se falhar ao renderizar, retornar página simples
      res.status(500).send(`
        <html>
          <head><title>Erro</title></head>
          <body>
            <h1>Erro ao carregar página</h1>
            <p>Por favor, tente novamente mais tarde.</p>
            <p><a href="/health">Verificar status do servidor</a></p>
            <pre>${renderErr.message}</pre>
          </body>
        </html>
      `);
    }
  } catch (err) {
    console.error('❌ Erro na rota principal:', err);
    console.error('Stack:', err.stack);
    console.error('Message:', err.message);
    console.error('URL:', req.url);
    console.error('Method:', req.method);
    // Tentar retornar uma resposta mesmo com erro
    try {
      res.status(500).send(`
        <html>
          <head><title>Erro</title></head>
          <body>
            <h1>Erro interno do servidor</h1>
            <p>Por favor, tente novamente mais tarde.</p>
            <p><a href="/health">Verificar status do servidor</a></p>
            <pre>${err.message}</pre>
          </body>
        </html>
      `);
    } catch (sendErr) {
      console.error('❌ Erro ao enviar resposta de erro:', sendErr);
      next(err);
    }
  }
});

// Redirecionar /login para /auth/login (compatibilidade)
app.get('/login', (req, res) => {
  res.redirect('/auth/login');
});

// Usar router se disponível, senão usar diretamente
const getRouter = (routeModule) => {
  if (routeModule && routeModule.router) return routeModule.router;
  if (typeof routeModule === 'function') return routeModule;
  return routeModule;
};

app.use('/auth', getRouter(authRoutes));
app.use('/test', getRouter(testRoutes)); // Rota de teste (sem autenticação)
app.use('/payment', getRouter(paymentRoutes)); // Rotas de pagamento (webhook sem auth, checkout com auth)
app.use('/admin', requireAuth, requireAdmin, getRouter(adminRoutes));
app.use('/user', requireAuth, getRouter(userRoutes));
app.use('/api', requireAuth, getRouter(apiRoutes));

// Iniciar servidor apenas se não estiver no Vercel
// No Vercel, o app é exportado e o servidor é iniciado automaticamente
// No Railway/Render, precisamos iniciar o servidor explicitamente
if (!isVercel && !isRailway && !isRender) {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`📁 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  });

  // Iniciar scheduler apenas em desenvolvimento/local
  // No Vercel, use Vercel Cron Jobs (vercel.json)
  require('./services/scheduler').start();
} else if (isRailway || isRender) {
  // No Railway/Render, o servidor precisa ser iniciado explicitamente
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📁 Ambiente: ${process.env.NODE_ENV || 'production'}`);
    if (isRailway) {
      console.log(`🌐 Railway Environment: ${process.env.RAILWAY_ENVIRONMENT || 'production'}`);
    }
    if (isRender) {
      console.log(`🌐 Render Service: ${process.env.RENDER_SERVICE_NAME || 'postei'}`);
    }
  });
  
  // Iniciar scheduler no Railway também
  require('./services/scheduler').start();
  
  // Iniciar processamento periódico de agendamentos (gera conteúdo 10 min antes)
  const { processPendingAI } = require('./services/scheduler-service');
  
  // Processar imediatamente ao iniciar (após 5 segundos para o banco inicializar)
  setTimeout(() => {
    console.log('🔄 Iniciando processamento de agendamentos...');
    processPendingAI().catch(err => {
      console.error('❌ Erro no processamento inicial:', err);
    });
  }, 5000);
  
  // Processar a cada 2 minutos (verifica vídeos que estão 10 min antes)
  setInterval(() => {
    console.log('🔄 Verificando agendamentos que precisam de conteúdo com IA...');
    processPendingAI().catch(err => {
      console.error('❌ Erro no processamento periódico:', err);
    });
  }, 2 * 60 * 1000); // 2 minutos
  
  console.log('✅ Processamento periódico de agendamentos iniciado (a cada 2 minutos)');
}

// Middleware de tratamento de erros global (deve ser o último)
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err);
  console.error('Stack:', err.stack);
  console.error('URL:', req.url);
  console.error('Method:', req.method);
  console.error('Headers:', JSON.stringify(req.headers, null, 2));
  
  // Não expor detalhes do erro em produção
  if (isVercel || isRailway || isRender) {
    res.status(500).send('Internal Server Error');
  } else {
    res.status(500).send(`<pre>${err.stack}</pre>`);
  }
});

// Rota de teste para verificar se o servidor está funcionando
// Esta rota deve funcionar mesmo se o banco não estiver inicializado
app.get('/health', (req, res) => {
  try {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      isVercel: !!isVercel,
      isRailway: !!isRailway,
      isRender: !!isRender,
      dbReady: dbReady,
      dbLoaded: !!db,
      nodeVersion: process.version,
      vercelEnv: process.env.VERCEL_ENV || 'not-set'
    });
  } catch (err) {
    console.error('❌ Erro na rota /health:', err);
    res.status(500).json({
      status: 'error',
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Exportar app para Vercel/Railway
console.log('✅ App Express configurado e pronto para exportar');
module.exports = app;

} catch (initError) {
  // Se houver erro na inicialização, criar um app mínimo que retorna erro detalhado
  console.error('❌ ERRO CRÍTICO na inicialização:', initError);
  console.error('Stack:', initError.stack);
  console.error('Message:', initError.message);
  
  const express = require('express');
  const errorApp = express();
  
  errorApp.use(express.json());
  errorApp.use(express.urlencoded({ extended: true }));
  
  // Rota de health check mesmo com erro
  errorApp.get('/health', (req, res) => {
    res.status(500).json({
      status: 'error',
      error: 'Server initialization failed',
      message: initError.message,
      timestamp: new Date().toISOString()
    });
  });
  
  errorApp.all('*', (req, res) => {
    console.error('❌ Tentativa de acesso com app em estado de erro');
    res.status(500).json({
      error: 'Server initialization failed',
      message: initError.message,
      timestamp: new Date().toISOString(),
      url: req.url
    });
  });
  
  module.exports = errorApp;
}

