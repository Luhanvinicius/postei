# Variáveis de Ambiente para Railway

## 📋 Lista Completa de Variáveis

### 🔴 OBRIGATÓRIAS (Sem essas, o backend não funciona)

#### 1. DATABASE_URL
**O que é:** Connection string do PostgreSQL  
**Como obter:** 
- Railway pode criar automaticamente: **+ New** → **Database** → **Add PostgreSQL**
- Ou use uma URL externa (Supabase, Neon, etc.)

**Formato:**
```
postgres://usuario:senha@host:porta/database?sslmode=require
```

**Exemplo:**
```
postgres://postgres:senha123@containers-us-west-123.railway.app:5432/railway
```

---

#### 2. SESSION_SECRET
**O que é:** Chave secreta para criptografar sessões  
**Como gerar:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Exemplo:**
```
a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

---

### 🟡 RECOMENDADAS (Funcionalidades específicas)

#### 3. GEMINI_API_KEY
**O que é:** Chave da API do Google Gemini para gerar títulos e descrições com IA  
**Onde obter:** https://makersuite.google.com/app/apikey  
**Exemplo:**
```
AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567
```

---

#### 4. ASAAS_API_KEY
**O que é:** Chave da API do Asaas para processar pagamentos  
**Onde obter:** https://www.asaas.com/ (ou sandbox)  
**Exemplo (Sandbox):**
```
$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFjOGQyZmYyLWExY2MtNDY0ZC04YzBlLThlMjBlYzM1YWE2NDo6JGFhY2hfMWJmYjE1YTMtMWZkZi00ZTk4LWEzNWEtNmI2ZTJiNjBmNzY3
```

---

#### 5. ASAAS_ENVIRONMENT
**O que é:** Ambiente do Asaas (sandbox para testes, production para produção)  
**Valores possíveis:**
- `sandbox` (para testes)
- `production` (para produção)

**Exemplo:**
```
sandbox
```

---

### 🟢 OPCIONAIS (Mas importantes para CORS)

#### 6. FRONTEND_URL
**O que é:** URL do frontend no Vercel para configurar CORS  
**Formato:** URL completa do seu frontend  
**Exemplo:**
```
https://postei.vercel.app
```
ou
```
https://postei-git-main-seu-usuario.vercel.app
```

---

#### 7. CORS_ORIGIN
**O que é:** Mesma coisa que FRONTEND_URL (alternativa)  
**Exemplo:**
```
https://postei.vercel.app
```

---

## 📝 Como Configurar no Railway

1. **Acesse o projeto no Railway**
2. **Clique em "Variables"** (no menu lateral)
3. **Clique em "+ New Variable"**
4. **Adicione cada variável:**
   - **Name:** Nome da variável (ex: `DATABASE_URL`)
   - **Value:** Valor da variável
   - **Environment:** Selecione **Production**, **Preview** e **Development** (ou apenas Production)

---

## ✅ Checklist Mínimo

Para o backend funcionar, você precisa de pelo menos:

- [ ] `DATABASE_URL` - **OBRIGATÓRIA**
- [ ] `SESSION_SECRET` - **OBRIGATÓRIA**

Para funcionalidades completas:

- [ ] `GEMINI_API_KEY` - Para IA
- [ ] `ASAAS_API_KEY` - Para pagamentos
- [ ] `ASAAS_ENVIRONMENT` - Para pagamentos
- [ ] `FRONTEND_URL` - Para CORS (URL do seu frontend no Vercel)

---

## 🔍 Como Verificar se Está Funcionando

1. Após configurar as variáveis, o Railway fará um novo deploy
2. Verifique os logs no Railway:
   - Deve aparecer: `📊 Usando PostgreSQL (Railway/Produção)`
   - Não deve aparecer erros de `DATABASE_URL` ou `SESSION_SECRET`

3. Teste acessando a URL do Railway:
   - Deve retornar algo (mesmo que seja erro 404, significa que o servidor está rodando)

---

## 🚨 Troubleshooting

### Erro: "Internal Server Error"
- Verifique se `DATABASE_URL` está configurada
- Verifique se `SESSION_SECRET` está configurada
- Veja os logs no Railway para mais detalhes

### Erro: CORS bloqueado no frontend
- Configure `FRONTEND_URL` com a URL exata do seu frontend no Vercel
- Certifique-se de que a URL está correta (com `https://`)

### Banco de dados não conecta
- Verifique se a `DATABASE_URL` está correta
- No Railway, se criou um PostgreSQL, a variável `DATABASE_URL` é criada automaticamente
- Verifique se o banco está ativo no Railway




