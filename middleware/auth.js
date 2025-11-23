const crypto = require('crypto');

/**
 * Middleware global para restaurar sessão do cookie de backup
 * Deve ser aplicado ANTES do requireAuth
 */
const restoreSessionFromCookie = async (req, res, next) => {
  // Se já tem sessão, não precisa restaurar
  if (req.session && req.session.user) {
    return next();
  }

  // Tentar restaurar do cookie de backup
  const cookieValue = req.cookies?.user_data || req.signedCookies?.user_data;
  
  if (cookieValue) {
    try {
      if (!cookieValue.includes('.')) {
        // Cookie inválido, continuar sem restaurar
        return next();
      }

      const [userData, signature] = cookieValue.split('.');
      const secret = process.env.SESSION_SECRET || 'change-this-secret-key';
      const expectedSignature = crypto.createHmac('sha256', secret).update(userData).digest('hex');
      
      if (signature === expectedSignature) {
        const user = JSON.parse(userData);
        
        // Restaurar sessão do cookie
        req.session.user = user;
        
        // Salvar a sessão restaurada
        await new Promise((resolve, reject) => {
          req.session.save((err) => {
            if (err) {
              console.error('❌ Erro ao salvar sessão restaurada:', err);
              // Não bloquear, apenas logar o erro
            }
            resolve();
          });
        });
        
        console.log('✅ Sessão restaurada do cookie:', user.username);
      }
    } catch (err) {
      // Erro ao restaurar, continuar sem bloquear
      console.error('❌ Erro ao restaurar sessão do cookie:', err.message);
    }
  }
  
  next();
};

/**
 * Middleware para verificar se o usuário está autenticado
 */
const requireAuth = async (req, res, next) => {
  // Verificar se tem sessão (pode ter sido restaurada do cookie)
  if (req.session && req.session.user) {
    return next();
  }
  
  // Se não tem sessão e não tem cookie, redirecionar para login
  console.log('❌ Usuário não autenticado, redirecionando para login');
  return res.redirect('/auth/login');
};

/**
 * Middleware para verificar se o usuário é admin
 * Deve ser usado DEPOIS do requireAuth
 */
const requireAdmin = (req, res, next) => {
  if (req.session && req.session.user && req.session.user.role === 'admin') {
    return next();
  }
  
  console.log('❌ Acesso negado - usuário não é admin');
  res.status(403).send('Acesso negado. Apenas administradores.');
};

module.exports = {
  restoreSessionFromCookie,
  requireAuth,
  requireAdmin
};

