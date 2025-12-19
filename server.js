const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const cookieParser = require('cookie-parser');
const fileUpload = require('express-fileupload');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

// Inicializar banco de dados ANTES de carregar rotas
let db;
try {
  console.log('🔄 Carregando módulo de banco de dados...');
  db = require('./database');
  console.log('✅ Módulo de banco de dados carregado');
} catch (err) {
  console.error('❌ Erro ao carregar módulo de banco de dados:', err);
  console.error('Stack:', err.stack);
  throw err;
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
  throw err;
}

// Garantir que o banco está inicializado antes de processar requisições
let dbReady = false;
let dbInitPromise = null;

if (db.initDatabase) {
  // Iniciar inicialização imediatamente
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
      return false;
    });
} else {
  // SQLite inicializa síncronamente
  dbReady = true;
  dbInitPromise = Promise.resolve(true);
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
  throw err;
}

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
const sessionConfig = {
  secret: process.env.SESSION_SECRET || 'change-this-secret-key',
  resave: false, // Não salvar sessão se não foi modificada
  saveUninitialized: false, // Não criar sessão até que algo seja salvo
  name: 'youtube_automation_session', // Nome customizado
  rolling: true, // Renovar cookie a cada requisição
  cookie: {
    secure: isVercel ? true : false, // HTTPS no Vercel, HTTP localmente
    httpOnly: true, // Cookie não acessível via JavaScript (segurança)
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    sameSite: isVercel ? 'none' : 'lax', // Necessário para HTTPS no Vercel
    path: '/'
  }
};

// Usar file-store em desenvolvimento local (persistente)
if (!isVercel) {
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
  try {
  // Se já está autenticado, redirecionar para dashboard apropriado
  if (req.user) {
    // Admin sempre vai para dashboard
    if (req.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    
    // Todos os usuários (com ou sem pagamento) vão para dashboard
    // O dashboard mostrará aviso se payment_status for 'pending'
    const { invoices } = require('./database');
    let pendingInvoice = null;
    
    // Verificar se tem fatura pendente
    if (req.user.payment_status === 'pending') {
      try {
        let userInvoices;
        if (invoices.findByUserId.constructor.name === 'AsyncFunction') {
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
    
    // Ir para dashboard (com ou sem plano ativo)
    return res.redirect('/user/dashboard');
  }
  
  // Mostrar página inicial (com planos) apenas para visitantes não autenticados
  // Buscar planos para exibir na página inicial
  let allPlans = [];
  try {
    // Aguardar banco estar pronto antes de buscar planos
    if (!dbReady && dbInitPromise) {
      try {
        await dbInitPromise;
        dbReady = true;
      } catch (err) {
        console.warn('⚠️ Banco não inicializado - renderizando sem planos');
      }
    }
    
    if (dbReady) {
      const { plans } = require('./database');
      if (plans && plans.findAll) {
        const isAsync = plans.findAll.constructor && plans.findAll.constructor.name === 'AsyncFunction';
        if (isAsync) {
          allPlans = await plans.findAll();
        } else {
          allPlans = plans.findAll();
        }
      }
    }
  } catch (err) {
    console.error('Erro ao buscar planos para página inicial:', err);
    // Continuar mesmo sem planos - página inicial ainda funciona
    allPlans = [];
  }
  
  // Renderizar página inicial mesmo se não houver planos
  res.render('index', { plans: allPlans || [] });
  } catch (err) {
    console.error('❌ Erro na rota principal (/):', err);
    console.error('Stack:', err.stack);
    next(err);
  }
});

// Redirecionar /login para /auth/login (compatibilidade)
app.get('/login', (req, res) => {
  res.redirect('/auth/login');
});

app.use('/auth', authRoutes);
app.use('/test', testRoutes); // Rota de teste (sem autenticação)
app.use('/payment', paymentRoutes); // Rotas de pagamento (webhook sem auth, checkout com auth)
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
  
  // Não expor detalhes do erro em produção
  if (isVercel) {
    res.status(500).send('Internal Server Error');
  } else {
    res.status(500).send(`<pre>${err.stack}</pre>`);
  }
});

// Exportar app para Vercel
module.exports = app;

