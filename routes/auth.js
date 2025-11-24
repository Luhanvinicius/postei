const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { users } = require('../database');

// Login
router.get('/login', (req, res) => {
  // Se já está autenticado, redirecionar
  if (req.session && req.session.user) {
    const redirectUrl = req.session.user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
    return res.redirect(redirectUrl);
  }
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
    
    // Buscar payment_status do usuário
    const paymentStatus = user.payment_status || 'pending';
    
    // Criar sessão
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      payment_status: paymentStatus
    };
    
    // Salvar sessão explicitamente
    req.session.save((err) => {
      if (err) {
        console.error('❌ Erro ao salvar sessão:', err);
        return res.render('auth/login', { error: 'Erro ao criar sessão' });
      }
      
      console.log('✅ Sessão criada com sucesso');
      
      // Redirecionar
      const redirectUrl = user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
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

    // Redirecionar para checkout com o plano selecionado
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
