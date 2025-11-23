const crypto = require('crypto');

const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const SECRET = process.env.SESSION_SECRET || 'change-this-secret-key';

/**
 * NOVA LÓGICA: 100% baseada em cookies
 * Não depende de sessões no Vercel
 */

/**
 * Verificar e ler cookie de autenticação
 */
const readAuthCookie = (req) => {
  try {
    // Tentar ler do cookie (não assinado pelo cookie-parser)
    const cookieValue = req.cookies?.user_data;
    
    if (!cookieValue || !cookieValue.includes('.')) {
      return null;
    }

    // Separar dados e assinatura
    const [userData, signature] = cookieValue.split('.');
    
    // Verificar assinatura
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(userData).digest('hex');
    
    if (signature !== expectedSignature) {
      console.log('❌ Assinatura do cookie inválida');
      return null;
    }

    // Parsear dados do usuário
    const user = JSON.parse(userData);
    return user;
  } catch (err) {
    console.error('❌ Erro ao ler cookie:', err.message);
    return null;
  }
};

/**
 * Criar cookie de autenticação
 */
const createAuthCookie = (res, user) => {
  try {
    const userData = JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });
    
    const signature = crypto.createHmac('sha256', SECRET).update(userData).digest('hex');
    const signedData = `${userData}.${signature}`;
    
    res.cookie('user_data', signedData, {
      httpOnly: true,
      secure: isVercel ? true : false,
      sameSite: isVercel ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      path: '/'
    });
    
    console.log('✅ Cookie criado para:', user.username);
    return true;
  } catch (err) {
    console.error('❌ Erro ao criar cookie:', err.message);
    return false;
  }
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
  console.log('✅ Cookie removido');
};

/**
 * Middleware global: anexar usuário do cookie em req.user
 * Executa em TODAS as requisições
 */
const attachUser = (req, res, next) => {
  // Ler usuário do cookie
  const user = readAuthCookie(req);
  
  if (user) {
    req.user = user;
    // Também salvar na sessão se existir (para compatibilidade local)
    if (req.session) {
      req.session.user = user;
    }
  } else {
    req.user = null;
  }
  
  next();
};

/**
 * Middleware: verificar se usuário está autenticado
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    console.log('❌ Não autenticado - redirecionando para login');
    return res.redirect('/auth/login');
  }
  
  next();
};

/**
 * Middleware: verificar se usuário é admin
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
  requireAdmin,
  createAuthCookie,
  clearAuthCookie,
  readAuthCookie
};
