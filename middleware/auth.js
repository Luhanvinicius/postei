const crypto = require('crypto');

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

/**
 * NOVA ABORDAGEM: No Vercel, usar APENAS cookies (não depender de sessões)
 * Localmente, usar sessões normais
 */

/**
 * Obter usuário autenticado (de sessão OU cookie)
 */
const getAuthenticatedUser = (req) => {
  // 1. Tentar pegar da sessão (funciona localmente)
  if (req.session && req.session.user) {
    return req.session.user;
  }

  // 2. No Vercel, pegar do cookie (não depender de sessão)
  const cookieValue = req.cookies?.user_data || req.signedCookies?.user_data;
  
  if (cookieValue) {
    try {
      if (!cookieValue.includes('.')) {
        return null;
      }

      const [userData, signature] = cookieValue.split('.');
      const secret = process.env.SESSION_SECRET || 'change-this-secret-key';
      const expectedSignature = crypto.createHmac('sha256', secret).update(userData).digest('hex');
      
      if (signature === expectedSignature) {
        const user = JSON.parse(userData);
        // Também salvar na sessão para consistência
        if (req.session) {
          req.session.user = user;
        }
        return user;
      }
    } catch (err) {
      console.error('❌ Erro ao ler cookie:', err.message);
    }
  }

  return null;
};

/**
 * Middleware global para garantir que req.user está disponível
 */
const attachUser = (req, res, next) => {
  req.user = getAuthenticatedUser(req);
  next();
};

/**
 * Middleware para verificar autenticação
 * Funciona tanto com sessão quanto com cookie
 */
const requireAuth = (req, res, next) => {
  const user = getAuthenticatedUser(req);
  
  if (user) {
    // Garantir que req.user está definido
    req.user = user;
    if (req.session) {
      req.session.user = user;
    }
    return next();
  }
  
  console.log('❌ Usuário não autenticado');
  return res.redirect('/auth/login');
};

/**
 * Middleware para verificar se é admin
 */
const requireAdmin = (req, res, next) => {
  const user = getAuthenticatedUser(req);
  
  if (user && user.role === 'admin') {
    req.user = user;
    if (req.session) {
      req.session.user = user;
    }
    return next();
  }
  
  console.log('❌ Acesso negado - não é admin');
  res.status(403).send('Acesso negado. Apenas administradores.');
};

/**
 * Criar cookie de autenticação
 */
const createAuthCookie = (res, user) => {
  const userData = JSON.stringify({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  });
  
  const secret = process.env.SESSION_SECRET || 'change-this-secret-key';
  const signature = crypto.createHmac('sha256', secret).update(userData).digest('hex');
  const signedData = `${userData}.${signature}`;
  
  res.cookie('user_data', signedData, {
    httpOnly: true,
    secure: isVercel ? true : false,
    sameSite: isVercel ? 'none' : 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 horas
    path: '/',
    signed: false
  });
  
  console.log('🍪 Cookie de autenticação criado para:', user.username);
};

/**
 * Remover cookie de autenticação
 */
const clearAuthCookie = (res) => {
  res.clearCookie('user_data', {
    path: '/',
    httpOnly: true,
    secure: isVercel ? true : false,
    sameSite: isVercel ? 'none' : 'lax'
  });
  console.log('🍪 Cookie de autenticação removido');
};

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin,
  createAuthCookie,
  clearAuthCookie,
  getAuthenticatedUser
};
