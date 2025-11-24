const { generateContentWithGemini } = require('./gemini-service');
const path = require('path');

/**
 * Processa agendamentos que precisam de conteúdo gerado com IA
 * Roda 10 minutos antes do horário agendado
 */
async function processPendingAI() {
  try {
    const { schedules } = require('../database');
    
    // Buscar agendamentos que precisam de IA (10 min antes)
    let pendingVideos;
    try {
      if (schedules.findNeedingAI.constructor.name === 'AsyncFunction') {
        pendingVideos = await schedules.findNeedingAI();
      } else {
        pendingVideos = schedules.findNeedingAI.all();
      }
    } catch (err) {
      pendingVideos = schedules.findNeedingAI.all();
    }
    
    if (!pendingVideos || pendingVideos.length === 0) {
      console.log('📋 Nenhum vídeo precisa de conteúdo com IA no momento');
      return { processed: 0, errors: [] };
    }
    
    console.log(`🤖 Processando ${pendingVideos.length} vídeo(s) que precisam de conteúdo com IA...`);
    
    const errors = [];
    let processed = 0;
    
    for (const video of pendingVideos) {
      try {
        console.log(`\n📹 Processando: ${path.basename(video.video_path)}`);
        console.log(`   Agendado para: ${new Date(video.scheduled_time).toLocaleString('pt-BR')}`);
        
        // Gerar conteúdo com IA
        const videoName = path.basename(video.video_path);
        const geminiResult = await generateContentWithGemini(video.video_path, videoName);
        
        if (!geminiResult || !geminiResult.title) {
          console.warn(`⚠️  Falha ao gerar conteúdo, usando fallback`);
          // Usar fallback
          const fallbackTitle = videoName.replace(/\.[^/.]+$/, '');
          const fallbackDescription = '#shorts';
          
          // Atualizar agendamento com conteúdo fallback
          try {
            if (schedules.updateContent.constructor.name === 'AsyncFunction') {
              await schedules.updateContent(video.id, fallbackTitle, fallbackDescription, null);
            } else {
              schedules.updateContent.run(fallbackTitle, fallbackDescription, null, video.id);
            }
          } catch (updateErr) {
            schedules.updateContent.run(fallbackTitle, fallbackDescription, null, video.id);
          }
          
          processed++;
          console.log(`✅ Conteúdo fallback aplicado`);
          continue;
        }
        
        // Atualizar agendamento com conteúdo gerado
        const title = geminiResult.title;
        const description = geminiResult.description || '#shorts';
        const thumbnailPath = geminiResult.thumbnail_path || null;
        
        try {
          if (schedules.updateContent.constructor.name === 'AsyncFunction') {
            await schedules.updateContent(video.id, title, description, thumbnailPath);
          } else {
            schedules.updateContent.run(title, description, thumbnailPath, video.id);
          }
        } catch (updateErr) {
          schedules.updateContent.run(title, description, thumbnailPath, video.id);
        }
        
        processed++;
        console.log(`✅ Conteúdo gerado com IA:`);
        console.log(`   Título: ${title.substring(0, 50)}...`);
        console.log(`   Thumbnail: ${thumbnailPath ? 'Sim' : 'Não'}`);
        
      } catch (error) {
        console.error(`❌ Erro ao processar vídeo ${video.id}:`, error.message);
        errors.push({
          videoId: video.id,
          videoPath: video.video_path,
          error: error.message
        });
      }
    }
    
    console.log(`\n✅ Processamento concluído: ${processed} vídeo(s) processado(s)`);
    if (errors.length > 0) {
      console.warn(`⚠️  ${errors.length} erro(s) encontrado(s)`);
    }
    
    return { processed, errors };
    
  } catch (error) {
    console.error('❌ Erro ao processar agendamentos pendentes:', error);
    return { processed: 0, errors: [error.message] };
  }
}

module.exports = {
  processPendingAI
};

