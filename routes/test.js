const express = require('express');
const router = express.Router();
const { users, configs } = require('../database');

// Importar função de leitura de cookie
let readAuthCookie;
try {
  const authMiddleware = require('../middleware/auth');
  readAuthCookie = authMiddleware.readAuthCookie || (() => null);
} catch (err) {
  console.error('Erro ao importar middleware de auth:', err);
  readAuthCookie = () => null;
}
const { readAuthCookie } = require('../middleware/auth');

// Página de teste de conexão
router.get('/test', async (req, res) => {
  const results = {
    database: {
      status: 'unknown',
      message: '',
      users: [],
      error: null
    },
    session: {
      status: 'unknown',
      message: '',
      data: null
    },
    environment: {
      vercel: process.env.VERCEL || 'false',
      nodeEnv: process.env.NODE_ENV || 'development',
      hasDatabaseUrl: !!(process.env.DATABASE_URL || process.env.POSTGRES_URL)
    }
  };

  // Testar banco de dados
  try {
    console.log('🧪 Testando conexão com banco de dados...');
    
    // Tentar buscar usuários
    let allUsers;
    try {
      if (users.getAll.constructor.name === 'AsyncFunction') {
        allUsers = await users.getAll();
      } else {
        allUsers = users.getAll();
      }
      results.database.status = 'connected';
      results.database.message = `✅ Banco conectado! ${allUsers.length} usuários encontrados.`;
      results.database.users = allUsers.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        role: u.role
      }));
    } catch (dbError) {
      results.database.status = 'error';
      results.database.message = '❌ Erro ao buscar usuários';
      results.database.error = dbError.message;
      console.error('Erro ao buscar usuários:', dbError);
    }
  } catch (error) {
    results.database.status = 'error';
    results.database.message = '❌ Erro ao conectar com banco';
    results.database.error = error.message;
    console.error('Erro ao testar banco:', error);
  }

  // Testar sessão
  try {
    if (req.session) {
      results.session.status = 'active';
      results.session.message = '✅ Sessão ativa';
      results.session.data = req.session.user || null;
    } else {
      results.session.status = 'inactive';
      results.session.message = '❌ Sessão não encontrada';
    }
  } catch (error) {
    results.session.status = 'error';
    results.session.message = '❌ Erro ao verificar sessão';
    results.session.error = error.message;
  }

  // Renderizar página de teste
  res.render('test', { results });
});

// Teste de login direto
router.post('/test-login', async (req, res) => {
  const { username, password } = req.body;
  const testResults = {
    success: false,
    message: '',
    user: null,
    cookie: null,
    redirect: null,
    errors: []
  };

  try {
    console.log('🧪 Testando login:', username);

    // Buscar usuário
    let user;
    try {
      if (users.findByUsername.constructor.name === 'AsyncFunction') {
        user = await users.findByUsername(username);
      } else {
        user = await Promise.resolve(users.findByUsername(username));
      }
    } catch (err) {
      user = users.findByUsername(username);
    }

    if (!user) {
      testResults.message = 'Usuário não encontrado';
      testResults.errors.push('Usuário não encontrado no banco de dados');
      return res.json(testResults);
    }

    testResults.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    // Verificar senha
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      testResults.message = 'Senha incorreta';
      testResults.errors.push('Senha não confere');
      return res.json(testResults);
    }

    // Criar cookie (mesma lógica do login normal)
    const { createAuthCookie } = require('../middleware/auth');
    const userData = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    if (createAuthCookie(res, userData)) {
      testResults.success = true;
      testResults.message = 'Login realizado com sucesso!';
      testResults.cookie = 'Cookie criado';
      testResults.redirect = user.role === 'admin' ? '/admin/dashboard' : '/user/dashboard';
      console.log('✅ Login de teste bem-sucedido, redirecionando para:', testResults.redirect);
    } else {
      testResults.errors.push('Erro ao criar cookie');
    }

  } catch (error) {
    testResults.message = 'Erro durante teste: ' + error.message;
    testResults.errors.push(error.message);
    console.error('❌ Erro no teste de login:', error);
  }

  res.json(testResults);
});

// Rota de debug de cookies (JSON)
router.get('/debug-cookie', (req, res) => {
  const cookieValue = req.cookies?.user_data;
  const userFromCookie = readAuthCookie(req);
  
  const debug = {
    timestamp: new Date().toISOString(),
    environment: {
      isVercel: process.env.VERCEL === '1' || !!process.env.VERCEL_ENV,
      nodeEnv: process.env.NODE_ENV
    },
    cookies: {
      all: req.cookies || {},
      user_data: cookieValue ? {
        exists: true,
        type: typeof cookieValue,
        length: cookieValue.length,
        preview: cookieValue.substring(0, 100) + '...',
        hasSignature: cookieValue.includes('.')
      } : {
        exists: false
      },
      signedCookies: req.signedCookies || {}
    },
    headers: {
      cookie: req.headers.cookie || 'não encontrado',
      'user-agent': req.headers['user-agent'] || 'não encontrado'
    },
    authentication: {
      userFromCookie: userFromCookie,
      reqUser: req.user || null,
      match: userFromCookie && req.user ? 
        (userFromCookie.username === req.user.username) : false
    },
    session: {
      exists: !!req.session,
      user: req.session?.user || null
    }
  };
  
  // Se for requisição com Accept: text/html, renderizar página HTML
  if (req.headers.accept && req.headers.accept.includes('text/html')) {
    res.render('test-debug', { debug });
  } else {
    res.json(debug);
  }
});

module.exports = router;

