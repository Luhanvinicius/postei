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

  console.log('🔐 ========== LOGIN ==========');
  console.log('📍 Username:', username);

  if (!username || !password) {
    console.log('❌ Usuário ou senha vazios');
    return res.render('auth/login', { error: 'Usuário e senha são obrigatórios' });
  }

  try {
    // Buscar usuário
    const user = await Promise.resolve(users.findByUsername(username));

    if (!user) {
      console.log('❌ Usuário não encontrado:', username);
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    console.log('✅ Usuário encontrado:', user.username);

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      console.log('❌ Senha incorreta');
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
    
    // Criar dados da sessão
    const sessionData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      payment_status: paymentStatus
    };
    
    console.log('📝 Criando sessão:', sessionData);
    
    // IMPORTANTE: Regenerar sessão para garantir novo ID seguro
    return new Promise((resolve) => {
      req.session.regenerate((regenerateErr) => {
        if (regenerateErr) {
          console.error('❌ Erro ao regenerar sessão:', regenerateErr);
          return res.render('auth/login', { error: 'Erro ao criar sessão. Tente novamente.' });
        }

        // Definir dados do usuário na nova sessão
        req.session.user = sessionData;
        
        // Salvar sessão
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('❌ Erro ao salvar sessão:', saveErr);
            return res.render('auth/login', { error: 'Erro ao criar sessão. Tente novamente.' });
          }

          console.log('✅ Sessão criada e salva');
          console.log('📍 Session ID:', req.sessionID);
          console.log('📍 Session user:', JSON.stringify(req.session.user));
          console.log('🔀 Redirecionando para:', redirectUrl);
          console.log('==========================================');

          // Redirecionar
          res.redirect(redirectUrl);
          resolve();
        });
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
