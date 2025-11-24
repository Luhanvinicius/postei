# 🔧 Como Configurar Redirect URI para Render (Produção)

## ⚠️ IMPORTANTE

**Aplicações Desktop NÃO permitem configurar redirect URIs customizados!**

Para funcionar no Render, você **PRECISA** usar uma credencial do tipo **Web Application**.

Veja o guia completo: [COMO_MUDAR_PARA_WEB_APP.md](./COMO_MUDAR_PARA_WEB_APP.md)

## 📋 Passo a Passo

### 1. Descobrir a URL do Render

A URL do seu app no Render geralmente é:
- `https://seu-app.onrender.com`
- Ou a URL customizada que você configurou

**Exemplo:** `https://postei.onrender.com`

### 2. Acesse o Google Cloud Console

1. Vá para: https://console.cloud.google.com/
2. Selecione seu projeto
3. Vá em **APIs & Services** > **Credentials**

### 3. Editar a Credencial OAuth 2.0

1. Clique na credencial OAuth 2.0 que você está usando (a que tem o `client_id` do seu `client_secrets.json`)
2. **IMPORTANTE:** Mesmo sendo "Desktop app", você pode adicionar redirect URIs

### 4. Adicionar Redirect URI do Render

1. Procure por **"Authorized redirect URIs"** ou **"URIs de redirecionamento autorizados"**
2. Se não aparecer, pode ser que precise mudar o tipo de aplicação ou adicionar manualmente
3. Adicione a URL completa:
   ```
   https://seu-app.onrender.com/user/auth/callback
   ```
   
   **Exemplo:**
   ```
   https://postei.onrender.com/user/auth/callback
   ```

4. Clique em **Save** (Salvar)

### 5. Alternativa: Mudar para Web Application

Se não conseguir adicionar redirect URI na Desktop app:

1. **Crie uma nova credencial OAuth 2.0** do tipo **"Web application"**
2. Em **Authorized redirect URIs**, adicione:
   - `http://localhost:3000/user/auth/callback` (para desenvolvimento)
   - `https://seu-app.onrender.com/user/auth/callback` (para produção)
3. Baixe o novo `client_secrets.json`
4. Faça upload do novo arquivo no sistema

### 6. Verificar no Sistema

Após configurar, quando você clicar em "Autenticar Canal" no Render, o sistema vai mostrar nos logs qual redirect URI está usando. Verifique se está exatamente igual ao que você configurou no Google Cloud Console.

## 🔍 Verificar Redirect URI Atual

Os logs do servidor no Render vão mostrar:
```
📱 Detectado: Aplicação Desktop - usando https://seu-app.onrender.com/user/auth/callback
🔗 Redirect URI usado: https://seu-app.onrender.com/user/auth/callback
```

**IMPORTANTE:** A URL nos logs deve ser **exatamente igual** à que você configurou no Google Cloud Console.

## ⚠️ Erros Comuns

### Erro: "redirect_uri_mismatch"

**Causa:** A URL usada não está configurada no Google Cloud Console.

**Solução:**
1. Verifique os logs do Render para ver qual URL está sendo usada
2. Adicione essa URL exata no Google Cloud Console
3. Aguarde alguns minutos (pode levar até 5 minutos para propagar)

### A URL está diferente

**Causa:** O sistema não está detectando a URL do Render corretamente.

**Solução:**
1. Configure a variável de ambiente `BASE_URL` no Render:
   - Vá em **Environment** no Render
   - Adicione: `BASE_URL` = `https://seu-app.onrender.com`
2. Ou configure `YOUTUBE_REDIRECT_URI` diretamente:
   - Adicione: `YOUTUBE_REDIRECT_URI` = `https://seu-app.onrender.com/user/auth/callback`

## 💡 Dica

Para facilitar, você pode adicionar **ambas as URLs** no Google Cloud Console:
- `http://localhost:3000/user/auth/callback` (para desenvolvimento local)
- `https://seu-app.onrender.com/user/auth/callback` (para produção no Render)

Assim funciona em ambos os ambientes! 🎉

