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
    
    const token = jwt.sign(payload, SECRET, { expiresIn: '7d' }); // 7 dias para não expirar rápido
    console.log('✅ Token JWT criado para:', user.username, 'expira em 7 dias');
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
    if (!token || typeof token !== 'string') {
      return null;
    }
    
    // Remover "Bearer " se presente
    if (token.startsWith('Bearer ')) {
      token = token.substring(7);
    }
    
    // Verificar se token não está vazio após remover "Bearer "
    if (!token || token.trim() === '') {
      return null;
    }
    
    const decoded = jwt.verify(token, SECRET);
    return decoded;
  } catch (err) {
    console.log('❌ Erro ao verificar token:', err.message);
    return null;
  }
};

/**
 * Middleware global: anexar usuário do token
 */
const attachUser = (req, res, next) => {
  let user = null;
  
  // 1. PRIMEIRO: Tentar pegar da query string (para navegação normal - mais comum)
  if (req.query && req.query.token) {
    const tokenValue = req.query.token;
    if (tokenValue && typeof tokenValue === 'string' && tokenValue.trim() !== '') {
      user = verifyToken(tokenValue);
      if (user) {
        console.log('✅ Usuário autenticado via query token:', user.username, 'URL:', req.url);
      } else {
        console.log('❌ Token da query string inválido ou expirado');
      }
    }
  }
  
  // 2. SEGUNDO: Tentar pegar token do header Authorization (para AJAX/fetch)
  if (!user && req.headers.authorization) {
    user = verifyToken(req.headers.authorization);
    if (user) {
      console.log('✅ Usuário autenticado via header Authorization:', user.username);
    }
  }
  
  // 3. TERCEIRO: Tentar pegar do body (para formulários POST)
  if (!user && req.body && req.body.token) {
    user = verifyToken(req.body.token);
    if (user) {
      console.log('✅ Usuário autenticado via body token:', user.username);
    }
  }
  
  req.user = user;
  
  // Log apenas para rotas protegidas sem autenticação
  if (!user && 
      !req.url.includes('/auth/login') && 
      !req.url.includes('/auth/register') &&
      !req.url.includes('/css/') && 
      !req.url.includes('/js/') && 
      !req.url.includes('/images/') &&
      !req.url.includes('/favicon.ico')) {
    console.log('⚠️  Nenhum token válido encontrado na requisição:', req.url);
  }
  
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
