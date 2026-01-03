# Configuração de Variáveis de Ambiente no Vercel

## Variáveis OBRIGATÓRIAS

### 1. DATABASE_URL (CRÍTICO)
**Por que é necessário:** Sem isso, o banco de dados não funciona e você terá "Internal Server Error".

**Como obter:**
- Se você tem um banco PostgreSQL (Render, Supabase, Neon, etc.), copie a Connection String
- Formato: `postgres://usuario:senha@host:porta/database?sslmode=require`

**Como configurar no Vercel:**
1. Acesse: https://vercel.com/seu-projeto/settings/environment-variables
2. Adicione:
   - **Nome:** `DATABASE_URL`
   - **Valor:** `postgres://...` (sua connection string)
   - **Ambiente:** Production, Preview, Development (marque todos)

### 2. SESSION_SECRET (CRÍTICO)
**Por que é necessário:** Sem isso, as sessões não funcionam corretamente.

**Como gerar:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Como configurar no Vercel:**
- **Nome:** `SESSION_SECRET`
- **Valor:** (cole o resultado do comando acima)
- **Ambiente:** Production, Preview, Development

## Variáveis OPCIONAIS (mas recomendadas)

### 3. GEMINI_API_KEY
**Por que:** Necessário para funcionalidades de IA (geração de títulos, descrições, etc.)

**Como configurar:**
- **Nome:** `GEMINI_API_KEY`
- **Valor:** Sua chave da API do Google Gemini
- **Ambiente:** Production, Preview, Development

### 4. ASAAS_API_KEY
**Por que:** Necessário para processar pagamentos

**Como configurar:**
- **Nome:** `ASAAS_API_KEY`
- **Valor:** `$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFjOGQyZmYyLWExY2MtNDY0ZC04YzBlLThlMjBlYzM1YWE2NDo6JGFhY2hfMWJmYjE1YTMtMWZkZi00ZTk4LWEzNWEtNmI2ZTJiNjBmNzY3`
- **Ambiente:** Production, Preview, Development

### 5. ASAAS_ENVIRONMENT
**Por que:** Define se usa sandbox ou produção

**Como configurar:**
- **Nome:** `ASAAS_ENVIRONMENT`
- **Valor:** `sandbox` (para testes) ou `production` (para produção)
- **Ambiente:** Production, Preview, Development

### 6. BASE_URL (Opcional - Vercel já fornece automaticamente)
**Por que:** Para webhooks e callbacks. O Vercel já fornece `VERCEL_URL` automaticamente, mas você pode definir `BASE_URL` se quiser usar um domínio customizado.

**Como configurar:**
- **Nome:** `BASE_URL`
- **Valor:** `https://seu-dominio.com` (ou deixe o Vercel usar `VERCEL_URL` automaticamente)
- **Ambiente:** Production

## Variáveis que o Vercel fornece automaticamente

- `VERCEL_URL` - URL do deployment (ex: `postei-abc123.vercel.app`)
- `VERCEL` - Sempre `1` quando rodando no Vercel
- `NODE_ENV` - Automaticamente `production` no Vercel

## Checklist de Configuração

Antes de fazer deploy, certifique-se de ter configurado:

- [ ] `DATABASE_URL` (OBRIGATÓRIO)
- [ ] `SESSION_SECRET` (OBRIGATÓRIO)
- [ ] `GEMINI_API_KEY` (se usar IA)
- [ ] `ASAAS_API_KEY` (se usar pagamentos)
- [ ] `ASAAS_ENVIRONMENT` (se usar pagamentos)

## Como verificar se está funcionando

1. Acesse a URL do seu deployment no Vercel
2. Se aparecer "Internal Server Error", verifique os logs:
   - Vercel Dashboard → Seu Projeto → Logs
   - Procure por erros relacionados a `DATABASE_URL` ou `SESSION_SECRET`

## Configuração do Webhook do Asaas

Após configurar as variáveis e fazer o deploy:

1. Copie a URL do seu deployment (ex: `https://postei-abc123.vercel.app`)
2. Acesse: https://www.asaas.com/ (ou sandbox)
3. Vá em: Configurações → Webhooks
4. Adicione a URL: `https://seu-dominio.vercel.app/payment/webhook/asaas`
5. Selecione os eventos: `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`




