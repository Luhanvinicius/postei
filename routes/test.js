const express = require('express');
const router = express.Router();
const { users, configs } = require('../database');

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
    session: null,
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

    // Criar sessão
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };

    // Salvar sessão
    await new Promise((resolve, reject) => {
      req.session.save((err) => {
        if (err) {
          testResults.errors.push('Erro ao salvar sessão: ' + err.message);
          reject(err);
        } else {
          resolve();
        }
      });
    });

    testResults.success = true;
    testResults.message = 'Login realizado com sucesso!';
    testResults.session = req.session.user;

    console.log('✅ Login de teste bem-sucedido:', testResults.session);

  } catch (error) {
    testResults.message = 'Erro durante teste: ' + error.message;
    testResults.errors.push(error.message);
    console.error('❌ Erro no teste de login:', error);
  }

  res.json(testResults);
});

module.exports = router;

