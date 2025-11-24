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

// API de teste para gerar conteúdo com frames
router.post('/gemini-frames/generate', async (req, res) => {
  try {
    const { videoPath } = req.body;
    
    if (!videoPath) {
      return res.json({ success: false, error: 'Caminho do vídeo não fornecido' });
    }
    
    console.log('\n🧪 ===== TESTE DE GERAÇÃO COM FRAMES =====');
    console.log('📹 Vídeo:', videoPath);
    
    const { generateContentWithGemini } = require('../services/gemini-service');
    const videoName = path.basename(videoPath);
    
    const content = await generateContentWithGemini(videoPath, videoName);
    
    console.log('\n✅ ===== RESULTADO DO TESTE =====');
    console.log('📝 Título:', content.title);
    console.log('📄 Descrição:', content.description);
    console.log('📸 Thumbnail:', content.thumbnail_path);
    
    res.json({
      success: true,
      title: content.title,
      description: content.description,
      thumbnail_path: content.thumbnail_path
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.json({ success: false, error: error.message, stack: error.stack });
  }
});

module.exports = router;
