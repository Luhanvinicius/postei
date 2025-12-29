# Script para iniciar o servidor localmente
Write-Host "🚀 Iniciando servidor local..." -ForegroundColor Green

# Verificar se .env existe
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  Arquivo .env não encontrado!" -ForegroundColor Yellow
    Write-Host "📝 Criando .env a partir de env.example..." -ForegroundColor Yellow
    Copy-Item "env.example" ".env"
    Write-Host "✅ Arquivo .env criado!" -ForegroundColor Green
    Write-Host "⚠️  IMPORTANTE: Edite o arquivo .env e configure:" -ForegroundColor Yellow
    Write-Host "   - SESSION_SECRET (gere um valor aleatório)" -ForegroundColor Yellow
    Write-Host "   - GEMINI_API_KEY (se necessário)" -ForegroundColor Yellow
    Write-Host ""
}

# Verificar se node_modules existe
if (-not (Test-Path "node_modules")) {
    Write-Host "📦 Instalando dependências..." -ForegroundColor Yellow
    npm install
}

Write-Host "🌐 Iniciando servidor na porta 3000..." -ForegroundColor Green
Write-Host "📍 Acesse: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

# Iniciar servidor
node server.js


