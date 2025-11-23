# 🔧 Como Resolver "Insufficient Permission"

## ⚠️ O que significa este erro?

O erro "Insufficient Permission" acontece quando o Google não consegue conceder as permissões solicitadas. Isso geralmente ocorre porque:

1. **Os escopos não estão habilitados** no Google Cloud Console
2. **O OAuth consent screen não está configurado** corretamente
3. **As APIs do YouTube não estão habilitadas** no projeto

## 📋 Solução Passo a Passo

### 1. Habilitar APIs do YouTube

1. Acesse: https://console.cloud.google.com/
2. Selecione seu projeto
3. Vá em **APIs & Services** > **Library**
4. Procure por **"YouTube Data API v3"**
5. Clique em **Enable** (Habilitar)

### 2. Configurar OAuth Consent Screen

1. Vá em **APIs & Services** > **OAuth consent screen**
2. Escolha **External** (ou Internal se for Workspace)
3. Preencha os campos obrigatórios:
   - **App name**: Nome da sua aplicação
   - **User support email**: Seu email
   - **Developer contact information**: Seu email
4. Clique em **Save and Continue**

### 3. Adicionar Escopos

1. Na tela de **Scopes**, clique em **Add or Remove Scopes**
2. Adicione manualmente ou selecione:
   - `https://www.googleapis.com/auth/youtube.upload`
   - `https://www.googleapis.com/auth/youtube`
   - `https://www.googleapis.com/auth/youtube.readonly`
3. Clique em **Update** e depois **Save and Continue**

### 4. Adicionar Usuários de Teste (se necessário)

1. Se o app estiver em modo "Testing":
   - Vá em **Test users**
   - Clique em **Add Users**
   - Adicione o email da conta Google que você vai usar para autenticar
   - Clique em **Save**

### 5. Verificar Credenciais OAuth

1. Vá em **APIs & Services** > **Credentials**
2. Clique na credencial OAuth 2.0 que você está usando
3. Verifique se está como **Web application** (não Desktop)
4. Em **Authorized redirect URIs**, certifique-se de ter:
   ```
   http://localhost:3000/user/auth/callback
   ```

### 6. Publicar o App (Opcional)

Se quiser usar sem adicionar usuários de teste:
1. Vá em **OAuth consent screen**
2. Clique em **Publish App**
3. Confirme a publicação

⚠️ **Nota**: A publicação pode levar alguns dias para ser aprovada pelo Google.

## 🔍 Verificar se está funcionando

Após seguir os passos acima:

1. **Revogue o acesso anterior** (se houver):
   - Acesse: https://myaccount.google.com/permissions
   - Revogue o acesso da sua aplicação

2. **Tente autenticar novamente** no dashboard

3. **Verifique o console do servidor** para ver mensagens de erro mais detalhadas

## 💡 Dicas

- Se continuar dando erro, verifique se o **redirect_uri** está exatamente igual no Google Cloud Console
- Certifique-se de que está usando a mesma conta Google no navegador e no OAuth
- Se o app estiver em modo "Testing", você DEVE adicionar seu email como usuário de teste
- Alguns escopos podem precisar de verificação adicional pelo Google (para apps públicos)

## 🆘 Ainda não funciona?

Se após seguir todos os passos ainda não funcionar:

1. Verifique os logs do servidor para mensagens de erro mais específicas
2. Certifique-se de que o arquivo `client_secrets.json` está correto
3. Tente criar uma nova credencial OAuth no Google Cloud Console
4. Verifique se não há restrições de domínio ou IP nas credenciais


