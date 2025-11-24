# 🚨 SOLUÇÃO RÁPIDA - Erro 403 API Key Vazada

## ⚡ Passos Rápidos (5 minutos)

### 1️⃣ Gerar Nova API Key (2 minutos)
1. Acesse: **https://aistudio.google.com/app/apikey**
2. Faça login com sua conta Google
3. Clique em **"Create API Key"** ou **"Criar chave de API"**
4. Selecione um projeto (ou crie um novo se necessário)
5. **COPIE A CHAVE** (ela começa com `AIzaSy...`)

### 2️⃣ Configurar no Render (2 minutos)
1. Acesse: **https://dashboard.render.com**
2. Clique no seu serviço (Web Service)
3. Vá em **Environment** (no menu lateral)
4. Role até encontrar **`GEMINI_API_KEY`**
5. Clique no **ícone de lápis** (Edit) ao lado
6. **COLE A NOVA CHAVE** no campo "Value"
7. Clique em **"Save Changes"**
8. O Render vai fazer **deploy automático** (aguarde 1-2 minutos)

### 3️⃣ Testar (1 minuto)
1. Aguarde o deploy terminar (veja o status no Render)
2. Acesse: **https://www.postei.pro/test/gemini-check**
3. Deve aparecer: `✅ Gemini está configurado corretamente!`
4. Teste novamente: **https://www.postei.pro/test/gemini-images**

## ✅ Checklist
- [ ] Nova API key gerada no Google AI Studio
- [ ] Chave copiada (começa com `AIzaSy...`)
- [ ] Chave configurada no Render (Environment Variables)
- [ ] Deploy concluído no Render
- [ ] Teste `/test/gemini-check` passou
- [ ] Teste `/test/gemini-images` funcionando

## 🔍 Como Verificar se Funcionou

### Teste 1: Verificar Configuração
```
URL: https://www.postei.pro/test/gemini-check
Resultado esperado: {"success":true,"message":"✅ Gemini está configurado corretamente!"}
```

### Teste 2: Testar Geração
```
URL: https://www.postei.pro/test/gemini-images
1. Selecione uma imagem
2. Clique em "Gerar Título e Descrição"
3. Deve funcionar SEM erro 403
```

## ⚠️ Se Ainda Der Erro

1. **Verifique se a chave foi salva:**
   - No Render, vá em Environment
   - Confirme que `GEMINI_API_KEY` tem a nova chave
   - Deve mostrar os primeiros caracteres: `AIzaSy...`

2. **Aguarde o deploy:**
   - O Render precisa fazer deploy após mudar variáveis
   - Aguarde 1-2 minutos após salvar

3. **Verifique os logs:**
   - No Render, vá em "Logs"
   - Procure por erros relacionados ao Gemini

4. **Tente gerar outra chave:**
   - Às vezes a primeira chave pode ter problemas
   - Gere uma nova e tente novamente

## 📸 Screenshots de Referência

### Google AI Studio
- URL: https://aistudio.google.com/app/apikey
- Botão: "Create API Key" (canto superior direito)

### Render - Environment Variables
- Menu: Environment (lateral esquerda)
- Procure: `GEMINI_API_KEY`
- Clique no ícone de lápis para editar

## 🎯 Resumo
1. **Gerar chave:** https://aistudio.google.com/app/apikey
2. **Configurar no Render:** Environment → GEMINI_API_KEY → Editar → Colar → Salvar
3. **Aguardar deploy:** 1-2 minutos
4. **Testar:** https://www.postei.pro/test/gemini-images

---

**Tempo total estimado: 5 minutos**

