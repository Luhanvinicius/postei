# Como Verificar Logs de Runtime no Vercel

## 🔍 Passo a Passo para Ver os Logs

1. **Acesse o Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Faça login se necessário

2. **Selecione seu projeto:**
   - Clique em "postei" ou o nome do seu projeto

3. **Vá para Deployments:**
   - No menu lateral, clique em "Deployments"
   - Ou vá direto: https://vercel.com/[seu-usuario]/postei/deployments

4. **Abra o deployment mais recente:**
   - Clique no deployment mais recente (deve ter um timestamp recente)
   - Procure pelo commit `bd425c2` ou `6d154b8`

5. **Veja os logs:**
   - Clique na aba **"Logs"** ou **"Runtime Logs"**
   - Ou clique em **"View Function Logs"** se disponível

6. **Procure por estas mensagens:**
   - `🔄` - Processos em andamento
   - `❌` - Erros
   - `✅` - Sucessos
   - `📍` - Informações de debug

## 📋 O que procurar nos logs:

### Se aparecer:
- `❌ Erro ao carregar módulo de banco de dados` → Problema com DATABASE_URL
- `❌ Erro ao inicializar banco de dados` → Problema de conexão com PostgreSQL
- `ReferenceError` → Variável não definida
- `Cannot find module` → Dependência faltando
- `Timeout` → Problema de conexão ou timeout

### Se aparecer:
- `✅ Módulo de banco de dados carregado` → Banco OK
- `✅ Banco de dados pronto` → Inicialização OK
- `✅ Rotas carregadas` → Rotas OK

## 🚀 Forçar Novo Deploy

Se o Vercel não está usando o commit mais recente:

1. **Vercel Dashboard → Deployments**
2. Clique no deployment mais recente
3. Clique nos **3 pontos (...)** no canto superior direito
4. Selecione **"Redeploy"**
5. Ou vá em **Settings → Git** e verifique se está conectado ao repositório correto

## 🔧 Verificar Variáveis de Ambiente

1. **Vercel Dashboard → Seu Projeto → Settings**
2. Clique em **"Environment Variables"**
3. Verifique se todas estão configuradas:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `FRONTEND_URL`
   - `CORS_ORIGIN`
   - `BASE_URL`
   - `NODE_ENV`

## 📞 Compartilhar Logs

Quando encontrar os logs, copie e cole aqui:
- Todas as linhas que começam com `❌`
- Todas as linhas que começam com `🔄`
- Qualquer stack trace completo
- Mensagens de erro específicas

## 🧪 Testar Rota de Health Check

Após o deploy, teste:
- https://postei-three.vercel.app/health

Isso deve retornar um JSON com o status do servidor.



