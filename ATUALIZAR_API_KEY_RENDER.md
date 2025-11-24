# 🔄 Como Atualizar a API Key no Render

## ⚠️ Problema Atual
O Render ainda está usando a **chave antiga** que foi bloqueada pelo Google:
- Chave antiga (bloqueada): `AIzaSyCd2F...fxUU`
- Nova chave (que você precisa configurar): `AIzaSyAJWLaT_cTcr8zwU6ansd2DiGT-iZUMOB4`

## ✅ Solução: Atualizar no Render

### Passo 1: Acessar o Render Dashboard
1. Acesse: **https://dashboard.render.com**
2. Faça login na sua conta

### Passo 2: Encontrar seu Web Service
1. Na lista de serviços, encontre **"postei"** ou **"postei Web Service"**
2. Clique no nome do serviço

### Passo 3: Acessar Environment Variables
1. No menu lateral esquerdo, clique em **"Environment"**
2. Você verá uma lista de variáveis de ambiente

### Passo 4: Editar GEMINI_API_KEY
1. Procure pela variável **`GEMINI_API_KEY`** na lista
2. Você verá algo como:
   ```
   GEMINI_API_KEY    AIzaSyCd2F...fxUU    [Edit] [Delete]
   ```
3. Clique no botão **"Edit"** (ou ícone de lápis) ao lado

### Passo 5: Colar a Nova Chave
1. No campo **"Value"**, você verá a chave antiga
2. **DELETE** a chave antiga completamente
3. **COLE** a nova chave: `AIzaSyAJWLaT_cTcr8zwU6ansd2DiGT-iZUMOB4`
4. **IMPORTANTE:** Certifique-se de que não há espaços antes ou depois da chave

### Passo 6: Salvar
1. Clique em **"Save Changes"** (ou "Salvar")
2. O Render vai mostrar uma mensagem de confirmação
3. **O Render vai fazer deploy automático** (isso leva 1-2 minutos)

### Passo 7: Aguardar Deploy
1. Volte para a página principal do serviço
2. Você verá o status do deploy em andamento
3. Aguarde até aparecer **"Live"** (verde)

## 🧪 Verificar se Funcionou

### Teste 1: Verificar Configuração
1. Acesse: **https://www.postei.pro/test/gemini-check**
2. Verifique o campo `apiKeyValue`:
   - ❌ Se mostrar `AIzaSyCd2F...fxUU` → Ainda está usando a chave antiga
   - ✅ Se mostrar `AIzaSyAJW...OB4` → Nova chave configurada!

### Teste 2: Testar Geração
1. Acesse: **https://www.postei.pro/test/gemini-images**
2. Selecione uma imagem
3. Clique em "Gerar Título e Descrição"
4. ✅ Deve funcionar sem erro 403

## ⚠️ Se Ainda Mostrar a Chave Antiga

Se após atualizar ainda mostrar a chave antiga:

1. **Verifique se salvou corretamente:**
   - Volte em Environment → GEMINI_API_KEY
   - Confirme que a chave está correta

2. **Aguarde o deploy terminar:**
   - O deploy pode levar 1-2 minutos
   - Verifique o status na página principal do serviço

3. **Limpe o cache do navegador:**
   - Pressione `Ctrl + Shift + R` (ou `Cmd + Shift + R` no Mac)
   - Ou abra em uma aba anônima

4. **Verifique se há múltiplas variáveis:**
   - Procure por outras variáveis com nome similar
   - Pode haver `GEMINI_API_KEY` duplicada

## 📸 Screenshots de Referência

### Onde encontrar Environment:
```
Render Dashboard
  └─ Seu Web Service (postei)
      └─ Menu Lateral: "Environment"
          └─ Lista de variáveis
              └─ GEMINI_API_KEY [Edit]
```

### Como deve ficar após atualizar:
```
GEMINI_API_KEY    AIzaSyAJWLaT_cTcr8zwU6ansd2DiGT-iZUMOB4    [Edit] [Delete]
```

## ✅ Checklist Final
- [ ] Acessei o Render Dashboard
- [ ] Encontrei o serviço "postei"
- [ ] Fui em Environment
- [ ] Encontrei GEMINI_API_KEY
- [ ] Cliquei em Edit
- [ ] Deletei a chave antiga
- [ ] Colei a nova chave: `AIzaSyAJWLaT_cTcr8zwU6ansd2DiGT-iZUMOB4`
- [ ] Salvei as mudanças
- [ ] Aguardei o deploy terminar (1-2 minutos)
- [ ] Testei `/test/gemini-check` e vi a nova chave
- [ ] Testei `/test/gemini-images` e funcionou sem erro 403

---

**Tempo estimado: 3-5 minutos**

