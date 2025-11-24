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
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    console.log('❌ Não autenticado - redirecionando para login');
    return res.redirect('/auth/login');
  }
  
  // Anexar usuário da sessão ao req.user para compatibilidade
  req.user = req.session.user;
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
