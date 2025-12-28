/**
 * Script para criar usuários de teste (admin e user)
 * 
 * Uso:
 *   node create-users.js
 * 
 * Ou com variáveis de ambiente:
 *   DATABASE_URL=postgres://... node create-users.js
 */

require('dotenv').config();
const bcrypt = require('bcryptjs');

// Detectar qual banco usar
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
const hasPostgresUrl = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.PRISMA_DATABASE_URL);

let db;

if (isVercel || hasPostgresUrl) {
  // Usar PostgreSQL
  console.log('📊 Usando PostgreSQL');
  db = require('./database-pg');
} else {
  // Usar SQLite
  console.log('📊 Usando SQLite');
  db = require('./database');
}

async function createUsers() {
  try {
    // Inicializar banco se necessário
    if (db.initDatabase) {
      console.log('🔄 Inicializando banco de dados...');
      await db.initDatabase();
      console.log('✅ Banco de dados inicializado');
    }

    const users = db.users || db;

    // Criar usuário ADMIN
    console.log('\n👤 Criando usuário ADMIN...');
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
        console.log('⚠️  Usuário admin já existe!');
        console.log(`   Username: ${adminUsername}`);
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Senha: ${adminPassword}`);
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

        // Atualizar payment_status para 'paid' (admin tem acesso completo)
        if (users.updatePaymentStatus && adminId) {
          const isAsync = users.updatePaymentStatus.constructor && users.updatePaymentStatus.constructor.name === 'AsyncFunction';
          if (isAsync) {
            await users.updatePaymentStatus(adminId, 'paid');
          } else {
            users.updatePaymentStatus(adminId, 'paid');
          }
        }

        console.log('✅ Usuário ADMIN criado com sucesso!');
        console.log(`   Username: ${adminUsername}`);
        console.log(`   Email: ${adminEmail}`);
        console.log(`   Senha: ${adminPassword}`);
        console.log(`   Role: admin`);
        console.log(`   Payment Status: paid`);
      }
    } catch (err) {
      console.error('❌ Erro ao criar usuário admin:', err);
      console.error('Stack:', err.stack);
    }

    // Criar usuário de TESTE
    console.log('\n👤 Criando usuário de TESTE...');
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
        console.log('⚠️  Usuário de teste já existe!');
        console.log(`   Username: ${testUsername}`);
        console.log(`   Email: ${testEmail}`);
        console.log(`   Senha: ${testPassword}`);
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

        // Deixar payment_status como 'pending' (usuário normal precisa pagar)
        console.log('✅ Usuário de TESTE criado com sucesso!');
        console.log(`   Username: ${testUsername}`);
        console.log(`   Email: ${testEmail}`);
        console.log(`   Senha: ${testPassword}`);
        console.log(`   Role: user`);
        console.log(`   Payment Status: pending`);
      }
    } catch (err) {
      console.error('❌ Erro ao criar usuário de teste:', err);
      console.error('Stack:', err.stack);
    }

    console.log('\n✅ Processo concluído!');
    console.log('\n📋 Credenciais criadas:');
    console.log('\n🔴 ADMIN:');
    console.log('   Username: admin');
    console.log('   Email: admin@postei.pro');
    console.log('   Senha: admin123');
    console.log('\n🟢 TESTE:');
    console.log('   Username: teste');
    console.log('   Email: teste@postei.pro');
    console.log('   Senha: teste123');

  } catch (err) {
    console.error('❌ Erro ao criar usuários:', err);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

// Executar
createUsers()
  .then(() => {
    console.log('\n✅ Script executado com sucesso!');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Erro fatal:', err);
    process.exit(1);
  });

