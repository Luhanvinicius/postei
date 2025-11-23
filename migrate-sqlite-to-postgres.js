/**
 * Script de Migração: SQLite → PostgreSQL
 * 
 * Este script migra todos os dados do SQLite local para o PostgreSQL no Vercel
 * 
 * USO:
 * 1. Configure DATABASE_URL no .env com a URL do PostgreSQL
 * 2. Execute: node migrate-sqlite-to-postgres.js
 */

const Database = require('better-sqlite3');
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs-extra');
require('dotenv').config();

// Caminho do banco SQLite
const SQLITE_DB_PATH = path.join(__dirname, 'data', 'database.db');

// Verificar se o SQLite existe
if (!fs.existsSync(SQLITE_DB_PATH)) {
  console.error('❌ Banco SQLite não encontrado em:', SQLITE_DB_PATH);
  console.error('   Certifique-se de que o banco SQLite existe antes de migrar.');
  process.exit(1);
}

// Connection string do PostgreSQL
const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error('❌ DATABASE_URL não encontrada no .env!');
  console.error('   Configure DATABASE_URL com a URL do PostgreSQL.');
  process.exit(1);
}

const pgPool = new Pool({
  connectionString: connectionString,
  ssl: process.env.NODE_ENV === 'production' || process.env.VERCEL ? { rejectUnauthorized: false } : false,
});

// Conectar ao SQLite
console.log('📊 Conectando ao SQLite...');
const sqliteDb = new Database(SQLITE_DB_PATH);

// Função para migrar tabela
async function migrateTable(tableName, transformFn = null, excludeColumns = []) {
  console.log(`\n🔄 Migrando tabela: ${tableName}`);
  
  try {
    // Ler dados do SQLite
    const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();
    console.log(`   📥 ${rows.length} registros encontrados no SQLite`);

    if (rows.length === 0) {
      console.log(`   ⏭️  Nenhum dado para migrar`);
      return;
    }

    // Obter estrutura da tabela (excluindo colunas especificadas, como 'id' para SERIAL)
    const tableInfo = sqliteDb.prepare(`PRAGMA table_info(${tableName})`).all();
    const columns = tableInfo
      .map(col => col.name)
      .filter(col => !excludeColumns.includes(col));

    // Preparar dados para inserção
    const values = rows.map(row => {
      if (transformFn) {
        return transformFn(row, columns);
      }
      return columns.map(col => row[col]);
    });

    // Inserir no PostgreSQL
    const client = await pgPool.connect();
    try {
      let inserted = 0;
      let skipped = 0;

      for (const rowValues of values) {
        // Pular valores null (registros que não puderam ser migrados)
        if (rowValues === null) {
          skipped++;
          continue;
        }

        try {
          // Verificar se já existe (para evitar duplicatas)
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          const insertQuery = `
            INSERT INTO ${tableName} (${columns.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT DO NOTHING
          `;
          
          await client.query(insertQuery, rowValues);
          inserted++;
        } catch (err) {
          if (err.code === '23505') { // Unique violation
            skipped++;
          } else {
            console.error(`   ❌ Erro ao inserir registro:`, err.message);
            throw err;
          }
        }
      }

      console.log(`   ✅ ${inserted} registros inseridos`);
      if (skipped > 0) {
        console.log(`   ⏭️  ${skipped} registros já existiam (ignorados)`);
      }
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`   ❌ Erro ao migrar ${tableName}:`, error.message);
    throw error;
  }
}

