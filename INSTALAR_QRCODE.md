# Instalar Biblioteca QRCode

Para exibir o QR Code PIX corretamente, é necessário instalar a biblioteca `qrcode`.

## Instalação

Execute no terminal (na pasta `postei`):

```bash
npm install qrcode
```

Ou se estiver usando PowerShell e tiver problemas de política de execução:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
npm install qrcode
```

## O que foi implementado

1. O sistema tenta primeiro usar o QR Code retornado pelo Asaas (se disponível)
2. Se o Asaas não retornar o QR Code, o sistema gera automaticamente a partir da chave PIX
3. O QR Code é salvo na fatura e exibido na página de pagamento pendente

## Teste

Após instalar a biblioteca, reinicie o servidor e gere um novo pagamento PIX. O QR Code deve aparecer corretamente na tela.






