const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'change-this-secret-key';
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

/**
 * LÓGICA SIMPLES: 100% COOKIE
 * 1. Login cria cookie
 * 2. attachUser lê cookie em TODAS as requisições
 * 3. requireAuth verifica se tem req.user
 */

/**
 * Ler usuário do cookie
 */
const readAuthCookie = (req) => {
  try {
    const cookieValue = req.cookies?.user_data;
    
    if (!cookieValue || typeof cookieValue !== 'string') {
      return null;
    }

    if (!cookieValue.includes('.')) {
      return null;
    }

    const [userData, signature] = cookieValue.split('.');
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(userData).digest('hex');
    
    if (signature !== expectedSignature) {
      return null;
    }

    const user = JSON.parse(userData);
    return user;
  } catch (err) {
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
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });
    
    return true;
  } catch (err) {
    console.error('❌ Erro ao criar cookie:', err);
    return false;
  }
};

/**
 * Remover cookie
 */
const clearAuthCookie = (res) => {
  res.clearCookie('user_data', {
    path: '/',
    httpOnly: true,
    secure: isVercel ? true : false,
    sameSite: isVercel ? 'none' : 'lax'
  });
};

/**
 * Middleware global: anexar usuário do cookie
 */
const attachUser = (req, res, next) => {
  req.user = readAuthCookie(req);
  next();
};

/**
 * Middleware: verificar autenticação
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.redirect('/auth/login');
  }
  next();
};

/**
 * Middleware: verificar se é admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).send('Acesso negado. Apenas administradores.');
  }
  next();
};

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin,
  createAuthCookie,
  clearAuthCookie
};
