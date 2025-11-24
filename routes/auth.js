const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { users } = require('../database');

// Login
router.get('/login', (req, res) => {
  // Se já está autenticado, verificar status de pagamento
  if (req.session && req.session.user) {
    const user = req.session.user;
    
    // Admin sempre vai para dashboard
    if (user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    
    // Usuário com pagamento confirmado vai para dashboard
    if (user.payment_status === 'paid') {
      return res.redirect('/user/dashboard');
    }
    
    // Usuário com pagamento pendente - verificar se tem fatura
    if (user.payment_status === 'pending') {
      const { invoices } = require('../database');
      let pendingInvoice = null;
      
      try {
        let userInvoices;
        if (invoices.findByUserId.constructor.name === 'AsyncFunction') {
          userInvoices = await invoices.findByUserId(user.id);
        } else {
          userInvoices = invoices.findByUserId(user.id);
        }
        
        pendingInvoice = userInvoices.find(inv => inv.status === 'pending');
      } catch (err) {
        console.error('Erro ao buscar faturas no login:', err);
      }
      
      if (pendingInvoice) {
        return res.redirect(`/payment/pending?invoice=${pendingInvoice.id}`);
      } else {
        // Se não tem fatura, pode ver a home para escolher plano
        return res.redirect('/#planos');
      }
    }
  }
  
  // Se não está autenticado, mostrar página de login
  res.render('auth/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // Buscar usuário
    let user;
    try {
      if (users.findByUsername.constructor.name === 'AsyncFunction') {
        user = await users.findByUsername(username);
      } else {
        user = users.findByUsername(username);
      }
    } catch (err) {
      user = users.findByUsername(username);
    }

    if (!user) {
      console.log('❌ Usuário não encontrado:', username);
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('❌ Senha incorreta para usuário:', username);
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    console.log('✅ Login bem-sucedido para:', username);
    
    // Buscar payment_status do usuário (pode não estar na query, buscar do banco)
    let paymentStatus = user.payment_status || 'pending';
    if (!paymentStatus) {
      // Se não veio na query, buscar do banco
      const { users: userDB } = require('../database');
      let fullUser;
      try {
        if (userDB.findById.constructor.name === 'AsyncFunction') {
          fullUser = await userDB.findById(user.id);
        } else {
          fullUser = userDB.findById(user.id);
        }
      } catch (err) {
        fullUser = userDB.findById(user.id);
      }
      paymentStatus = fullUser?.payment_status || 'pending';
    }
    
    // Verificar payment_status e determinar redirect antes de salvar sessão
    let redirectUrl;
    
    if (user.role === 'admin') {
      // Admin sempre vai para dashboard
      redirectUrl = '/admin/dashboard';
    } else if (paymentStatus === 'pending') {
      // Usuário com pagamento pendente - verificar se tem fatura
      const { invoices } = require('../database');
      let pendingInvoice = null;
      
      try {
        let userInvoices;
        if (invoices.findByUserId.constructor.name === 'AsyncFunction') {
          userInvoices = await invoices.findByUserId(user.id);
        } else {
          userInvoices = invoices.findByUserId(user.id);
        }
        
        pendingInvoice = userInvoices.find(inv => inv.status === 'pending');
      } catch (err) {
        console.error('Erro ao buscar faturas no login:', err);
      }
      
      if (pendingInvoice) {
        // Se tem fatura pendente, ir para página de pagamento pendente
        redirectUrl = `/payment/pending?invoice=${pendingInvoice.id}`;
        console.log('🔀 Usuário com pagamento pendente - redirecionando para:', redirectUrl);
      } else {
        // Se não tem fatura, ir para home para escolher plano
        redirectUrl = '/#planos';
        console.log('🔀 Usuário sem fatura - redirecionando para escolher plano');
      }
    } else {
      // Usuário com pagamento confirmado - ir para dashboard
      redirectUrl = '/user/dashboard';
    }
    
    // Criar sessão
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      payment_status: paymentStatus
    };
    
    // Salvar sessão explicitamente e redirecionar
    req.session.save((err) => {
      if (err) {
        console.error('❌ Erro ao salvar sessão:', err);
        return res.render('auth/login', { error: 'Erro ao criar sessão' });
      }
      
      console.log('✅ Sessão criada com sucesso');
      console.log('🔀 Redirecionando para:', redirectUrl);
      res.redirect(redirectUrl);
    });

  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.render('auth/login', { error: 'Erro ao fazer login: ' + error.message });
  }
});

// Registro (apenas para criar usuários normais)
router.get('/register', (req, res) => {
  const { plan } = req.query; // Plano selecionado na home
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
    let existingUser;
    try {
      if (users.findByUsername.constructor.name === 'AsyncFunction') {
        existingUser = await users.findByUsername(username);
      } else {
        existingUser = users.findByUsername(username);
      }
    } catch (err) {
      existingUser = users.findByUsername(username);
    }
    
    if (existingUser) {
      return res.render('auth/register', { error: 'Usuário já existe', plan: plan || null });
    }

    // Verificar se email já existe
    let existingByEmail;
    try {
      if (users.findByEmail.constructor.name === 'AsyncFunction') {
        existingByEmail = await users.findByEmail(email);
      } else {
        existingByEmail = users.findByEmail(email);
      }
    } catch (err) {
      existingByEmail = users.findByEmail(email);
    }
    
    if (existingByEmail) {
      return res.render('auth/register', { error: 'Email já está em uso', plan: plan || null });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Criar usuário com payment_status = 'pending'
    let userId;
    try {
      if (users.create.constructor.name === 'AsyncFunction') {
        userId = await users.create(username, email, hashedPassword, 'user');
      } else {
        userId = users.create(username, email, hashedPassword, 'user');
      }
    } catch (err) {
      userId = users.create(username, email, hashedPassword, 'user');
    }

    // Definir payment_status como pending
    const { users: userDB } = require('../database');
    try {
      if (userDB.updatePaymentStatus.constructor.name === 'AsyncFunction') {
        await userDB.updatePaymentStatus(userId, 'pending');
      } else {
        userDB.updatePaymentStatus(userId, 'pending');
      }
    } catch (err) {
      userDB.updatePaymentStatus(userId, 'pending');
    }

    // Criar sessão para o usuário recém-criado
    let createdUser;
    try {
      if (users.findById.constructor.name === 'AsyncFunction') {
        createdUser = await users.findById(userId);
      } else {
        createdUser = users.findById(userId);
      }
    } catch (err) {
      createdUser = users.findById(userId);
    }
    
    if (!createdUser) {
      return res.render('auth/register', { error: 'Erro ao criar conta. Tente novamente.', plan: plan || null });
    }

    // Criar sessão
    req.session.user = {
      id: createdUser.id,
      username: createdUser.username,
      email: createdUser.email,
      role: createdUser.role,
      payment_status: 'pending'
    };

    console.log('✅ Usuário criado:', createdUser.username);
    console.log('📝 Payment Status:', 'pending');
    console.log('🔀 Redirecionando para checkout:', `/payment/checkout/${plan}`);
    
    // Redirecionar para checkout com o plano selecionado
    // A sessão será salva automaticamente pelo express-session
    res.redirect(`/payment/checkout/${plan}`);
  } catch (error) {
    console.error('Erro no registro:', error);
    res.render('auth/register', { error: 'Erro ao criar conta: ' + error.message, plan: plan || null });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Erro ao destruir sessão:', err);
    }
    res.redirect('/auth/login');
  });
});

module.exports = router;
