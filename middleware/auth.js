/**
 * Autenticação baseada em SESSÕES (sem tokens)
 * Usa express-session com cookies assinados
 */

/**
 * Middleware global: anexar usuário da sessão ao req.user
 */
const attachUser = (req, res, next) => {
  // Popular req.user a partir da sessão
  if (req.session && req.session.user) {
    req.user = req.session.user;
  }
  next();
};

/**
 * Middleware: verificar autenticação
 */
const requireAuth = async (req, res, next) => {
  // Verificar se há sessão e usuário
  if (!req.session || !req.session.user) {
    console.log('❌ Não autenticado - redirecionando para login');
    console.log('   Session:', !!req.session);
    console.log('   Session.user:', req.session?.user);
    return res.redirect('/auth/login');
  }
  
  // Anexar usuário da sessão ao req.user
  req.user = req.session.user;
  
  console.log('✅ Usuário autenticado:', req.user.username, 'Role:', req.user.role);
  
  // Verificar se o pagamento está pendente (exceto para admins e rotas de pagamento)
  if (req.user.role !== 'admin' && req.user.payment_status === 'pending') {
    const path = req.path || '';
    const originalUrl = req.originalUrl || '';
    const baseUrl = req.baseUrl || '';
    
    // Sempre permitir acesso a rotas de pagamento e autenticação
    const isPaymentRoute = 
      path.startsWith('/payment/') || 
      originalUrl.includes('/payment/') || 
      baseUrl === '/payment' ||
      baseUrl.includes('payment') ||
      path.startsWith('/checkout/') ||
      path.startsWith('/pending') ||
      path.startsWith('/webhook/');
    
    const isAuthRoute = 
      path.startsWith('/auth/') || 
      originalUrl.includes('/auth/') || 
      baseUrl === '/auth' ||
      baseUrl.includes('auth');
    
    if (isPaymentRoute || isAuthRoute) {
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
      return next();
    }
    
    // Permitir acesso à home (/)
    if (path === '/' || path === '') {
      return next();
    }
    
    // Para outras rotas que precisam de plano ativo
    if (req.path.startsWith('/api/') || req.path.includes('/videos/') || req.path.includes('/schedule')) {
      return res.status(403).json({ 
        success: false, 
        error: 'Plano inativo. Adquira um plano para usar esta funcionalidade.',
        requiresPlan: true
      });
    }
    
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
