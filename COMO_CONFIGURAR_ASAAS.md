# Como Configurar a Integração com Asaas

Este guia explica como configurar a integração com a API do Asaas para processar pagamentos via PIX.

## 1. Criar Conta no Asaas

1. Acesse [https://www.asaas.com](https://www.asaas.com)
2. Crie uma conta (pode começar com ambiente sandbox para testes)
3. Complete o cadastro da sua empresa

## 2. Obter a API Key

1. Faça login no painel do Asaas
2. Vá em **Configurações** > **Integrações** > **API**
3. Copie sua **API Key** (chave de acesso)

### Ambiente Sandbox (Testes)
- Use a API Key do ambiente sandbox para testes
- Não processa pagamentos reais
- Ideal para desenvolvimento

### Ambiente Production (Produção)
- Use a API Key do ambiente de produção
- Processa pagamentos reais
- Configure após testes completos

## 3. Configurar Variáveis de Ambiente

### No Render (Produção)

1. Acesse seu projeto no Render
2. Vá em **Environment** (Variáveis de Ambiente)
3. Adicione as seguintes variáveis:

```
ASAAS_API_KEY=sua_chave_api_aqui
ASAAS_ENVIRONMENT=production
```

**OU para testes:**

```
ASAAS_API_KEY=sua_chave_api_sandbox_aqui
ASAAS_ENVIRONMENT=sandbox
```

### Localmente (Desenvolvimento)

Crie ou edite o arquivo `.env` na raiz do projeto:

```env
ASAAS_API_KEY=sua_chave_api_aqui
ASAAS_ENVIRONMENT=sandbox
```

## 4. Configurar Webhook (Opcional mas Recomendado)

O webhook permite que o Asaas notifique automaticamente quando um pagamento for confirmado.

1. No painel do Asaas, vá em **Configurações** > **Webhooks**
2. Adicione a URL do webhook:
   ```
   https://seu-dominio.onrender.com/payment/webhook/asaas
   ```
3. Selecione os eventos:
   - `PAYMENT_RECEIVED` (Pagamento Recebido)
   - `PAYMENT_OVERDUE` (Pagamento Vencido)
   - `PAYMENT_CREATED` (Pagamento Criado)

## 5. Testar a Integração

1. Acesse a página inicial: `https://seu-dominio.onrender.com`
2. Clique em "Escolher Plano" em qualquer plano
3. Faça login (ou crie uma conta)
4. Preencha os dados de checkout
5. Gere um PIX de teste
6. Verifique se o QR Code e a chave PIX são exibidos corretamente

## 6. Verificar Status das Faturas

### Como Admin:
- Acesse `/admin/invoices` para ver todas as faturas
- Filtre por status: Pendente, Pago, Vencido

### Como Usuário:
- Acesse `/user/profile` para ver suas faturas
- Clique em "Ver" para ver detalhes da fatura

## 7. Processamento de Pagamentos

Quando um pagamento for confirmado:

1. O Asaas envia um webhook para `/payment/webhook/asaas`
2. O sistema atualiza automaticamente o status da fatura
3. Se o pagamento for confirmado, a assinatura é ativada automaticamente
4. O usuário recebe acesso ao plano escolhido

## Troubleshooting

### Erro: "ASAAS_API_KEY não configurada"
- Verifique se a variável de ambiente está configurada corretamente
- Reinicie o servidor após adicionar a variável

### Erro: "Erro ao criar cliente no Asaas"
- Verifique se os dados do cliente estão corretos (CPF/CNPJ válido)
- Verifique se a API Key está correta

### Webhook não está funcionando
- Verifique se a URL do webhook está correta
- Verifique se o servidor está acessível publicamente
- Verifique os logs do servidor para erros

## Documentação da API Asaas

Para mais informações, consulte:
- [Documentação Oficial do Asaas](https://docs.asaas.com/)
- [API Reference](https://docs.asaas.com/reference)

## Suporte

Se tiver problemas, verifique:
1. Logs do servidor (Render Dashboard > Logs)
2. Logs do Asaas (Painel > Transações)
3. Status da API do Asaas

