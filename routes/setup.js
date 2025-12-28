/**
 * Rota temporária para criar usuários de teste
 * Acesse: /setup/create-users?secret=SUA_CHAVE_SECRETA
 * 
 * IMPORTANTE: Remova ou desative esta rota após criar os usuários em produção!
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// Chave secreta para proteger a rota (configure no .env)
const SETUP_SECRET = process.env.SETUP_SECRET || 'change-this-secret-key-in-production';

router.get('/create-users', async (req, res) => {
  const { secret } = req.query;

  // Verificar chave secreta
  if (secret !== SETUP_SECRET) {
    return res.status(403).json({
      success: false,
      error: 'Chave secreta inválida. Configure SETUP_SECRET nas variáveis de ambiente.'
    });
  }

  try {
    const db = require('../database');
    const users = db.users || db;

    const results = {
      admin: null,
      teste: null,
      errors: []
    };

    // Criar usuário ADMIN
    console.log('👤 Criando usuário ADMIN...');
    const adminUsername = 'admin';
    const adminEmail = 'admin@postei.pro';
    const adminPassword = 'admin123';
    
    try {
      // Verificar se admin já existe
      let existingAdmin;
      if (users.findByUsername) {
        const isAsync = users.findByUsername.constructor && users.findByUsername.constructor.name === 'AsyncFunction';
        if (isAsync) {
          existingAdmin = await users.findByUsername(adminUsername);
        } else {
          existingAdmin = users.findByUsername(adminUsername);
        }
      }

      if (existingAdmin) {
        // Se existe, vamos resetar a senha
        console.log('⚠️ Admin já existe, resetando senha...');
        const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
        
        // Atualizar senha
        if (users.updatePassword && existingAdmin.id) {
          const isAsync = users.updatePassword.constructor && users.updatePassword.constructor.name === 'AsyncFunction';
          if (isAsync) {
            await users.updatePassword(existingAdmin.id, hashedAdminPassword);
          } else {
            users.updatePassword(existingAdmin.id, hashedAdminPassword);
          }
        }
        
        // Atualizar payment_status para 'paid'
        if (users.updatePaymentStatus && existingAdmin.id) {
          const isAsync = users.updatePaymentStatus.constructor && users.updatePaymentStatus.constructor.name === 'AsyncFunction';
          if (isAsync) {
            await users.updatePaymentStatus(existingAdmin.id, 'paid');
          } else {
            users.updatePaymentStatus(existingAdmin.id, 'paid');
          }
        }

        results.admin = {
          success: true,
          message: 'Senha do admin resetada com sucesso',
          username: adminUsername,
          email: adminEmail,
          password: adminPassword,
          role: 'admin',
          payment_status: 'paid'
        };
      } else {
        const hashedAdminPassword = await bcrypt.hash(adminPassword, 10);
        
        let adminId;
        if (users.create) {
          const isAsync = users.create.constructor && users.create.constructor.name === 'AsyncFunction';
          if (isAsync) {
            adminId = await users.create(adminUsername, adminEmail, hashedAdminPassword, 'admin');
          } else {
            adminId = users.create(adminUsername, adminEmail, hashedAdminPassword, 'admin');
          }
        }

        // Atualizar payment_status para 'paid'
        if (users.updatePaymentStatus && adminId) {
          const isAsync = users.updatePaymentStatus.constructor && users.updatePaymentStatus.constructor.name === 'AsyncFunction';
          if (isAsync) {
            await users.updatePaymentStatus(adminId, 'paid');
          } else {
            users.updatePaymentStatus(adminId, 'paid');
          }
        }

        results.admin = {
          success: true,
          message: 'Usuário admin criado com sucesso',
          username: adminUsername,
          email: adminEmail,
          password: adminPassword,
          role: 'admin',
          payment_status: 'paid'
        };
      }
    } catch (err) {
      console.error('❌ Erro ao criar/atualizar usuário admin:', err);
      results.errors.push({ user: 'admin', error: err.message });
      results.admin = {
        success: false,
        error: err.message
      };
    }

    // Criar usuário de TESTE
    console.log('👤 Criando usuário de TESTE...');
    const testUsername = 'teste';
    const testEmail = 'teste@postei.pro';
    const testPassword = 'teste123';
    
    try {
      // Verificar se usuário de teste já existe
      let existingTest;
      if (users.findByUsername) {
        const isAsync = users.findByUsername.constructor && users.findByUsername.constructor.name === 'AsyncFunction';
        if (isAsync) {
          existingTest = await users.findByUsername(testUsername);
        } else {
          existingTest = users.findByUsername(testUsername);
        }
      }

      if (existingTest) {
        // Se existe, vamos resetar a senha
        console.log('⚠️ Usuário de teste já existe, resetando senha...');
        const hashedTestPassword = await bcrypt.hash(testPassword, 10);
        
        // Atualizar senha
        if (users.updatePassword && existingTest.id) {
          const isAsync = users.updatePassword.constructor && users.updatePassword.constructor.name === 'AsyncFunction';
          if (isAsync) {
            await users.updatePassword(existingTest.id, hashedTestPassword);
          } else {
            users.updatePassword(existingTest.id, hashedTestPassword);
          }
        }

        results.teste = {
          success: true,
          message: 'Senha do usuário de teste resetada com sucesso',
          username: testUsername,
          email: testEmail,
          password: testPassword,
          role: 'user',
          payment_status: 'pending'
        };
      } else {
        const hashedTestPassword = await bcrypt.hash(testPassword, 10);
        
        let testId;
        if (users.create) {
          const isAsync = users.create.constructor && users.create.constructor.name === 'AsyncFunction';
          if (isAsync) {
            testId = await users.create(testUsername, testEmail, hashedTestPassword, 'user');
          } else {
            testId = users.create(testUsername, testEmail, hashedTestPassword, 'user');
          }
        }

        results.teste = {
          success: true,
          message: 'Usuário de teste criado com sucesso',
          username: testUsername,
          email: testEmail,
          password: testPassword,
          role: 'user',
          payment_status: 'pending'
        };
      }
    } catch (err) {
      console.error('❌ Erro ao criar/atualizar usuário de teste:', err);
      results.errors.push({ user: 'teste', error: err.message });
      results.teste = {
        success: false,
        error: err.message
      };
    }

    res.json({
      success: true,
      message: 'Processo concluído',
      results: results,
      credentials: {
        admin: {
          username: 'admin',
          email: 'admin@postei.pro',
          password: 'admin123',
          role: 'admin'
        },
        teste: {
          username: 'teste',
          email: 'teste@postei.pro',
          password: 'teste123',
          role: 'user'
        }
      }
    });

  } catch (err) {
    console.error('❌ Erro ao criar usuários:', err);
    res.status(500).json({
      success: false,
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

module.exports = router;
