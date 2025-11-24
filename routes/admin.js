const express = require('express');
const router = express.Router();
const { users: userDB } = require('../database');

// Dashboard admin
router.get('/dashboard', async (req, res) => {
  try {
    // O middleware requireAuth já garante que req.user existe
    console.log('📊 Dashboard admin - req.user:', req.user ? req.user.username : 'null');
    console.log('📊 Dashboard admin - req.cookies:', req.cookies ? Object.keys(req.cookies) : 'nenhum');
    
    if (!req.user) {
      console.error('❌ req.user é null no dashboard!');
      return res.redirect('/auth/login');
    }
    
    console.log('📊 Dashboard admin acessado por:', req.user.username);
    
    let allUsers;
    try {
      if (userDB.getAll.constructor.name === 'AsyncFunction') {
        allUsers = await userDB.getAll();
      } else {
        allUsers = await Promise.resolve(userDB.getAll());
      }
    } catch (err) {
      allUsers = userDB.getAll();
    }
    
    // Log para debug - mostrar todos os usuários
    console.log(`📊 Total de usuários no banco: ${allUsers.length}`);
    allUsers.forEach(u => {
      console.log(`   - ID: ${u.id}, Username: ${u.username}, Email: ${u.email}`);
    });
    
    res.render('admin/dashboard', {
      user: req.user,
      users: allUsers,
      totalUsers: allUsers.length,
      adminUsers: allUsers.filter(u => u.role === 'admin').length,
      regularUsers: allUsers.filter(u => u.role === 'user').length
    });
  } catch (error) {
    console.error('Erro ao carregar dashboard:', error);
    res.render('admin/dashboard', {
      user: req.user,
      users: [],
      totalUsers: 0,
      adminUsers: 0,
      regularUsers: 0
    });
  }
});

// Gerenciar usuários
router.get('/users', (req, res) => {
  try {
    const allUsers = userDB.getAll();
    res.render('admin/users', {
      user: req.user,
      users: allUsers
    });
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
    res.render('admin/users', {
      user: req.user,
      users: []
    });
  }
});

// Criar usuário
router.post('/users/create', async (req, res) => {
  const { username, email, password, role } = req.body;

  try {
    // Validações básicas
    if (!username || !email || !password) {
      return res.json({ success: false, error: 'Preencha todos os campos obrigatórios' });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.json({ success: false, error: 'Email inválido' });
    }

    const bcrypt = require('bcryptjs');
    
    // Não fazer validação prévia - deixar o banco de dados tratar com UNIQUE constraint
    // Isso evita falsos positivos e race conditions
    console.log(`📝 Criando usuário: ${username} (${email})`);

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Log antes de criar
    console.log(`📝 Tentando criar usuário:`);
    console.log(`   Username: ${username}`);
    console.log(`   Email: ${email}`);
    console.log(`   Role: ${role || 'user'}`);
    
    // Tentar criar usuário com tratamento de erro
    // Se der erro de UNIQUE, tentar buscar novamente para ver se foi criado
    let userId;
    try {
      userId = userDB.create(username, email, hashedPassword, role || 'user');
      console.log(`✅ Usuário criado com sucesso! ID: ${userId}`);
    } catch (createError) {
      console.error(`❌ Erro ao criar usuário:`, createError);
      
      // Se der erro de UNIQUE constraint, verificar qual campo causou o erro
      if (createError.message && createError.message.includes('UNIQUE constraint')) {
        // Verificar se o usuário foi criado (pode ter sido criado em outra requisição simultânea)
        const checkUsername = userDB.findByUsernameOnly(username);
        const checkEmail = userDB.findByEmail(email);
        
        // Se o usuário existe com o mesmo username, retornar sucesso (já foi criado)
        if (checkUsername && checkUsername.username === username) {
          console.log(`✅ Usuário já existe no banco: ${username} (ID: ${checkUsername.id})`);
          return res.json({ 
            success: true, 
            message: 'Usuário criado com sucesso', 
            userId: checkUsername.id
          });
        }
        
        // Se o email existe, verificar se é do mesmo usuário ou outro
        if (checkEmail) {
          if (checkEmail.username === username) {
            // Mesmo usuário, retornar sucesso
            console.log(`✅ Usuário já existe no banco: ${username} (ID: ${checkEmail.id})`);
            return res.json({ 
              success: true, 
              message: 'Usuário criado com sucesso', 
              userId: checkEmail.id
            });
          } else {
            // Email de outro usuário
            console.log(`⚠️  Email já está em uso por outro usuário: ${email} (ID: ${checkEmail.id})`);
            return res.json({ success: false, error: 'Email já está em uso' });
          }
        }
        
        // Se não encontrou, mas deu erro de UNIQUE, informar genericamente
        return res.json({ success: false, error: 'Usuário ou email já existe no banco de dados' });
      }
      throw createError; // Re-lançar se não for erro de UNIQUE
    }

    // Verificar se o usuário foi criado corretamente
    const createdUser = userDB.findById(userId);
    if (!createdUser) {
      return res.json({ success: false, error: 'Erro ao criar usuário. Tente novamente.' });
    }

    res.json({ success: true, message: 'Usuário criado com sucesso', userId });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.json({ success: false, error: 'Erro ao criar usuário: ' + error.message });
  }
});

