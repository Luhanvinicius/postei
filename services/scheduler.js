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
      
      // Executar se estiver atrasado ou dentro de 1 minuto antes
      if (timeDiff >= -60 && timeDiff <= 300) { // -1 min a +5 min
        console.log(`📤 Executando agendamento ${schedule.id}...`);
        
        // Marcar como processando
        scheduleDB.updateStatus(schedule.id, 'processing');
        
        try {
          // Fazer upload
          const result = await uploadVideoToYouTube(
            schedule.user_id,
            schedule.video_path,
            schedule.title,
            schedule.description
          );
          
          if (result.success) {
            scheduleDB.updateStatus(schedule.id, 'completed', result.videoId);
            
            // Salvar no banco de vídeos publicados
            const { published } = require('../database');
            published.create(
              schedule.user_id,
              schedule.video_path,
              result.videoId,
              result.videoUrl,
              schedule.title || 'Sem título',
              schedule.description || '#shorts'
            );
          } else {
            scheduleDB.updateStatus(schedule.id, 'failed', null, result.error);
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

