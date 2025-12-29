/**
 * Autenticação baseada em TOKENS (sem cookies)
 * Usa tokens armazenados em memória e enviados via header Authorization ou query parameter
 */

/**
 * Middleware global: anexar usuário do token ao req.user
 */
const attachUser = (req, res, next) => {
  // Tentar obter token do header Authorization ou query parameter
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (token) {
    const { tokenStore } = require('../routes/auth');
    if (tokenStore && tokenStore.has(token)) {
      const userData = tokenStore.get(token);
      if (userData.expires > Date.now()) {
        req.user = {
          id: userData.userId,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          payment_status: userData.payment_status
        };
        req.token = token;
      } else {
        // Token expirado
        tokenStore.delete(token);
      }
    }
  }
  
  next();
};

/**
 * Middleware: verificar autenticação
 */
const requireAuth = async (req, res, next) => {
  // Tentar obter token do header Authorization ou query parameter
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  console.log('🔍 requireAuth - Verificando autenticação');
  console.log('   Token presente:', !!token);
  
  if (!token) {
    console.log('❌ Token não encontrado - redirecionando para login');
    return res.redirect('/auth/login');
  }
  
  const { tokenStore } = require('../routes/auth');
  if (!tokenStore || !tokenStore.has(token)) {
    console.log('❌ Token inválido - redirecionando para login');
    return res.redirect('/auth/login');
  }
  
  const userData = tokenStore.get(token);
  if (userData.expires <= Date.now()) {
    console.log('❌ Token expirado - redirecionando para login');
    tokenStore.delete(token);
    return res.redirect('/auth/login');
  }
  
  // Anexar usuário ao req.user
  req.user = {
    id: userData.userId,
    username: userData.username,
    email: userData.email,
    role: userData.role,
    payment_status: userData.payment_status
  };
  req.token = token;
  
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
  if (!req.user || req.user.role !== 'admin') {
    console.log('❌ Acesso negado - não é admin');
    return res.status(403).send('Acesso negado. Apenas administradores.');
  }
  
  next();
};

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin
};