// Deletar usuário
router.delete('/users/:id', async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    // Verificar se o usuário existe antes de deletar
    let user;
    try {
      if (userDB.findById.constructor.name === 'AsyncFunction') {
        user = await userDB.findById(userId);
      } else {
        user = userDB.findById(userId);
      }
    } catch (err) {
      user = userDB.findById(userId);
    }
    
    if (!user) {
      return res.json({ success: false, error: 'Usuário não encontrado' });
    }
    
    console.log(`🗑️  Deletando usuário: ID ${userId}, Username: ${user.username}, Email: ${user.email}`);
    
    // Deletar usuário
    let deleted;
    try {
      if (userDB.delete.constructor.name === 'AsyncFunction') {
        deleted = await userDB.delete(userId);
      } else {
        deleted = userDB.delete(userId);
      }
    } catch (err) {
      deleted = userDB.delete(userId);
    }
    
    if (!deleted) {
      console.error(`❌ Erro: Nenhuma linha foi deletada! ID: ${userId}`);
      return res.json({ success: false, error: 'Erro ao deletar usuário. Usuário pode não existir.' });
    }
    
    // Verificar se foi deletado
    let verifyDelete;
    try {
      if (userDB.findById.constructor.name === 'AsyncFunction') {
        verifyDelete = await userDB.findById(userId);
      } else {
        verifyDelete = userDB.findById(userId);
      }
    } catch (err) {
      verifyDelete = userDB.findById(userId);
    }
    
    if (verifyDelete) {
      console.error(`❌ Erro: Usuário ainda existe após deletar! ID: ${userId}`);
      return res.json({ success: false, error: 'Erro ao deletar usuário' });
    }
    
    console.log(`✅ Usuário deletado com sucesso: ID ${userId}, Username: ${user.username}, Email: ${user.email}`);
    res.json({ success: true, message: 'Usuário deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.json({ success: false, error: 'Erro ao deletar usuário: ' + error.message });
  }
});

// Atualizar role do usuário
router.put('/users/:id/role', async (req, res) => {
  const userId = parseInt(req.params.id);
  const { role } = req.body;

  try {
    if (!role || !['admin', 'user'].includes(role)) {
      return res.json({ success: false, error: 'Role inválido. Deve ser "admin" ou "user"' });
    }

    // Verificar se o usuário existe
    let user;
    try {
      if (userDB.findById.constructor.name === 'AsyncFunction') {
        user = await userDB.findById(userId);
      } else {
        user = userDB.findById(userId);
      }
    } catch (err) {
      user = userDB.findById(userId);
    }
    
    if (!user) {
      return res.json({ success: false, error: 'Usuário não encontrado' });
    }

    // Não permitir remover o último admin
    if (role === 'user' && user.role === 'admin') {
      let allUsers;
      try {
        if (userDB.getAll.constructor.name === 'AsyncFunction') {
          allUsers = await userDB.getAll();
        } else {
          allUsers = userDB.getAll();
        }
      } catch (err) {
        allUsers = userDB.getAll();
      }
      
      const adminCount = allUsers.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        return res.json({ success: false, error: 'Não é possível remover o último administrador' });
      }
    }
    
    // Atualizar role
    let updated;
    try {
      if (userDB.updateRole.constructor.name === 'AsyncFunction') {
        updated = await userDB.updateRole(userId, role);
      } else {
        updated = userDB.updateRole(userId, role);
      }
    } catch (err) {
      updated = userDB.updateRole(userId, role);
    }
    
    if (!updated) {
      return res.json({ success: false, error: 'Erro ao atualizar role do usuário' });
    }
    
    console.log(`✅ Role atualizado: ID ${userId}, Username: ${user.username}, Novo role: ${role}`);
    res.json({ success: true, message: 'Role atualizado com sucesso' });
  } catch (error) {
    console.error('Erro ao atualizar role:', error);
    res.json({ success: false, error: 'Erro ao atualizar role: ' + error.message });
  }
});

module.exports = router;

