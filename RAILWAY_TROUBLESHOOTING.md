# 🔧 Troubleshooting - Erro "invalid key-value pair" no Railway

## ❌ Erro Atual

```
ERROR: invalid key-value pair "= ASAAS_API_KEY=...": empty key
```

## 🔍 Causa

O Railway está interpretando a variável de ambiente de forma incorreta durante o build. Isso geralmente acontece quando:

1. Há um espaço antes do nome da variável
2. Há caracteres invisíveis
3. A variável foi copiada com formatação incorreta

## ✅ Solução Passo a Passo

### 1. Remover TODAS as variáveis relacionadas ao Asaas

No Railway:
1. Vá em **Variables**
2. **DELETE** todas as variáveis que começam com `ASAAS`
3. Certifique-se de que não há espaços ou caracteres estranhos

### 2. Adicionar a variável CORRETAMENTE

**IMPORTANTE:** Siga estes passos EXATAMENTE:

1. **Clique em "+ New Variable"**
2. **Name:** Digite manualmente (NÃO copie e cole): `ASAAS_API_KEY`
3. **Value:** Cole APENAS este valor (sem espaços, sem quebras de linha):
   ```
   aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFjOGQyZmYyLWExY2MtNDY0ZC04YzBlLThlMjBlYzM1YWE2NDo6JGFhY2hfMWJmYjE1YTMtMWZkZi00ZTk4LWEzNWEtNmI2ZTJiNjBmNzY3
   ```
4. **Environment:** Selecione **Production**, **Preview** e **Development**
5. **Clique em "Add"**

### 3. Verificar se está correto

Após adicionar, a variável deve aparecer assim:
- **Name:** `ASAAS_API_KEY` (sem espaços antes ou depois)
- **Value:** `aact_hmlg_000Mzkw...` (sem `$`, sem espaços)

### 4. Adicionar outras variáveis necessárias

**ASAAS_ENVIRONMENT:**
- **Name:** `ASAAS_ENVIRONMENT`
- **Value:** `sandbox`
- **Environment:** Production, Preview, Development

**SESSION_SECRET:**
- **Name:** `SESSION_SECRET`
- **Value:** (gere com: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
- **Environment:** Production, Preview, Development

**DATABASE_URL:**
- Railway cria automaticamente se você adicionar um PostgreSQL
- Ou adicione manualmente com sua connection string

## 🚨 Se ainda der erro

### Opção 1: Remover temporariamente ASAAS_API_KEY

Se o erro persistir, você pode:
1. **Remover** `ASAAS_API_KEY` temporariamente
2. Fazer o deploy funcionar primeiro
3. Adicionar `ASAAS_API_KEY` depois que o deploy estiver funcionando

O backend funcionará sem pagamentos, mas você pode adicionar depois.

### Opção 2: Verificar logs completos

1. No Railway, vá em **Deployments**
2. Clique no deployment que falhou
3. Veja os logs completos para identificar exatamente onde está o problema

### Opção 3: Limpar e recriar

1. **Delete** o serviço no Railway
2. **Crie um novo** projeto
3. **Conecte** o mesmo repositório
4. **Configure** as variáveis novamente, seguindo os passos acima

## 📝 Checklist

Antes de fazer deploy, certifique-se:

- [ ] `ASAAS_API_KEY` não tem espaços antes ou depois do nome
- [ ] `ASAAS_API_KEY` não tem o `$` no valor
- [ ] `ASAAS_API_KEY` não tem quebras de linha
- [ ] `DATABASE_URL` está configurada
- [ ] `SESSION_SECRET` está configurada
- [ ] Todas as variáveis estão marcadas para Production, Preview e Development

## 💡 Dica

Se você não conseguir fazer funcionar, pode deixar `ASAAS_API_KEY` vazia temporariamente. O backend funcionará, mas os pagamentos não. Você pode adicionar depois quando o deploy estiver funcionando.



