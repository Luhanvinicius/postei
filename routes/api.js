const express = require('express');
const router = express.Router();

// API para gerar conteúdo com Gemini
router.post('/generate-content', async (req, res) => {
  try {
    const { videoPath, videoName } = req.body;
    const { generateContentWithGemini } = require('../services/gemini-service');
    
    const result = await generateContentWithGemini(videoPath, videoName);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Erro ao gerar conteúdo:', error);
    res.json({ success: false, error: error.message });
  }
});

// API para agendar vídeo
router.post('/schedule-video', async (req, res) => {
  try {
    const { videoPath, scheduledTime, title, description } = req.body;
    const userId = req.user.id;
    
    const { schedules } = require('../database');
    const scheduleId = schedules.create(userId, videoPath, scheduledTime, title, description);
    
    res.json({ success: true, scheduleId });
  } catch (error) {
    console.error('Erro ao agendar vídeo:', error);
    res.json({ success: false, error: error.message });
  }
});

// API para listar vídeos agendados
router.get('/scheduled-videos', async (req, res) => {
  try {
    const userId = req.user.id;
    const { schedules } = require('../database');
    const videos = schedules.findByUserId(userId);
    
    // Converter para formato esperado pelo frontend
    const formattedVideos = videos.map(v => ({
      id: v.id,
      videoPath: v.video_path,
      scheduledTime: v.scheduled_time,
      title: v.title,
      description: v.description,
      status: v.status,
      videoId: v.video_id,
      error: v.error
    }));
    
    res.json({ success: true, videos: formattedVideos });
  } catch (error) {
    console.error('Erro ao listar vídeos:', error);
    res.json({ success: false, error: error.message });
  }
});

module.exports = router;

