const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const { users } = require('../database');
const { createAuthCookie, clearAuthCookie } = require('../middleware/auth');

// Login
router.get('/login', (req, res) => {
  // Se já está autenticado (req.user vem do attachUser middleware)
  if (req.user) {
    const redirectUrl = req.user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
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
      user = await Promise.resolve(users.findByUsername(username));
    } catch (err) {
      user = users.findByUsername(username);
    }

    if (!user) {
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    // Verificar senha
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.render('auth/login', { error: 'Usuário ou senha incorretos' });
    }

    // Criar cookie
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    console.log('📝 Criando cookie para login...');
    const cookieCreated = createAuthCookie(res, userData);
    
    if (!cookieCreated) {
      console.error('❌ Falha ao criar cookie no login');
      return res.render('auth/login', { error: 'Erro ao criar sessão' });
    }

    // IMPORTANTE: Verificar se o cookie foi realmente definido
    console.log('🔍 Verificando se cookie foi definido na resposta...');
    const setCookieHeader = res.getHeader('Set-Cookie');
    if (setCookieHeader) {
      console.log('✅ Set-Cookie header encontrado:', Array.isArray(setCookieHeader) ? setCookieHeader[0].substring(0, 50) + '...' : setCookieHeader.substring(0, 50) + '...');
    } else {
      console.error('❌ Set-Cookie header NÃO encontrado!');
    }

    // Redirecionar
    const redirectUrl = user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
    console.log('🔀 Redirecionando para:', redirectUrl);
    
    // Usar redirect explícito
    return res.redirect(302, redirectUrl);
  } catch (error) {
    console.error('❌ Erro no login:', error);
    res.render('auth/login', { error: 'Erro ao fazer login' });
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
  if (req.session) {
    req.session.destroy();
  }
  clearAuthCookie(res);
  res.redirect('/auth/login');
});

module.exports = router;

