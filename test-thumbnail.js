require('dotenv').config();
const { generateContentWithGemini } = require('./services/gemini-service');
const path = require('path');

async function test() {
  console.log('🧪 Teste de geração de thumbnail\n');
  
  // Caminho de teste - ajuste conforme necessário
  const videoPath = process.argv[2] || 'F:\\isauro\\videos\\Filmes e Séries (2).mp4';
  const videoName = path.basename(videoPath);
  
  console.log(`📁 Vídeo: ${videoPath}`);
  console.log(`📝 Nome: ${videoName}\n`);
  
  try {
    const result = await generateContentWithGemini(videoPath, videoName);
    
    console.log('\n📦 RESULTADO FINAL:');
    console.log(JSON.stringify(result, null, 2));
    console.log('\n📸 Thumbnail path:', result.thumbnail_path);
    console.log('📸 Thumbnail existe?', result.thumbnail_path ? require('fs').existsSync(result.thumbnail_path) : false);
    
    if (result.thumbnail_path) {
      const fs = require('fs');
      const stats = fs.statSync(result.thumbnail_path);
      console.log('📸 Tamanho:', stats.size, 'bytes');
    }
  } catch (error) {
    console.error('❌ Erro:', error);
    console.error('Stack:', error.stack);
  }
  
  process.exit(0);
}

test();

