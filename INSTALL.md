# 📦 Guia de Instalação

## Pré-requisitos

- Node.js 18+ 
- npm ou yarn
- FFmpeg (para processamento de vídeo)

## Instalação do FFmpeg

### Windows
```bash
# Usando Chocolatey
choco install ffmpeg

# Ou baixe de: https://ffmpeg.org/download.html
```

### Linux
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

### macOS
```bash
brew install ffmpeg
```

## Passos de Instalação

1. **Instalar dependências:**
```bash
cd youtube-automation-node
npm install
```

2. **Configurar variáveis de ambiente:**
```bash
cp .env.example .env
# Edite o .env com suas configurações
```

3. **Iniciar servidor:**
```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

4. **Acessar:**
- Abra: http://localhost:3000
- Login padrão: `admin` / `admin123`

## ⚠️ Importante

- Altere a senha do admin após o primeiro login
- Configure sua chave do Gemini API no `.env`
- Cada usuário precisa fazer upload do seu próprio `client_secrets.json`

## 🚀 Deploy

O projeto está pronto para deploy em:
- Render
- Railway  
- Fly.io
- Vercel (com adaptações)

Veja o README.md para mais detalhes de deploy.


