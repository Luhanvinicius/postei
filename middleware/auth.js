/**
 * Autenticação baseada em TOKENS (sem cookies)
 * Usa tokens armazenados em memória e enviados via header Authorization ou query parameter
 */

/**
 * Middleware global: anexar usuário do token ao req.user
 * Busca sempre os dados mais recentes do banco para garantir payment_status atualizado
 */
const attachUser = async (req, res, next) => {
  // Tentar obter token do header Authorization ou query parameter
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  if (token) {
    const authModule = require('../routes/auth');
    const tokenStore = authModule.tokenStore;
    if (tokenStore && tokenStore.has(token)) {
      const userData = tokenStore.get(token);
      if (userData.expires > Date.now()) {
        // Buscar dados mais recentes do banco para garantir payment_status atualizado
        try {
          const { users } = require('../database');
          const freshUser = await Promise.resolve(users.findById(userData.userId));
          
          if (freshUser) {
            // Atualizar token com dados mais recentes
            const updatedPaymentStatus = freshUser.payment_status || 'pending';
            tokenStore.set(token, {
              ...userData,
              payment_status: updatedPaymentStatus
            });
            
            req.user = {
              id: freshUser.id,
              username: freshUser.username,
              email: freshUser.email,
              role: freshUser.role,
              payment_status: updatedPaymentStatus
            };
          } else {
            // Se usuário não existe mais, usar dados do token
            req.user = {
              id: userData.userId,
              username: userData.username,
              email: userData.email,
              role: userData.role,
              payment_status: userData.payment_status
            };
          }
        } catch (err) {
          // Em caso de erro, usar dados do token
          console.error('Erro ao buscar dados atualizados do usuário:', err);
          req.user = {
            id: userData.userId,
            username: userData.username,
            email: userData.email,
            role: userData.role,
            payment_status: userData.payment_status
          };
        }
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
 * O attachUser já deve ter populado req.user com dados atualizados do banco
 */
const requireAuth = async (req, res, next) => {
  // Tentar obter token do header Authorization ou query parameter
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  
  console.log('🔍 requireAuth - Verificando autenticação');
  console.log('   Token presente:', !!token);
  console.log('   Path:', req.path);
  console.log('   É requisição API?', req.path.startsWith('/api/') || req.path.includes('/videos/generate') || req.path.includes('/videos/upload'));
  
  // Verificar se é uma requisição API (deve retornar JSON, não redirect)
  const isApiRequest = req.path.startsWith('/api/') || 
                       req.path.includes('/videos/generate') || 
                       req.path.includes('/videos/upload') ||
                       req.headers['content-type']?.includes('application/json') ||
                       req.headers.accept?.includes('application/json');
  
  if (!token) {
    console.log('❌ Token não encontrado');
    if (isApiRequest) {
      return res.status(401).json({ success: false, error: 'Token não encontrado. Faça login novamente.' });
    }
    return res.redirect('/auth/login');
  }
  
  const authModule = require('../routes/auth');
  const tokenStore = authModule.tokenStore;
  if (!tokenStore || !tokenStore.has(token)) {
    console.log('❌ Token inválido');
    if (isApiRequest) {
      return res.status(401).json({ success: false, error: 'Token inválido. Faça login novamente.' });
    }
    return res.redirect('/auth/login');
  }
  
  const userData = tokenStore.get(token);
  if (userData.expires <= Date.now()) {
    console.log('❌ Token expirado');
    tokenStore.delete(token);
    if (isApiRequest) {
      return res.status(401).json({ success: false, error: 'Token expirado. Faça login novamente.' });
    }
    return res.redirect('/auth/login');
  }
  
  // Se req.user já foi populado pelo attachUser, usar esses dados (já atualizados do banco)
  // Caso contrário, usar dados do token
  if (!req.user) {
    // Buscar dados atualizados do banco
    try {
      const { users } = require('../database');
      const freshUser = await Promise.resolve(users.findById(userData.userId));
      
      if (freshUser) {
        // Atualizar token com dados mais recentes
        const updatedPaymentStatus = freshUser.payment_status || 'pending';
        tokenStore.set(token, {
          ...userData,
          payment_status: updatedPaymentStatus
        });
        
        req.user = {
          id: freshUser.id,
          username: freshUser.username,
          email: freshUser.email,
          role: freshUser.role,
          payment_status: updatedPaymentStatus
        };
      } else {
        // Se usuário não existe mais, usar dados do token
        req.user = {
          id: userData.userId,
          username: userData.username,
          email: userData.email,
          role: userData.role,
          payment_status: userData.payment_status
        };
      }
    } catch (err) {
      // Em caso de erro, usar dados do token
      console.error('Erro ao buscar dados atualizados do usuário:', err);
      req.user = {
        id: userData.userId,
        username: userData.username,
        email: userData.email,
        role: userData.role,
        payment_status: userData.payment_status
      };
    }
  }
  
  req.token = token;
  
  console.log('✅ Usuário autenticado:', req.user.username, 'Role:', req.user.role, 'Payment Status:', req.user.payment_status);
  
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
