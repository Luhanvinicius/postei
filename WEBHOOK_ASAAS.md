# Configuração do Webhook do Asaas

## Problema
Quando você confirma um pagamento no Asaas, o sistema não confirma automaticamente porque o webhook não consegue acessar `localhost:3000` (servidor local).

## Soluções

### Opção 1: Usar ngrok (Recomendado para desenvolvimento)

1. **Instalar ngrok:**
   - Baixe em: https://ngrok.com/download
   - Ou via npm: `npm install -g ngrok`

2. **Criar túnel:**
   ```bash
   ngrok http 3000
   ```

3. **Copiar a URL do ngrok** (exemplo: `https://abc123.ngrok.io`)

4. **Configurar no Asaas:**
   - Acesse: https://www.asaas.com/ (ou sandbox)
   - Vá em: Configurações → Webhooks
   - Adicione a URL: `https://abc123.ngrok.io/payment/webhook/asaas`
   - Selecione os eventos: `PAYMENT_RECEIVED`, `PAYMENT_OVERDUE`

### Opção 2: Confirmar manualmente (Para testes)

Use o botão "Validar Pagamento (Teste)" na página de pagamento pendente.

### Opção 3: Verificar pagamento manualmente

Acesse a rota: `/payment/check/:invoiceId` (será criada)

## URL do Webhook

A URL do webhook deve ser:
```
https://seu-dominio.com/payment/webhook/asaas
```

Em desenvolvimento local com ngrok:
```
https://abc123.ngrok.io/payment/webhook/asaas
```

## Eventos do Asaas

O sistema processa os seguintes eventos:
- `PAYMENT_RECEIVED` - Pagamento confirmado
- `PAYMENT_OVERDUE` - Pagamento vencido
- `PAYMENT_CREATED` - Pagamento criado

## Teste

Após configurar o webhook, confirme um pagamento no Asaas e verifique os logs do servidor para ver se o webhook foi recebido.





