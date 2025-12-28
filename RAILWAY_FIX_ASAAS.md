# 🔧 Como Configurar ASAAS_API_KEY no Railway

## ❌ Problema

O Railway está dando erro ao processar a variável `ASAAS_API_KEY` porque ela contém caracteres especiais (`$`).

## ✅ Solução

### Opção 1: Copiar o valor SEM o `$` no início

A chave do Asaas que você tem:
```
$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFjOGQyZmYyLWExY2MtNDY0ZC04YzBlLThlMjBlYzM1YWE2NDo6JGFhY2hfMWJmYjE1YTMtMWZkZi00ZTk4LWEzNWEtNmI2ZTJiNjBmNzY3
```

**No Railway, cole APENAS a parte após o `$`:**
```
aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFjOGQyZmYyLWExY2MtNDY0ZC04YzBlLThlMjBlYzM1YWE2NDo6JGFhY2hfMWJmYjE1YTMtMWZkZi00ZTk4LWEzNWEtNmI2ZTJiNjBmNzY3
```

### Opção 2: Usar aspas (se necessário)

Se a Opção 1 não funcionar, tente colocar entre aspas:
```
"$aact_hmlg_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OmFjOGQyZmYyLWExY2MtNDY0ZC04YzBlLThlMjBlYzM1YWE2NDo6JGFhY2hfMWJmYjE1YTMtMWZkZi00ZTk4LWEzNWEtNmI2ZTJiNjBmNzY3"
```

## 📝 Passo a Passo no Railway

1. **Acesse o projeto no Railway**
2. **Vá em "Variables"**
3. **Clique em "+ New Variable"**
4. **Configure:**
   - **Name:** `ASAAS_API_KEY`
   - **Value:** Cole o valor (sem o `$` inicial ou com aspas)
   - **Environment:** Production, Preview, Development
5. **Salve**

## ⚠️ Importante

- **NÃO** deixe espaços antes ou depois do valor
- **NÃO** adicione quebras de linha
- **NÃO** copie o `$` inicial (a menos que use aspas)
- Certifique-se de que não há caracteres invisíveis

## 🔍 Verificar se está correto

Após configurar, faça um novo deploy e verifique os logs. Se ainda der erro, tente:

1. Remover a variável
2. Criar novamente copiando o valor diretamente
3. Verificar se não há espaços extras


