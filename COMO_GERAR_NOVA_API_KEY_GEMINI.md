# 🔑 Como Gerar uma Nova API Key do Gemini

## ⚠️ Problema
Sua API key atual foi reportada como **vazada** pelo Google e foi bloqueada. Isso acontece quando a chave é exposta em repositórios públicos ou compartilhada acidentalmente.

## ✅ Solução: Gerar Nova API Key

### Passo 1: Acessar Google AI Studio
1. Acesse: https://aistudio.google.com/app/apikey
2. Faça login com sua conta Google

### Passo 2: Criar Nova API Key
1. Clique em **"Create API Key"** ou **"Criar chave de API"**
2. Selecione o projeto Google Cloud (ou crie um novo)
3. Copie a nova chave gerada (começa com `AIzaSy...`)

### Passo 3: Configurar no Render
1. Acesse seu serviço no Render: https://dashboard.render.com
2. Vá em **Environment** → **Environment Variables**
3. Encontre a variável `GEMINI_API_KEY`
4. Clique em **Edit** e cole a nova chave
5. Clique em **Save Changes**
6. O Render vai fazer um novo deploy automaticamente

### Passo 4: Configurar Localmente (Opcional)
Se você está testando localmente:

1. Crie/edite o arquivo `.env` na raiz do projeto:
```env
GEMINI_API_KEY=sua-nova-chave-aqui
```

2. **NUNCA** commite o arquivo `.env` no Git!

## 🔒 Segurança - Como Evitar Isso no Futuro

### ✅ FAÇA:
- ✅ Use **sempre** variáveis de ambiente
- ✅ Adicione `.env` no `.gitignore` (já está adicionado)
- ✅ Use `env.example` para documentar variáveis sem valores reais
- ✅ Configure as chaves apenas no Render/Vercel

### ❌ NÃO FAÇA:
- ❌ **NUNCA** coloque chaves em arquivos de código
- ❌ **NUNCA** coloque chaves em arquivos de documentação (`.md`)
- ❌ **NUNCA** commite arquivos `.env`
- ❌ **NUNCA** compartilhe chaves em chats, emails, etc.

## 📋 Checklist de Segurança

Após gerar a nova chave:
- [ ] Nova API key gerada no Google AI Studio
- [ ] Chave configurada no Render (Environment Variables)
- [ ] Deploy no Render concluído
- [ ] Teste a página `/test/gemini-images` para verificar
- [ ] Verifique se não há chaves hardcoded no código
- [ ] Verifique se `.env` está no `.gitignore`

## 🧪 Testar a Nova Chave

1. Acesse: `https://seu-app.onrender.com/test/gemini-check`
   - Deve mostrar: `✅ Gemini está configurado corretamente!`

2. Acesse: `https://seu-app.onrender.com/test/gemini-images`
   - Selecione uma imagem
   - Clique em "Gerar Título e Descrição"
   - Deve funcionar sem erro 403

## ⚠️ Se Ainda Der Erro

Se mesmo com a nova chave ainda der erro:
1. Verifique se a chave foi salva corretamente no Render
2. Aguarde alguns minutos (pode levar tempo para propagar)
3. Verifique os logs do Render para ver se há outros erros
4. Tente gerar uma nova chave novamente

