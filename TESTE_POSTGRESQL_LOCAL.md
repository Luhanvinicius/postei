# Como Testar com PostgreSQL Localmente

## Pré-requisitos

1. **PostgreSQL instalado** no seu computador
2. **Node.js** instalado

## Passos para Configurar

### 1. Instalar PostgreSQL (se ainda não tiver)

**Windows:**
- Baixe do site oficial: https://www.postgresql.org/download/windows/
- Ou use o instalador: https://www.enterprisedb.com/downloads/postgres-postgresql-downloads

**Durante a instalação:**
- Anote a senha do usuário `postgres` que você configurar
- Porta padrão: `5432`

### 2. Criar o Banco de Dados

Abra o **pgAdmin** ou use o **psql** no terminal:

```sql
-- Conectar ao PostgreSQL
psql -U postgres

-- Criar banco de dados
CREATE DATABASE youtube_automation;

-- Verificar se foi criado
\l
```

### 3. Configurar o arquivo .env

Crie um arquivo `.env` na raiz do projeto `youtube-automation-node/`:

```env
# PostgreSQL Local
DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/youtube_automation

# Chave secreta (gere uma nova)
SESSION_SECRET=859ccf81c6ebc0251e9ab411a069544851472e140572898c2c9ec4c0d29fba02

# API Key do Gemini
GEMINI_API_KEY=sua-chave-gemini-aqui
```

**Substitua:**
- `SUA_SENHA` pela senha do PostgreSQL que você configurou
- `youtube_automation` pelo nome do banco que você criou

### 4. Gerar uma nova SESSION_SECRET (opcional)

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 5. Inicializar o Banco de Dados

Execute o script de inicialização:

```bash
npm run init-db
```

Ou:

```bash
node init-postgres.js
```

Isso vai criar todas as tabelas necessárias.

### 6. Rodar o Servidor

```bash
npm start
```

Ou em modo desenvolvimento:

```bash
npm run dev
```

### 7. Verificar se está Funcionando

1. Acesse: http://localhost:3000
2. Faça login com: `admin` / `admin123`
3. Verifique se os dados estão sendo salvos no PostgreSQL

## Verificar Dados no PostgreSQL

### Via pgAdmin:
1. Abra o pgAdmin
2. Conecte ao servidor
3. Expanda `Databases` > `youtube_automation` > `Schemas` > `public` > `Tables`
4. Clique com botão direito em uma tabela (ex: `users`) > `View/Edit Data` > `All Rows`

### Via psql:
```sql
-- Conectar ao banco
psql -U postgres -d youtube_automation

-- Ver usuários
SELECT * FROM users;

-- Ver configurações
SELECT * FROM youtube_configs;

-- Ver vídeos agendados
SELECT * FROM scheduled_videos;
```

## Voltar para SQLite

Se quiser voltar a usar SQLite localmente:

1. Remova ou comente a linha `DATABASE_URL` no `.env`
2. Ou renomeie o arquivo `.env` para `.env.backup`
3. Reinicie o servidor

O sistema detectará automaticamente e usará SQLite.

## Troubleshooting

### Erro: "password authentication failed"
- Verifique se a senha no `DATABASE_URL` está correta
- Tente resetar a senha do PostgreSQL

### Erro: "database does not exist"
- Certifique-se de que criou o banco `youtube_automation`
- Verifique o nome do banco no `DATABASE_URL`

### Erro: "connection refused"
- Verifique se o PostgreSQL está rodando
- Verifique se a porta está correta (padrão: 5432)
- No Windows: Verifique no "Services" se o PostgreSQL está rodando

### Erro: "relation does not exist"
- Execute `npm run init-db` para criar as tabelas
- Ou execute `node init-postgres.js`

