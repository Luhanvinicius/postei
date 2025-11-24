# 🔄 Como Mudar de Desktop App para Web Application no Google Cloud Console

## ⚠️ Por que mudar?

Aplicações **Desktop** não permitem configurar redirect URIs customizados. Elas só funcionam com `http://localhost`, que não funciona no Render (produção).

Para funcionar no **Render**, você precisa usar uma credencial do tipo **Web Application**.

## 📋 Passo a Passo

### Opção 1: Criar Nova Credencial Web Application (Recomendado)

1. **Acesse o Google Cloud Console**
   - Vá para: https://console.cloud.google.com/
   - Selecione seu projeto

2. **Vá em APIs & Services > Credentials**

3. **Criar Nova Credencial**
   - Clique em **"+ CREATE CREDENTIALS"** (Criar credenciais)
   - Selecione **"OAuth client ID"**

4. **Configurar OAuth Client**
   - **Application type:** Selecione **"Web application"**
   - **Name:** Dê um nome (ex: "YouTube Automation Web")
   - **Authorized redirect URIs:** Clique em **"+ ADD URI"** e adicione:
     ```
     http://localhost:3000/user/auth/callback
     ```
   - Clique em **"+ ADD URI"** novamente e adicione:
     ```
     https://postei.onrender.com/user/auth/callback
     ```
     (Substitua `postei.onrender.com` pela sua URL do Render)

5. **Salvar**
   - Clique em **"CREATE"** (Criar)

6. **Baixar Credenciais**
   - Após criar, uma janela vai aparecer com o **Client ID** e **Client Secret**
   - Clique em **"DOWNLOAD JSON"** para baixar o arquivo
   - OU copie o Client ID e Client Secret manualmente

7. **Criar arquivo client_secrets.json**
   
   Se você baixou o JSON, ele já está pronto. Se não, crie um arquivo `client_secrets.json` com este formato:
   
   ```json
   {
     "web": {
       "client_id": "SEU_CLIENT_ID_AQUI.apps.googleusercontent.com",
       "project_id": "seu-project-id",
       "auth_uri": "https://accounts.google.com/o/oauth2/auth",
       "token_uri": "https://oauth2.googleapis.com/token",
       "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
       "client_secret": "SEU_CLIENT_SECRET_AQUI",
       "redirect_uris": [
         "http://localhost:3000/user/auth/callback",
         "https://postei.onrender.com/user/auth/callback"
       ]
     }
   }
   ```
   
   **Substitua:**
   - `SEU_CLIENT_ID_AQUI` pelo Client ID que você copiou
   - `SEU_CLIENT_SECRET_AQUI` pelo Client Secret que você copiou
   - `postei.onrender.com` pela sua URL do Render

8. **Fazer Upload no Sistema**
   - Acesse sua aplicação no Render
   - Vá em "Vincular Contas"
   - Clique em "Alterar Configuração"
   - Faça upload do novo arquivo `client_secrets.json`
   - Clique em "Autenticar Canal"

### Opção 2: Editar Credencial Desktop Existente (Se possível)

Alguns projetos permitem editar o tipo de aplicação:

1. **Acesse o Google Cloud Console**
   - Vá em **APIs & Services > Credentials**
   - Clique na credencial Desktop existente

2. **Tentar Editar**
   - Procure por um botão **"EDIT"** ou **"Editar"**
   - Veja se consegue mudar o tipo para **"Web application"**
   - Se conseguir, adicione os redirect URIs como na Opção 1

3. **Se não conseguir editar**
   - Use a **Opção 1** (criar nova credencial)

## ✅ Verificar se Funcionou

Após fazer upload do novo `client_secrets.json`:

1. Clique em **"Autenticar Canal"**
2. Deve redirecionar para o Google sem erro
3. Após autorizar, deve voltar e mostrar "Canal conectado"

## 🔍 Verificar nos Logs

Nos logs do Render, você deve ver:
```
🌐 Detectado: Aplicação Web
🔗 Redirect URI usado: https://postei.onrender.com/user/auth/callback
```

## ⚠️ Importante

- **Mantenha a credencial Desktop** se quiser continuar usando localmente
- **Use a credencial Web** para produção (Render)
- Ou use **apenas a credencial Web** para ambos (local e produção)

## 💡 Dica

Você pode ter **ambas as credenciais**:
- Uma Desktop para desenvolvimento local
- Uma Web para produção no Render

Basta fazer upload da credencial correta dependendo do ambiente!

