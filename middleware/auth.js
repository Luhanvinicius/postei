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
    
    // Permitir acesso à home (/) para escolher plano
    if (path === '/' || path === '') {
      console.log('✅ PERMITINDO acesso à home');
      return next();
    }
    
    // Para outras rotas protegidas, verificar se há fatura pendente
    // Se houver, redirecionar para página de pagamento pendente
    // Se não houver, redirecionar para home para escolher plano
    const { invoices } = require('../database');
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
      console.error('Erro ao buscar faturas:', err);
    }
    
    if (pendingInvoice) {
      console.log('🔀 Redirecionando para fatura pendente:', pendingInvoice.id);
      return res.redirect(`/payment/pending?invoice=${pendingInvoice.id}`);
    } else {
      // Se não tem fatura pendente, redirecionar para home para escolher plano
      // Mas NÃO bloquear se estiver tentando acessar checkout (já permitido acima)
      console.log('🔀 Usuário sem fatura - redirecionando para planos');
      return res.redirect('/#planos');
    }
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
