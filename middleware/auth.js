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
const requireAuth = async (req, res, next) => {
  if (!req.session || !req.session.user) {
    console.log('❌ Não autenticado - redirecionando para login');
    return res.redirect('/auth/login');
  }
  
  // Anexar usuário da sessão ao req.user para compatibilidade
  req.user = req.session.user;
  
  // Verificar se o pagamento está pendente (exceto para admins e rotas de pagamento)
  if (req.user.role !== 'admin' && req.user.payment_status === 'pending') {
    // SEMPRE permitir acesso às rotas de pagamento (checkout, pending, webhook)
    // Isso permite que o usuário complete o pagamento
    if (req.path.startsWith('/payment/') || req.path.startsWith('/auth/logout')) {
      return next();
    }
    
    // Para outras rotas, verificar se há fatura pendente
    // Se houver, redirecionar para página de pagamento pendente
    // Se não houver, redirecionar para home para escolher plano
    const { invoices } = require('../database');
    let pendingInvoice = null;
    
    try {
      let userInvoices;
      if (invoices.findByUserId.constructor.name === 'AsyncFunction') {
        userInvoices = await invoices.findByUserId(req.user.id);
      } else {
        userInvoices = invoices.findByUserId(req.user.id);
      }
      
      pendingInvoice = userInvoices.find(inv => inv.status === 'pending');
    } catch (err) {
      console.error('Erro ao buscar faturas:', err);
    }
    
    if (pendingInvoice) {
      return res.redirect(`/payment/pending?invoice=${pendingInvoice.id}`);
    } else {
      // Se não tem fatura pendente, redirecionar para home para escolher plano
      return res.redirect('/#planos');
    }
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
