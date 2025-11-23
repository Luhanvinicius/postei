# Como Instalar FFmpeg no Windows

O sistema precisa do **FFmpeg** para extrair frames dos vídeos e gerar thumbnails.

## Opção 1: Instalação via Chocolatey (Recomendado)

Se você tem o Chocolatey instalado:

```powershell
choco install ffmpeg
```

## Opção 2: Instalação Manual

1. **Baixe o FFmpeg:**
   - Acesse: https://www.gyan.dev/ffmpeg/builds/
   - Baixe a versão "ffmpeg-release-essentials.zip"

2. **Extraia o arquivo:**
   - Extraia para `C:\ffmpeg` (ou outro local de sua preferência)

3. **Adicione ao PATH:**
   - Pressione `Win + R` e digite: `sysdm.cpl`
   - Vá em "Avançado" → "Variáveis de Ambiente"
   - Em "Variáveis do sistema", encontre "Path" e clique em "Editar"
   - Clique em "Novo" e adicione: `C:\ffmpeg\bin`
   - Clique em "OK" em todas as janelas

4. **Verifique a instalação:**
   - Abra um novo PowerShell
   - Execute: `ffmpeg -version`
   - Se aparecer a versão, está instalado corretamente!

## Opção 3: Configurar Caminho Manual no Código

Se você não quiser adicionar ao PATH, pode configurar diretamente no código:

1. Edite o arquivo: `youtube-automation-node/services/gemini-service.js`
2. Descomente as linhas no início do arquivo:
   ```javascript
   const ffmpegPath = 'C:\\ffmpeg\\bin\\ffmpeg.exe';
   const ffprobePath = 'C:\\ffmpeg\\bin\\ffprobe.exe';
   ```
3. Ajuste os caminhos conforme onde você extraiu o FFmpeg

## Verificar Instalação

Após instalar, reinicie o servidor Node.js e teste novamente. Os logs devem mostrar:

```
✅ FFmpeg encontrado no sistema
```

Se ainda aparecer erro, verifique se o caminho está correto.

