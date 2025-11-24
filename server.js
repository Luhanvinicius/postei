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

// Importar middlewares de autenticação
const { requireAuth, requireAdmin } = require('./middleware/auth');

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
const paymentRoutes = require('./routes/payment');

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

// Middleware global: anexar usuário da sessão em todas as requisições
app.use((req, res, next) => {
  // Se tem sessão com usuário, anexar ao req.user
  if (req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
});

// Rotas públicas
app.get('/', async (req, res) => {
  // Se já está autenticado, verificar status de pagamento
  if (req.user) {
    // Admin sempre vai para dashboard
    if (req.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    
    // Usuário com pagamento confirmado vai para dashboard
    if (req.user.payment_status === 'paid') {
      return res.redirect('/user/dashboard');
    }
    
    // Usuário com pagamento pendente - verificar se tem fatura pendente
    if (req.user.payment_status === 'pending') {
      const { invoices } = require('./database');
      let pendingInvoice = null;
      
      try {
        let userInvoices;
        if (invoices.findByUserId.constructor.name === 'AsyncFunction') {
          userInvoices = await invoices.findByUserId(req.user.id);
        } else {
          userInvoices = invoices.findByUserId(req.user.id);
        }
        
        pendingInvoice = userInvoices.find(inv => inv.status === 'pending');
      } catch (err) {
        console.error('Erro ao buscar faturas na home:', err);
      }
      
      if (pendingInvoice) {
        // Se tem fatura pendente, redirecionar para página de pagamento
        return res.redirect(`/payment/pending?invoice=${pendingInvoice.id}`);
      }
      // Se não tem fatura, pode ver a home para escolher plano
    }
  }
  
  // Mostrar página inicial (com planos)
  res.render('index');
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

// Exportar app para Vercel
module.exports = app;

