const jwt = require('jsonwebtoken');

const SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET || 'change-this-secret-key';

/**
 * NOVA ABORDAGEM: JWT Tokens (sem cookies)
 * 1. Login cria token JWT
 * 2. Token é enviado via header Authorization
 * 3. attachUser lê token do header
 */

/**
 * Criar token JWT
 */
const createToken = (user) => {
  try {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    const token = jwt.sign(payload, SECRET, { expiresIn: '24h' });
    console.log('✅ Token JWT criado para:', user.username);
    return token;
  } catch (err) {
    console.error('❌ Erro ao criar token:', err);
    return null;
  }
};

/**
 * Verificar e decodificar token JWT
 */
const verifyToken = (token) => {
  try {
    if (!token) {
      return null;
    }
    
    // Remover "Bearer " se presente
    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
    }
    
    const decoded = jwt.verify(token, SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
};

/**
 * Middleware global: anexar usuário do token
 */
const attachUser = (req, res, next) => {
  // Tentar pegar token do header Authorization
  const authHeader = req.headers.authorization;
  let user = null;
  
  if (authHeader) {
    user = verifyToken(authHeader);
    if (user) {
      console.log('✅ Usuário autenticado via token:', user.username);
    }
  }
  
  // Se não tiver token, tentar pegar do body (para formulários)
  if (!user && req.body && req.body.token) {
    user = verifyToken(req.body.token);
  }
  
  // Se não tiver token, tentar pegar da query (fallback)
  if (!user && req.query && req.query.token) {
    user = verifyToken(req.query.token);
  }
  
  req.user = user;
  next();
};

/**
 * Middleware: verificar autenticação
 */
const requireAuth = (req, res, next) => {
  if (!req.user) {
    console.log('❌ Não autenticado - redirecionando para login');
    return res.redirect('/auth/login');
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
  requireAdmin,
  createToken,
  verifyToken
};
