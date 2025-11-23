const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { users } = require('../database');

// Login
router.get('/login', (req, res) => {
  if (req.session && req.session.user) {
    return res.redirect('/');
  }
  res.render('auth/login', { error: null });
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    // No PostgreSQL é assíncrono, no SQLite é síncrono - sempre usar await (funciona nos dois)
    let user;
    try {
      user = await Promise.resolve(users.findByUsername(username));
    } catch (err) {
      // Se for síncrono e der erro, tentar sem await
      user = users.findByUsername(username);
    }

    if (!user) {
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      console.log('❌ Senha incorreta para usuário:', username);
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    console.log('✅ Senha correta! Criando sessão para:', username);
    
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    console.log('📝 Sessão criada:', req.session.user);

    // No Vercel, SEMPRE salvar em cookie assinado como backup (para MemoryStore)
    // Isso é crítico porque MemoryStore não persiste entre requisições no Vercel
    const crypto = require('crypto');
    const userData = JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });
    const secret = process.env.SESSION_SECRET || 'change-this-secret-key';
    const signature = crypto.createHmac('sha256', secret).update(userData).digest('hex');
    const signedData = `${userData}.${signature}`;
    
    // Sempre criar cookie (não só no Vercel, mas principalmente lá)
    // IMPORTANTE: Não usar signed: true aqui, porque vamos assinar manualmente
    res.cookie('user_data', signedData, {
      httpOnly: true,
      secure: process.env.VERCEL || process.env.VERCEL_ENV ? true : false,
      sameSite: process.env.VERCEL || process.env.VERCEL_ENV ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 horas
      path: '/',
      signed: false // Não usar signed do cookie-parser, vamos assinar manualmente
    });
    console.log('🍪 Cookie de backup criado (não assinado pelo cookie-parser)');
    console.log('   Tamanho:', signedData.length, 'caracteres');
    console.log('   Primeiros 50 chars:', signedData.substring(0, 50) + '...');

    // Salvar sessão explicitamente (igual ao teste - usando await Promise)
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          console.error('❌ Erro ao salvar sessão:', err);
          reject(err);
        } else {
          console.log('✅ Sessão salva com sucesso!');
          console.log('📝 Sessão ID:', req.sessionID);
          console.log('👤 Role do usuário:', user.role);
          resolve();
        }
      });
    });

    // Redirecionar após salvar (igual ao teste)
    const redirectUrl = user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
    console.log('🔀 Redirecionando para:', redirectUrl);
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('❌ Erro no login:', error);
    console.error('Stack:', error.stack);
    res.render('auth/login', { error: 'Erro ao fazer login: ' + error.message });
  }
});

// Registro (apenas para criar usuários normais)
router.get('/register', (req, res) => {
  res.render('auth/register', { error: null });
});

router.post('/register', async (req, res) => {
  const { username, email, password, confirmPassword } = req.body;

  if (password !== confirmPassword) {
    return res.render('auth/register', { error: 'Senhas não coincidem' });
  }

  try {
    // Verificar se usuário já existe (assíncrono no PostgreSQL)
    let existingUser;
    try {
      existingUser = await Promise.resolve(users.findByUsername(username));
    } catch (err) {
      existingUser = users.findByUsername(username);
    }
    if (existingUser) {
      return res.render('auth/register', { error: 'Usuário ou email já existe' });
    }

    // Verificar se email já existe (assíncrono no PostgreSQL)
    let existingByEmail;
    try {
      existingByEmail = await Promise.resolve(users.findByEmail(email));
    } catch (err) {
      existingByEmail = users.findByEmail(email);
    }
    if (existingByEmail) {
      return res.render('auth/register', { error: 'Email já está em uso' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Tentar criar com tratamento de erro (assíncrono no PostgreSQL)
    let userId;
    try {
      userId = await Promise.resolve(users.create(username, email, hashedPassword, 'user'));
    } catch (createError) {
      if (createError.message && createError.message.includes('UNIQUE constraint')) {
        if (createError.message.includes('email')) {
          return res.render('auth/register', { error: 'Email já está em uso' });
        } else if (createError.message.includes('username')) {
          return res.render('auth/register', { error: 'Nome de usuário já existe' });
        }
      }
      throw createError;
    }

    // Verificar se foi criado corretamente (assíncrono no PostgreSQL)
    let createdUser;
    try {
      createdUser = await Promise.resolve(users.findById(userId));
    } catch (err) {
      createdUser = users.findById(userId);
    }
    if (!createdUser) {
      return res.render('auth/register', { error: 'Erro ao criar conta. Tente novamente.' });
    }

    res.redirect('/auth/login?registered=true');
  } catch (error) {
    console.error('Erro no registro:', error);
    res.render('auth/register', { error: 'Erro ao criar conta: ' + error.message });
  }
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/auth/login');
});

module.exports = router;

