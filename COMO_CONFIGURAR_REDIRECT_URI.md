# 🔧 Como Configurar o Redirect URI no Google Cloud Console

## ⚠️ IMPORTANTE

O erro "Erro ao autenticar canal" geralmente acontece porque o **redirect_uri** não está configurado corretamente no Google Cloud Console.

## 📋 Passo a Passo

### 1. Acesse o Google Cloud Console
- Vá para: https://console.cloud.google.com/
- Selecione seu projeto (ou crie um novo)

### 2. Configure as Credenciais OAuth
1. Vá em **APIs & Services** > **Credentials**
2. Clique na credencial OAuth 2.0 que você está usando
3. Em **Authorized redirect URIs**, adicione:
   ```
   http://localhost:3000/user/auth/callback
   ```
4. Clique em **Save**

### 3. Verifique o Tipo de Aplicação
- Se o arquivo `client_secrets.json` tem `"installed"`, você precisa usar **Desktop app**
- Se tem `"web"`, use **Web application**

### 4. Para Aplicações Desktop (installed)
Se seu arquivo tem `"installed"`, você pode:
- **Opção A**: Mudar para Web application no Google Cloud Console
- **Opção B**: Usar `http://localhost` como redirect_uri (o código já ajusta automaticamente)

### 5. Teste Novamente
Após configurar, tente autenticar novamente no dashboard.

## 🔍 Verificar Redirect URI Atual

O redirect URI que o sistema está usando aparece no console do servidor quando você clica em "Autenticar Canal".

## 💡 Dica

Se continuar dando erro, verifique:
1. ✅ O redirect_uri está exatamente igual no Google Cloud Console
2. ✅ Não há espaços extras ou diferenças de maiúsculas/minúsculas
3. ✅ A credencial OAuth está ativa
4. ✅ As APIs do YouTube estão habilitadas


