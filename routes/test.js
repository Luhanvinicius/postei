const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs-extra');

// Rota de teste para debug de cookies/sessão
router.get('/debug-cookie', (req, res) => {
  try {
    const cookieHeader = req.headers.cookie || 'Nenhum cookie';
    const sessionId = req.sessionID || 'Nenhuma sessão';
    const sessionUser = req.session.user || null;
    
    res.json({
      cookies: cookieHeader,
      sessionId: sessionId,
      sessionUser: sessionUser,
      hasSession: !!req.session,
      sessionKeys: req.session ? Object.keys(req.session) : []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota de teste para login
router.post('/test-login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const { users } = require('../database');
    let user;
    try {
      if (users.findByUsername.constructor.name === 'AsyncFunction') {
        user = await users.findByUsername(username);
      } else {
        user = users.findByUsername(username);
      }
    } catch (err) {
      user = users.findByUsername(username);
    }
    
    if (!user) {
      return res.json({ success: false, error: 'Usuário não encontrado' });
    }
    
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.json({ success: false, error: 'Senha incorreta' });
    }
    
    // Criar sessão
    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
    
    res.json({ 
      success: true, 
      message: 'Login realizado com sucesso!',
      user: req.session.user
    });
  } catch (error) {
    res.json({ success: false, error: error.message });
  }
});

// Rota de teste para Gemini - geração de conteúdo com frames
router.get('/gemini-frames', (req, res) => {
  res.render('test-gemini-frames');
});

// Upload de vídeo para teste
router.post('/gemini-frames/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.video) {
      return res.json({ success: false, error: 'Nenhum vídeo enviado' });
    }

    const video = req.files.video;
    const videosDir = path.join(__dirname, '../videos', 'test');

    // Garantir que o diretório existe
    const fs = require('fs-extra');
    fs.ensureDirSync(videosDir);
    
    // Gerar nome único para evitar conflitos
    const timestamp = Date.now();
    const safeName = video.name.replace(/[^a-zA-Z0-9.\s\-_]/g, '');
    const videoPath = path.join(videosDir, `${timestamp}_${safeName}`);
    
    await video.mv(videoPath);

    console.log('✅ Vídeo de teste enviado:', videoPath);
    
    res.json({ 
      success: true, 
      message: 'Vídeo enviado com sucesso!',
      videoPath: videoPath
    });
  } catch (error) {
    console.error('Erro ao fazer upload do vídeo de teste:', error);
    res.json({ success: false, error: 'Erro ao fazer upload do vídeo: ' + error.message });
  }
});

// API de teste para gerar conteúdo com frames
router.post('/gemini-frames/generate', async (req, res) => {
  try {
    const { videoPath } = req.body;
    
    if (!videoPath) {
      return res.json({ success: false, error: 'Caminho do vídeo não fornecido' });
    }
    
    // Verificar se o arquivo existe
    const fs = require('fs-extra');
    if (!fs.existsSync(videoPath)) {
      return res.json({ success: false, error: `Vídeo não encontrado: ${videoPath}` });
    }
    
    console.log('\n🧪 ===== TESTE DE GERAÇÃO COM FRAMES =====');
    console.log('📹 Vídeo:', videoPath);
    console.log('📹 Vídeo existe?', fs.existsSync(videoPath));
    
    const { generateContentWithGemini } = require('../services/gemini-service');
    const videoName = path.basename(videoPath);
    
    const content = await generateContentWithGemini(videoPath, videoName);
    
    console.log('\n✅ ===== RESULTADO DO TESTE =====');
    console.log('📝 Título:', content.title);
    console.log('📄 Descrição:', content.description);
    console.log('📸 Thumbnail:', content.thumbnail_path);
    
    // Converter caminho absoluto para URL relativa
    let thumbnailUrl = null;
    if (content.thumbnail_path) {
      const thumbnailFileName = path.basename(content.thumbnail_path);
      thumbnailUrl = `/thumbnails/${thumbnailFileName}`;
    }
    
    res.json({
      success: true,
      title: content.title,
      description: content.description,
      thumbnail_path: thumbnailUrl
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.json({ success: false, error: error.message, stack: error.stack });
  }
});

module.exports = router;
