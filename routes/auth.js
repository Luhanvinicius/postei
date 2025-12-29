const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { users } = require('../database');

// Login
router.get('/login', async (req, res) => {
  // Se já está autenticado, redirecionar para dashboard apropriado
  if (req.session && req.session.user) {
    if (req.session.user.role === 'admin') {
      return res.redirect('/admin/dashboard');
    }
    return res.redirect('/user/dashboard');
  }
  
  res.render('auth/login', { error: null, isAuthenticated: false });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  console.log('🔐 ========== TENTATIVA DE LOGIN ==========');
  console.log('📍 Username:', username);
  console.log('📍 Has password:', !!password);
  console.log('📍 Session ID antes:', req.sessionID);
  console.log('📍 Session antes:', JSON.stringify(req.session));

  if (!username || !password) {
    console.log('❌ Usuário ou senha vazios');
    return res.render('auth/login', { error: 'Usuário e senha são obrigatórios' });
  }

  try {
    // Buscar usuário
    let user;
    try {
      if (users && users.findByUsername) {
        const isAsync = users.findByUsername.constructor && users.findByUsername.constructor.name === 'AsyncFunction';
        if (isAsync) {
          user = await users.findByUsername(username);
        } else {
          user = users.findByUsername(username);
        }
      }
    } catch (err) {
      console.error('❌ Erro ao buscar usuário:', err);
      if (users && users.findByUsername) {
        user = users.findByUsername(username);
      }
    }

    if (!user) {
      console.log('❌ Usuário não encontrado:', username);
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    console.log('✅ Usuário encontrado:', user.username, 'ID:', user.id, 'Role:', user.role);

    // Verificar senha
    let validPassword = false;
    try {
      validPassword = await bcrypt.compare(password, user.password);
    } catch (err) {
      console.error('❌ Erro ao comparar senha:', err);
      return res.render('auth/login', { error: 'Erro ao verificar senha. Tente novamente.' });
    }

    if (!validPassword) {
      console.log('❌ Senha incorreta para usuário:', username);
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    console.log('✅ Senha válida para:', username);
    
    // Buscar payment_status do usuário
    let paymentStatus = user.payment_status || 'pending';
    if (!paymentStatus || paymentStatus === 'undefined' || paymentStatus === 'null') {
      const { users: userDB } = require('../database');
      let fullUser;
      try {
        if (userDB && userDB.findById) {
          const isAsync = userDB.findById.constructor && userDB.findById.constructor.name === 'AsyncFunction';
          if (isAsync) {
            fullUser = await userDB.findById(user.id);
          } else {
            fullUser = userDB.findById(user.id);
          }
        }
      } catch (err) {
        if (userDB && userDB.findById) {
          fullUser = userDB.findById(user.id);
        }
      }
      paymentStatus = fullUser?.payment_status || 'pending';
    }
    
    // Determinar URL de redirecionamento
    let redirectUrl;
    
    if (user.role === 'admin') {
      redirectUrl = '/admin/dashboard';
    } else {
      redirectUrl = '/user/dashboard';
      
      // Verificar se tem fatura pendente
      try {
        const { invoices } = require('../database');
        let userInvoices;
        if (invoices && invoices.findByUserId) {
          const isAsync = invoices.findByUserId.constructor && invoices.findByUserId.constructor.name === 'AsyncFunction';
          if (isAsync) {
            userInvoices = await invoices.findByUserId(user.id);
          } else {
            userInvoices = invoices.findByUserId(user.id);
          }
        }
        
        if (userInvoices && Array.isArray(userInvoices)) {
          const pendingInvoice = userInvoices.find(inv => inv.status === 'pending');
          if (pendingInvoice && paymentStatus === 'pending') {
            redirectUrl = `/payment/pending?invoice=${pendingInvoice.id}`;
          }
        }
      } catch (err) {
        console.error('⚠️ Erro ao buscar faturas no login (não crítico):', err.message);
      }
    }
    
    // Criar dados da sessão
    const sessionData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      payment_status: paymentStatus
    };
    
    console.log('📝 Criando sessão com dados:', JSON.stringify(sessionData, null, 2));
    
    // Definir sessão
    req.session.user = sessionData;
    
    // Salvar sessão usando Promise para garantir que seja salva antes de redirecionar
    return new Promise((resolve) => {
      req.session.save((err) => {
        if (err) {
          console.error('❌ Erro ao salvar sessão:', err);
          console.error('Stack:', err.stack);
          return res.render('auth/login', { error: 'Erro ao criar sessão. Tente novamente.' });
        }
        
        console.log('✅ Sessão salva com sucesso!');
        console.log('📍 Session ID após salvar:', req.sessionID);
        console.log('📍 Session user após salvar:', JSON.stringify(req.session.user));
        console.log('📍 Session cookie config:', {
          secure: req.session.cookie.secure,
          httpOnly: req.session.cookie.httpOnly,
          sameSite: req.session.cookie.sameSite,
          maxAge: req.session.cookie.maxAge,
          path: req.session.cookie.path
        });
        console.log('🔀 Redirecionando para:', redirectUrl);
        console.log('==========================================');
        
        // Redirecionar usando res.redirect() padrão do Express
        res.redirect(redirectUrl);
        resolve();
      });
    });

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
    let existingUser;
    try {
      if (users && users.findByUsername) {
        const isAsync = users.findByUsername.constructor && users.findByUsername.constructor.name === 'AsyncFunction';
        if (isAsync) {
          existingUser = await users.findByUsername(username);
        } else {
          existingUser = users.findByUsername(username);
        }
      }
    } catch (err) {
      if (users && users.findByUsername) {
        existingUser = users.findByUsername(username);
      }
    }
    
    if (existingUser) {
      return res.render('auth/register', { error: 'Usuário já existe', plan: plan || null });
    }

    // Verificar se email já existe
    let existingByEmail;
    try {
      if (users && users.findByEmail) {
        const isAsync = users.findByEmail.constructor && users.findByEmail.constructor.name === 'AsyncFunction';
        if (isAsync) {
          existingByEmail = await users.findByEmail(email);
        } else {
          existingByEmail = users.findByEmail(email);
        }
      }
    } catch (err) {
      if (users && users.findByEmail) {
        existingByEmail = users.findByEmail(email);
      }
    }
    
    if (existingByEmail) {
      return res.render('auth/register', { error: 'Email já está em uso', plan: plan || null });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Criar usuário
    let userId;
    try {
      if (users && users.create) {
        const isAsync = users.create.constructor && users.create.constructor.name === 'AsyncFunction';
        if (isAsync) {
          userId = await users.create(username, email, hashedPassword, 'user');
        } else {
          userId = users.create(username, email, hashedPassword, 'user');
        }
      }
    } catch (err) {
      if (users && users.create) {
        userId = users.create(username, email, hashedPassword, 'user');
      }
    }

    // Definir payment_status como pending
    const { users: userDB } = require('../database');
    try {
      if (userDB && userDB.updatePaymentStatus) {
        const isAsync = userDB.updatePaymentStatus.constructor && userDB.updatePaymentStatus.constructor.name === 'AsyncFunction';
        if (isAsync) {
          await userDB.updatePaymentStatus(userId, 'pending');
        } else {
          userDB.updatePaymentStatus(userId, 'pending');
        }
      }
    } catch (err) {
      if (userDB && userDB.updatePaymentStatus) {
        userDB.updatePaymentStatus(userId, 'pending');
      }
    }

    // Buscar usuário criado
    let createdUser;
    try {
      if (users && users.findById) {
        const isAsync = users.findById.constructor && users.findById.constructor.name === 'AsyncFunction';
        if (isAsync) {
          createdUser = await users.findById(userId);
        } else {
          createdUser = users.findById(userId);
        }
      }
    } catch (err) {
      if (users && users.findById) {
        createdUser = users.findById(userId);
      }
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

    // Salvar sessão antes de redirecionar
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    
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