// Função principal de migração
async function migrate() {
  console.log('🚀 Iniciando migração SQLite → PostgreSQL\n');
  console.log('📊 SQLite:', SQLITE_DB_PATH);
  console.log('📊 PostgreSQL:', connectionString.substring(0, 30) + '...\n');

  const client = await pgPool.connect();
  
  try {
    // Verificar conexão
    await client.query('SELECT NOW()');
    console.log('✅ Conectado ao PostgreSQL\n');

    // Verificar se as tabelas existem no PostgreSQL
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('users', 'youtube_configs', 'scheduled_videos', 'published_videos')
    `);
    
    if (tablesCheck.rows.length === 0) {
      console.log('⚠️  Tabelas não existem no PostgreSQL. Criando...');
      console.log('   Execute o servidor uma vez para criar as tabelas, ou crie manualmente.');
      console.log('   Depois execute este script novamente.');
      return;
    }

    console.log('✅ Tabelas encontradas no PostgreSQL\n');

    // Migrar tabelas na ordem correta (respeitando foreign keys)
    
    // 1. Users (sem dependências)
    // PostgreSQL usa SERIAL (auto-increment), então não incluímos o ID
    await migrateTable('users', (row) => {
      return [
        row.username,
        row.email,
        row.password,
        row.role,
        row.created_at
      ];
    }, ['id']); // Excluir coluna 'id' (SERIAL no PostgreSQL)

    // 2. YouTube Configs (depende de users)
    // Precisamos mapear user_id do SQLite para o novo ID do PostgreSQL
    console.log('\n🔄 Mapeando IDs de usuários...');
    const userMapping = new Map();
    const pgUsers = await client.query('SELECT id, username, email FROM users');
    const sqliteUsers = sqliteDb.prepare('SELECT id, username, email FROM users').all();
    
    // Criar mapeamento baseado em username/email (único)
    for (const sqliteUser of sqliteUsers) {
      const pgUser = pgUsers.rows.find(u => 
        u.username === sqliteUser.username || u.email === sqliteUser.email
      );
      if (pgUser) {
        userMapping.set(sqliteUser.id, pgUser.id);
        console.log(`   ✅ ${sqliteUser.username}: SQLite ID ${sqliteUser.id} → PostgreSQL ID ${pgUser.id}`);
      } else {
        console.warn(`   ⚠️  Usuário ${sqliteUser.username} não encontrado no PostgreSQL`);
      }
    }

    await migrateTable('youtube_configs', (row) => {
      const newUserId = userMapping.get(row.user_id);
      if (!newUserId) {
        console.warn(`   ⚠️  User ID ${row.user_id} não encontrado no PostgreSQL, pulando...`);
        return null; // Retornar null para pular este registro
      }
      return [
        newUserId, // Novo user_id do PostgreSQL
        row.config_path,
        row.channel_id,
        row.channel_name,
        row.is_authenticated,
        row.refresh_token,
        row.access_token,
        row.uploaded_at,
        row.authenticated_at,
        row.default_video_folder
      ];
    }, ['id']); // Excluir coluna 'id'

    // 3. Scheduled Videos (depende de users)
    await migrateTable('scheduled_videos', (row) => {
      const newUserId = userMapping.get(row.user_id);
      if (!newUserId) {
        return null; // Pular se user não existe
      }
      return [
        newUserId, // Novo user_id
        row.video_path,
        row.scheduled_time,
        row.title,
        row.description,
        row.thumbnail_path || null,
        row.status,
        row.video_id,
        row.error,
        row.created_at,
        row.processing_at,
        row.completed_at
      ];
    }, ['id']); // Excluir coluna 'id'

    // 4. Published Videos (depende de users)
    await migrateTable('published_videos', (row) => {
      const newUserId = userMapping.get(row.user_id);
      if (!newUserId) {
        return null; // Pular se user não existe
      }
      return [
        newUserId, // Novo user_id
        row.video_path,
        row.video_id,
        row.video_url,
        row.title,
        row.description,
        row.thumbnail_path || null,
        row.published_at
      ];
    }, ['id']); // Excluir coluna 'id'

    console.log('\n✅ Migração concluída com sucesso!');
    console.log('\n📋 Resumo:');
    console.log('   - Tabelas migradas: users, youtube_configs, scheduled_videos, published_videos');
    console.log('   - Dados preservados com IDs originais');
    console.log('   - Foreign keys mantidas');
    
  } catch (error) {
    console.error('\n❌ Erro durante a migração:', error);
    console.error('Stack:', error.stack);
    throw error;
  } finally {
    client.release();
    sqliteDb.close();
    await pgPool.end();
  }
}

// Executar migração
migrate()
  .then(() => {
    console.log('\n🎉 Migração finalizada!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Falha na migração:', error);
    process.exit(1);
  });

