const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { users } = require('../database');
const crypto = require('crypto');

// Armazenamento simples de tokens em memória (para Render)
// Em produção, considere usar Redis
const tokenStore = new Map(); // token -> { userId, username, role, payment_status, expires }

// Exportar tokenStore para uso no middleware
module.exports.tokenStore = tokenStore;

// Limpar tokens expirados a cada hora
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokenStore.entries()) {
    if (data.expires < now) {
      tokenStore.delete(token);
    }
  }
}, 60 * 60 * 1000); // 1 hora

// Login
router.get('/login', async (req, res) => {
  // Verificar se já está autenticado via token
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (token && tokenStore.has(token)) {
    const userData = tokenStore.get(token);
    if (userData.expires > Date.now()) {
      if (userData.role === 'admin') {
        return res.redirect('/admin/dashboard?token=' + token);
      }
      return res.redirect('/user/dashboard?token=' + token);
    }
  }
  
  res.render('auth/login', { error: null, isAuthenticated: false });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('🔐 ========== LOGIN ==========');
  console.log('📍 Username:', username);

  if (!username || !password) {
    console.log('❌ Usuário ou senha vazios');
    return res.render('auth/login', { error: 'Usuário e senha são obrigatórios' });
  }

  try {
    // Buscar usuário
    let user;
    try {
      user = await Promise.resolve(users.findByUsername(username));
    } catch (err) {
      console.error('❌ Erro ao buscar usuário:', err);
      console.error('Stack:', err.stack);
      return res.render('auth/login', { error: 'Erro ao buscar usuário. Tente novamente.' });
    }

    if (!user) {
      console.log('❌ Usuário não encontrado:', username);
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    console.log('✅ Usuário encontrado:', user.username);
    console.log('📋 Dados do usuário:', {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      hasPassword: !!user.password,
      passwordLength: user.password ? user.password.length : 0
    });

    // Verificar senha
    let validPassword = false;
    try {
      if (!user.password) {
        console.log('❌ Usuário não tem senha definida');
        return res.render('auth/login', { error: 'Usuário não tem senha definida. Entre em contato com o suporte.' });
      }
      
      validPassword = await bcrypt.compare(password, user.password);
      console.log('🔐 Comparação de senha:', {
        passwordProvided: password ? 'sim' : 'não',
        passwordHash: user.password ? user.password.substring(0, 20) + '...' : 'não existe',
        valid: validPassword
      });
    } catch (err) {
      console.error('❌ Erro ao comparar senha:', err);
      console.error('Stack:', err.stack);
      return res.render('auth/login', { error: 'Erro ao verificar senha. Tente novamente.' });
    }

    if (!validPassword) {
      console.log('❌ Senha incorreta para usuário:', username);
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    console.log('✅ Senha válida');

    // Buscar payment_status
    let paymentStatus = user.payment_status || 'pending';
    if (!paymentStatus || paymentStatus === 'undefined' || paymentStatus === 'null') {
      try {
        const fullUser = await Promise.resolve(users.findById(user.id));
        paymentStatus = fullUser?.payment_status || 'pending';
      } catch (err) {
        paymentStatus = 'pending';
      }
    }
    
    // Determinar URL de redirecionamento
    let redirectUrl = user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
    
    // Verificar se tem fatura pendente (apenas para usuários normais)
    if (user.role !== 'admin') {
      try {
        const { invoices } = require('../database');
        if (invoices && invoices.findByUserId) {
          const userInvoices = await Promise.resolve(invoices.findByUserId(user.id));
          if (userInvoices && Array.isArray(userInvoices)) {
            const pendingInvoice = userInvoices.find(inv => inv.status === 'pending');
            if (pendingInvoice && paymentStatus === 'pending') {
              redirectUrl = `/payment/pending?invoice=${pendingInvoice.id}`;
            }
          }
        }
      } catch (err) {
        // Ignorar erro - não crítico
      }
    }
    
    // Gerar token único
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 dias
    
    // Armazenar token
    tokenStore.set(token, {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      payment_status: paymentStatus,
      expires: expires
    });
    
    console.log('✅ Token gerado e armazenado');
    console.log('📍 Token:', token.substring(0, 20) + '...');
    console.log('📍 Expira em:', new Date(expires).toISOString());
    console.log('🔀 Redirecionando para:', redirectUrl);
    console.log('==========================================');

    // Redirecionar com token na URL (o JavaScript vai salvar no localStorage)
    res.redirect(`${redirectUrl}?token=${token}`);

  } catch (error) {
    console.error('❌ Erro no login:', error);
    console.error('Stack:', error.stack);
    res.render('auth/login', { error: 'Erro ao fazer login: ' + error.message });
  }
});

// Registro (apenas para criar usuários normais)
router.get('/register', (req, res) => {
  const { plan } = req.query;
  res.render('auth/register', { error: null, plan: plan || null });
});

router.post('/register', async (req, res) => {
  const { username, email, password, confirmPassword, plan } = req.body;

  if (password !== confirmPassword) {
    return res.render('auth/register', { error: 'Senhas não coincidem', plan: plan || null });
  }

  if (!plan) {
    return res.render('auth/register', { error: 'Por favor, selecione um plano primeiro', plan: null });
  }

  try {
    // Verificar se usuário já existe
    const existingUser = await Promise.resolve(users.findByUsername(username));
    
    if (existingUser) {
      return res.render('auth/register', { error: 'Usuário já existe', plan: plan || null });
    }

    // Verificar se email já existe
    const existingByEmail = await Promise.resolve(users.findByEmail(email));
    
    if (existingByEmail) {
      return res.render('auth/register', { error: 'Email já está em uso', plan: plan || null });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Criar usuário
    const userId = await Promise.resolve(users.create(username, email, hashedPassword, 'user'));

    // Definir payment_status como pending
    try {
      const { users: userDB } = require('../database');
      if (userDB && userDB.updatePaymentStatus) {
        await Promise.resolve(userDB.updatePaymentStatus(userId, 'pending'));
      }
    } catch (err) {
      // Ignorar erro - não crítico
    }

    // Buscar usuário criado
    const createdUser = await Promise.resolve(users.findById(userId));
    
    if (!createdUser) {
      return res.render('auth/register', { error: 'Erro ao criar conta. Tente novamente.', plan: plan || null });
    }

    // Gerar token
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 dias
    
    tokenStore.set(token, {
      userId: createdUser.id,
      username: createdUser.username,
      email: createdUser.email,
      role: createdUser.role,
      payment_status: 'pending',
      expires: expires
    });
    
    res.redirect(`/payment/checkout/${plan}?token=${token}`);
  } catch (error) {
    console.error('Erro no registro:', error);
    res.render('auth/register', { error: 'Erro ao criar conta: ' + error.message, plan: plan || null });
  }
});

// Logout
router.post('/logout', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.body.token || req.query.token;
  if (token) {
    tokenStore.delete(token);
  }
  res.redirect('/auth/login');
});

// Verificar token
router.get('/verify', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (token && tokenStore.has(token)) {
    const userData = tokenStore.get(token);
    if (userData.expires > Date.now()) {
      return res.json({ valid: true, user: userData });
    } else {
      tokenStore.delete(token);
    }
  }
  res.json({ valid: false });
});

module.exports = router;
module.exports.tokenStore = tokenStore;
