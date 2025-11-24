const cron = require('node-cron');
const { schedules: scheduleDB } = require('../database');
const { uploadVideoToYouTube } = require('./youtube-uploader');

// Verificar e executar agendamentos
async function checkAndPost() {
  try {
    const now = new Date();
    // findPending pode ser async (PostgreSQL) ou sync (SQLite)
    let pending;
    if (typeof scheduleDB.findPending === 'function' && scheduleDB.findPending.constructor.name === 'AsyncFunction') {
      pending = await scheduleDB.findPending();
    } else {
      pending = scheduleDB.findPending();
    }
    
    // Garantir que pending é um array
    if (!Array.isArray(pending)) {
      console.warn('⚠️  findPending não retornou um array:', pending);
      pending = [];
    }
    
    for (const schedule of pending) {
      const scheduledTime = new Date(schedule.scheduled_time);
      const timeDiff = (now - scheduledTime) / 1000; // segundos
      
      // Verificar se o conteúdo foi gerado (não pode publicar sem título)
      if (!schedule.title || schedule.title.trim() === '') {
        console.log(`⏳ Agendamento ${schedule.id} ainda aguardando geração de conteúdo com IA...`);
        continue; // Pular se não tiver conteúdo gerado
      }
      
      // Executar se estiver atrasado ou dentro de 1 minuto antes
      if (timeDiff >= -60 && timeDiff <= 300) { // -1 min a +5 min
        console.log(`📤 Executando agendamento ${schedule.id}...`);
        console.log(`   Título: ${schedule.title.substring(0, 50)}...`);
        
        // Marcar como processando
        if (scheduleDB.updateStatus.constructor.name === 'AsyncFunction') {
          await scheduleDB.updateStatus(schedule.id, 'processing');
        } else {
          scheduleDB.updateStatus(schedule.id, 'processing');
        }
        
        try {
          // Fazer upload
          const result = await uploadVideoToYouTube(
            schedule.user_id,
            schedule.video_path,
            schedule.title,
            schedule.description,
            schedule.thumbnail_path || null
          );
          
          if (result.success) {
            if (scheduleDB.updateStatus.constructor.name === 'AsyncFunction') {
              await scheduleDB.updateStatus(schedule.id, 'completed', result.videoId);
            } else {
              scheduleDB.updateStatus(schedule.id, 'completed', result.videoId);
            }
            
            // Salvar no banco de vídeos publicados
            const { published } = require('../database');
            try {
              if (published.create.constructor.name === 'AsyncFunction') {
                await published.create(
                  schedule.user_id,
                  schedule.video_path,
                  result.videoId,
                  result.videoUrl,
                  schedule.title || 'Sem título',
                  schedule.description || '#shorts',
                  schedule.thumbnail_path || null
                );
              } else {
                published.create(
                  schedule.user_id,
                  schedule.video_path,
                  result.videoId,
                  result.videoUrl,
                  schedule.title || 'Sem título',
                  schedule.description || '#shorts',
                  schedule.thumbnail_path || null
                );
              }
            } catch (err) {
              published.create(
                schedule.user_id,
                schedule.video_path,
                result.videoId,
                result.videoUrl,
                schedule.title || 'Sem título',
                schedule.description || '#shorts',
                schedule.thumbnail_path || null
              );
            }
          } else {
            if (scheduleDB.updateStatus.constructor.name === 'AsyncFunction') {
              await scheduleDB.updateStatus(schedule.id, 'failed', null, result.error);
            } else {
              scheduleDB.updateStatus(schedule.id, 'failed', null, result.error);
            }
          }
        } catch (error) {
          scheduleDB.updateStatus(schedule.id, 'failed', null, error.message);
        }
      }
    }
  } catch (error) {
    console.error('Erro ao verificar agendamentos:', error);
  }
}

// Iniciar scheduler
function start() {
  // Verificar a cada 30 segundos
  cron.schedule('*/30 * * * * *', checkAndPost);
  console.log('✅ Scheduler iniciado (verificando a cada 30 segundos)');
}

module.exports = {
  start
};

