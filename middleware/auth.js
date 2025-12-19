/**
 * Autenticação baseada em SESSÕES (sem tokens)
 * Usa express-session com cookies assinados
 */

/**
 * Middleware global: anexar usuário da sessão
 */
const attachUser = (req, res, next) => {
  // req.user já vem da sessão se estiver autenticado
  // Não precisa fazer nada, apenas passar adiante
  next();
};

/**
 * Middleware: verificar autenticação
 */
const requireAuth = async (req, res, next) => {
  if (!req.session || !req.session.user) {
    console.log('❌ Não autenticado - redirecionando para login');
    return res.redirect('/auth/login');
  }
  
  // Anexar usuário da sessão ao req.user para compatibilidade
  req.user = req.session.user;
  
  // Verificar se o pagamento está pendente (exceto para admins e rotas de pagamento)
  if (req.user.role !== 'admin' && req.user.payment_status === 'pending') {
    // SEMPRE permitir acesso às rotas de pagamento (checkout, pending, webhook)
    // Isso permite que o usuário complete o pagamento ou crie nova fatura
    const path = req.path || '';
    const originalUrl = req.originalUrl || '';
    const baseUrl = req.baseUrl || '';
    
    console.log('🔍 Middleware - Verificando acesso para usuário com payment_status=pending');
    console.log('   Path:', path);
    console.log('   OriginalUrl:', originalUrl);
    console.log('   BaseUrl:', baseUrl);
    console.log('   User:', req.user.username);
    
    // PRIMEIRO: Sempre permitir acesso a rotas de pagamento e autenticação
    // Verificar de múltiplas formas para garantir que funciona
    // Quando a rota é registrada como /payment, o req.path pode ser /checkout/:planSlug
    // Mas req.originalUrl ou req.baseUrl terá /payment
    const isPaymentRoute = 
      path.startsWith('/payment/') || 
      originalUrl.includes('/payment/') || 
      baseUrl === '/payment' ||
      baseUrl.includes('payment') ||
      path.startsWith('/checkout/') ||  // Rota relativa dentro do router /payment
      path.startsWith('/pending') ||   // Rota relativa dentro do router /payment
      path.startsWith('/webhook/');    // Rota relativa dentro do router /payment
    
    const isAuthRoute = 
      path.startsWith('/auth/') || 
      originalUrl.includes('/auth/') || 
      baseUrl === '/auth' ||
      baseUrl.includes('auth');
    
    if (isPaymentRoute || isAuthRoute) {
      console.log('✅ PERMITINDO acesso à rota:', isPaymentRoute ? 'pagamento' : 'autenticação');
      console.log('   Path:', path, '| OriginalUrl:', originalUrl, '| BaseUrl:', baseUrl);
      return next();
    }
    
    // Permitir acesso ao dashboard e página de planos
    const isDashboardRoute = 
      path.startsWith('/user/dashboard') ||
      path.startsWith('/user/plans') ||
      path.startsWith('/user/profile') ||
      originalUrl.includes('/user/dashboard') ||
      originalUrl.includes('/user/plans') ||
      originalUrl.includes('/user/profile');
    
    if (isDashboardRoute) {
      console.log('✅ PERMITINDO acesso ao dashboard/perfil/planos');
      return next();
    }
    
    // Permitir acesso à home (/) para escolher plano
    if (path === '/' || path === '') {
      console.log('✅ PERMITINDO acesso à home');
      return next();
    }
    
    // Para outras rotas que precisam de plano ativo (vídeos, agendamento, etc)
    // Verificar se há fatura pendente
    const { invoices } = require('../database');
    let pendingInvoice = null;
    
    try {
      let userInvoices;
      if (invoices && invoices.findByUserId) {
        const isAsync = invoices.findByUserId.constructor && invoices.findByUserId.constructor.name === 'AsyncFunction';
        if (isAsync) {
          userInvoices = await invoices.findByUserId(req.user.id);
        } else {
          userInvoices = invoices.findByUserId(req.user.id);
        }
      }
      
      if (userInvoices && Array.isArray(userInvoices)) {
        pendingInvoice = userInvoices.find(inv => inv.status === 'pending');
      }
    } catch (err) {
      console.error('Erro ao buscar faturas:', err);
    }
    
    // Bloquear funcionalidades que precisam de plano ativo
    // Mas mostrar mensagem amigável no dashboard
    console.log('⚠️  Usuário sem plano ativo tentando acessar:', path);
    // Não redirecionar, apenas permitir acesso (o dashboard mostrará aviso)
    // Mas para funcionalidades específicas, retornar erro JSON
    if (req.path.startsWith('/api/') || req.path.includes('/videos/') || req.path.includes('/schedule')) {
      return res.status(403).json({ 
        success: false, 
        error: 'Plano inativo. Adquira um plano para usar esta funcionalidade.',
        requiresPlan: true
      });
    }
    
    // Para outras rotas, permitir acesso (mostrará aviso no dashboard)
    return next();
  }
  
  next();
};

/**
 * Middleware: verificar se é admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user || req.session.user.role !== 'admin') {
    console.log('❌ Acesso negado - não é admin');
    return res.status(403).send('Acesso negado. Apenas administradores.');
  }
  
  req.user = req.session.user;
  next();
};

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin
};
