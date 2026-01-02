# 🔐 Configuração do Google OAuth para YouTube

## ⚠️ IMPORTANTE: Erro redirect_uri_mismatch

Se você está recebendo o erro `redirect_uri_mismatch`, siga estes passos:

## 📋 Passo a Passo

### 1. Acesse o Google Cloud Console
- Vá para: https://console.cloud.google.com/apis/credentials
- Selecione o projeto correto

### 2. Encontre seu Client ID OAuth 2.0
- Na lista de credenciais, encontre o Client ID que você está usando
- Clique nele para editar

### 3. Configure os Redirect URIs

No campo **"URIs de redirecionamento autorizados"**, adicione **TODOS** estes URIs:

```
https://www.postei.pro/user/auth/callback
https://postei.pro/user/auth/callback
```

**⚠️ IMPORTANTE:**
- Adicione AMBOS os URIs (com e sem www)
- Certifique-se de que não há espaços extras
- Certifique-se de que está usando `https://` (não `http://`)
- O caminho deve ser exatamente `/user/auth/callback`

### 4. Configure as Origens JavaScript Autorizadas

No campo **"Origens JavaScript autorizadas"**, adicione:

```
https://www.postei.pro
https://postei.pro
```

### 5. Salvar e Aguardar
- Clique em **"Salvar"**
- **Aguarde 5-10 minutos** para as alterações entrarem em vigor

## 🔍 Como Verificar Qual Redirect URI Está Sendo Usado

1. Tente autenticar novamente
2. Abra o console do navegador (F12)
3. Procure por mensagens que começam com `🔗 Redirect URI`
4. Ou verifique os logs do servidor no Render

## 📝 Variáveis de Ambiente no Render

Certifique-se de que estas variáveis estão configuradas no Render:

```
BASE_URL=https://www.postei.pro
YOUTUBE_REDIRECT_URI=https://www.postei.pro/user/auth/callback
```

## ✅ Verificação Final

Após configurar, teste novamente:
1. Vá para `/user/accounts`
2. Clique em "Autenticar Canal"
3. Se ainda der erro, verifique os logs do servidor para ver qual redirect URI está sendo usado

## 🆘 Ainda com Problemas?

Se ainda estiver com problemas:
1. Verifique os logs do servidor no Render
2. Procure por mensagens que começam com `🔗 Redirect URI usado:`
3. Adicione esse URI exato no Google Cloud Console

