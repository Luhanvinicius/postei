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
  // Garantir que sempre haverá uma resposta
  let responseSent = false;
  
  const sendResponse = (status, data) => {
    if (responseSent) return;
    responseSent = true;
    if (status === 'render') {
      res.render('auth/login', data);
    } else if (status === 'redirect') {
      res.redirect(data);
    } else {
      res.status(status).json(data);
    }
  };

  const { username, password } = req.body;

  console.log('🔐 ========== TENTATIVA DE LOGIN ==========');
  console.log('📍 Username:', username);
  console.log('📍 Has password:', !!password);
  console.log('📍 Session ID antes:', req.sessionID);
  console.log('📍 Session antes:', JSON.stringify(req.session));
  console.log('📍 Body completo:', JSON.stringify(req.body));

  if (!username || !password) {
    console.log('❌ Usuário ou senha vazios');
    return sendResponse('render', { error: 'Usuário e senha são obrigatórios' });
  }

  // Timeout de segurança (10 segundos)
  const timeout = setTimeout(() => {
    if (!responseSent) {
      console.error('⏱️ Timeout no login após 10 segundos');
      sendResponse('render', { error: 'Tempo de resposta excedido. Tente novamente.' });
    }
  }, 10000);

  try {
    // Buscar usuário
    let user;
    try {
      if (!users || !users.findByUsername) {
        console.error('❌ Módulo users não encontrado ou findByUsername não disponível');
        clearTimeout(timeout);
        return sendResponse('render', { error: 'Erro ao conectar com o banco de dados. Tente novamente.' });
      }
      
      // Sempre usar await - funciona tanto para SQLite (síncrono) quanto PostgreSQL (assíncrono)
      user = await Promise.resolve(users.findByUsername(username));
    } catch (err) {
      console.error('❌ Erro ao buscar usuário:', err);
      console.error('Stack:', err.stack);
      clearTimeout(timeout);
      return sendResponse('render', { error: 'Erro ao buscar usuário. Tente novamente.' });
    }

    if (!user) {
      console.log('❌ Usuário não encontrado:', username);
      clearTimeout(timeout);
      return sendResponse('render', { error: 'Usuário ou senha incorretos' });
    }

    console.log('✅ Usuário encontrado:', user.username, 'ID:', user.id, 'Role:', user.role);

    // Verificar senha
    let validPassword = false;
    try {
      validPassword = await bcrypt.compare(password, user.password);
    } catch (err) {
      console.error('❌ Erro ao comparar senha:', err);
      clearTimeout(timeout);
      return sendResponse('render', { error: 'Erro ao verificar senha. Tente novamente.' });
    }

    if (!validPassword) {
      console.log('❌ Senha incorreta para usuário:', username);
      clearTimeout(timeout);
      return sendResponse('render', { error: 'Usuário ou senha incorretos' });
    }

    console.log('✅ Senha válida para:', username);
    
    // Buscar payment_status do usuário
    let paymentStatus = user.payment_status || 'pending';
    if (!paymentStatus || paymentStatus === 'undefined' || paymentStatus === 'null') {
      try {
        if (users && users.findById) {
          const fullUser = await Promise.resolve(users.findById(user.id));
          paymentStatus = fullUser?.payment_status || 'pending';
        }
      } catch (err) {
        console.error('⚠️ Erro ao buscar payment_status completo (não crítico):', err.message);
        paymentStatus = 'pending';
      }
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
        clearTimeout(timeout);
        
        if (err) {
          console.error('❌ Erro ao salvar sessão:', err);
          console.error('Stack:', err.stack);
          sendResponse('render', { error: 'Erro ao criar sessão. Tente novamente.' });
          return resolve();
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
        
        // Verificar se o cookie será enviado
        const cookieHeader = res.getHeader('Set-Cookie');
        console.log('📍 Cookie sendo enviado:', cookieHeader ? 'sim' : 'não');
        if (cookieHeader) {
          console.log('📍 Cookie value:', Array.isArray(cookieHeader) ? cookieHeader[0] : cookieHeader);
        }
        
        console.log('🔀 Redirecionando para:', redirectUrl);
        console.log('==========================================');
        
        // Garantir que o cookie seja enviado antes de redirecionar
        // Usar res.redirect diretamente para garantir que o cookie seja enviado
        res.redirect(redirectUrl);
        resolve();
      });
    });

  } catch (error) {
    clearTimeout(timeout);
    console.error('❌ Erro no login:', error);
    console.error('Stack:', error.stack);
    sendResponse('render', { error: 'Erro ao fazer login: ' + error.message });
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
