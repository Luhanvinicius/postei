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

// Rota de teste para validar módulo Gemini
router.get('/gemini-check', (req, res) => {
  try {
    const checks = {
      moduleInstalled: false,
      moduleError: null,
      apiKeyConfigured: false,
      apiKeyValue: null,
      genAIInitialized: false,
      genAIError: null,
      environment: process.env.NODE_ENV || 'development',
      isRender: !!process.env.RENDER,
      isVercel: !!process.env.VERCEL
    };
    
    // Verificar se o módulo está instalado
    try {
      const geminiModule = require('@google/generative-ai');
      checks.moduleInstalled = !!geminiModule;
      console.log('✅ Módulo @google/generative-ai está instalado');
    } catch (err) {
      checks.moduleInstalled = false;
      checks.moduleError = err.message;
      console.error('❌ Módulo @google/generative-ai NÃO está instalado:', err.message);
    }
    
    // Verificar API Key
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    checks.apiKeyConfigured = !!GEMINI_API_KEY;
    if (GEMINI_API_KEY) {
      checks.apiKeyValue = GEMINI_API_KEY.substring(0, 10) + '...' + GEMINI_API_KEY.substring(GEMINI_API_KEY.length - 4);
    }
    
    // Tentar inicializar Gemini
    if (checks.moduleInstalled && checks.apiKeyConfigured) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        checks.genAIInitialized = !!genAI;
        console.log('✅ Gemini API inicializada com sucesso');
      } catch (err) {
        checks.genAIInitialized = false;
        checks.genAIError = err.message;
        console.error('❌ Erro ao inicializar Gemini:', err.message);
      }
    }
    
    // Status geral
    const allOk = checks.moduleInstalled && checks.apiKeyConfigured && checks.genAIInitialized;
    
    res.json({
      success: allOk,
      checks: checks,
      message: allOk 
        ? '✅ Gemini está configurado corretamente!' 
        : '❌ Gemini não está configurado corretamente. Verifique os erros acima.',
      instructions: !checks.moduleInstalled 
        ? 'Execute: npm install @google/generative-ai'
        : !checks.apiKeyConfigured
        ? 'Configure a variável de ambiente GEMINI_API_KEY'
        : !checks.genAIInitialized
        ? 'Erro ao inicializar Gemini. Verifique a API key.'
        : null
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message,
      stack: error.stack 
    });
  }
});

// Rota de teste para Gemini - análise de imagens
router.get('/gemini-images', (req, res) => {
  res.render('test-gemini-images');
});

// Upload de imagens para teste
router.post('/gemini-images/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.images) {
      return res.json({ success: false, error: 'Nenhuma imagem enviada' });
    }

    const images = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
    const imagesDir = path.join(__dirname, '../temp_frames', 'test_images');
    
    fs.ensureDirSync(imagesDir);
    
    const imagePaths = [];
    
    for (const image of images) {
      const timestamp = Date.now();
      const safeName = image.name.replace(/[^a-zA-Z0-9.\s\-_]/g, '');
      const imagePath = path.join(imagesDir, `${timestamp}_${safeName}`);
      
      await image.mv(imagePath);
      imagePaths.push(imagePath);
      
      console.log('✅ Imagem de teste enviada:', imagePath);
    }
    
    res.json({ 
      success: true, 
      message: `${images.length} imagem(ns) enviada(s) com sucesso!`,
      imagePaths: imagePaths
    });
  } catch (error) {
    console.error('Erro ao fazer upload das imagens de teste:', error);
    res.json({ success: false, error: 'Erro ao fazer upload das imagens: ' + error.message });
  }
});

// API de teste para gerar conteúdo com imagens
router.post('/gemini-images/generate', async (req, res) => {
  try {
    const { imagePaths } = req.body;
    
    if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
      return res.json({ success: false, error: 'Nenhuma imagem fornecida' });
    }
    
    console.log('\n🧪 ===== TESTE DE GERAÇÃO COM IMAGENS =====');
    console.log('📸 Total de imagens:', imagePaths.length);
    imagePaths.forEach((path, idx) => {
      console.log(`   Imagem ${idx + 1}: ${path} (existe: ${fs.existsSync(path)})`);
    });
    
    // Carregar imagens e converter para base64
    const frameData = await Promise.all(
      imagePaths.map(async (imagePath, index) => {
        try {
          if (!fs.existsSync(imagePath)) {
            console.error(`❌ Imagem ${index + 1} não existe: ${imagePath}`);
            return null;
          }
          
          const imageData = await fs.readFile(imagePath);
          const base64Data = imageData.toString('base64');
          
          console.log(`✅ Imagem ${index + 1} carregada: ${base64Data.length} chars base64`);
          
          return {
            inlineData: {
              data: base64Data,
              mimeType: 'image/jpeg' // Assumir JPEG, pode melhorar depois
            }
          };
        } catch (error) {
          console.error(`❌ Erro ao carregar imagem ${index + 1}:`, error);
          return null;
        }
      })
    );
    
    const validFrameData = frameData.filter(f => f !== null);
    
    if (validFrameData.length === 0) {
      return res.json({ success: false, error: 'Nenhuma imagem válida encontrada' });
    }
    
    console.log(`✅ ${validFrameData.length} imagem(ns) válida(s) para envio ao Gemini`);
    
    // Usar o serviço Gemini
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
      return res.json({ success: false, error: 'GEMINI_API_KEY não configurada' });
    }
    
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 1.0,
        topP: 0.95,
        topK: 40
      }
    });
    
    // PROMPT ULTRA ESPECÍFICO
    const prompt = `Você está recebendo ${validFrameData.length} imagem(ns) REAL(IS).

═══════════════════════════════════════════════════════════════
⚠️ INSTRUÇÕES OBRIGATÓRIAS - SIGA EXATAMENTE:
═══════════════════════════════════════════════════════════════

PASSO 1: ANÁLISE VISUAL DETALHADA (OBRIGATÓRIO)
Para CADA imagem acima, descreva EXATAMENTE o que você vê:
- Quem aparece? (descreva pessoas, personagens, atores - cor de pele, roupas, idade aproximada)
- O que estão fazendo? (ações específicas: falando, gesticulando, trabalhando, etc.)
- Onde estão? (cenário: sala, escritório, rua, estúdio, etc.)
- Qual é o contexto? (reunião, aula, entrevista, vlog, tutorial, etc.)
- Qual é a emoção/atmosfera? (sério, engraçado, dramático, educativo, etc.)

PASSO 2: CRIAR TÍTULO ESPECÍFICO BASEADO NO QUE VOCÊ VÊ
Baseado APENAS na sua análise visual acima, crie um título que:
- Descreva ESPECIFICAMENTE o conteúdo visual (não genérico!)
- Seja criativo e chamativo para redes sociais
- Use emojis relevantes ao conteúdo REAL que você vê
- Tenha entre 30-60 caracteres

EXEMPLOS DE TÍTULOS ESPECÍFICOS (baseados em análise visual):
- Se vê pessoas em reunião: "O momento mais tenso da reunião! 😰"
- Se vê alguém explicando algo: "Como [tema específico] funciona na prática! 💡"
- Se vê uma cena engraçada: "A reação mais inesperada que você vai ver! 😂"
- Se vê um tutorial: "Passo a passo que ninguém te ensinou! 🎯"

PASSO 3: CRIAR DESCRIÇÃO DETALHADA
Crie uma descrição de 2-3 linhas que:
- Descreva o conteúdo visual das imagens
- Inclua hashtags relevantes (#shorts, #viral, etc.)
- Seja específica baseada no que você VÊ nas imagens

═══════════════════════════════════════════════════════════════
❌ PROIBIÇÕES ABSOLUTAS:
═══════════════════════════════════════════════════════════════

NUNCA use:
- "A cena mais icônica de [palavra genérica]"
- "Por que [palavra] está viralizando?"
- Títulos genéricos que não descrevem o conteúdo visual
- Descrições vazias ou apenas "#shorts"

Se você usar qualquer título genérico, sua resposta será REJEITADA.

═══════════════════════════════════════════════════════════════
FORMATO DE RESPOSTA (OBRIGATÓRIO):
═══════════════════════════════════════════════════════════════

Responda APENAS em JSON válido (sem markdown, sem código):

{
    "title": "título ESPECÍFICO baseado no conteúdo visual que você VÊ nas imagens acima",
    "description": "Descrição detalhada de 2-3 linhas do conteúdo visual com hashtags relevantes como #shorts #viral"
}`;

    console.log('📤 Enviando para Gemini Vision API...');
    console.log(`   Modelo: gemini-2.0-flash`);
    console.log(`   Imagens: ${validFrameData.length}`);
    console.log(`   Prompt: ${prompt.length} caracteres`);
    
    const result = await model.generateContent([...validFrameData, prompt]);
    const response = result.response.text();
    
    console.log('\n✅ Resposta recebida do Gemini Vision!');
    console.log(`📝 Tamanho da resposta: ${response.length} caracteres`);
    console.log(`📝 Primeiros 500 caracteres: ${response.substring(0, 500)}`);
    console.log(`📝 Resposta completa: ${response}`);
    
    // Parse JSON
    let title = null;
    let description = null;
    
    let jsonMatch = response.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      jsonMatch = response.match(/```json\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonMatch = [jsonMatch[1], jsonMatch[1]];
      }
    }
    
    if (!jsonMatch) {
      jsonMatch = response.match(/\{[\s\S]*?\}/);
    }
    
    if (jsonMatch) {
      try {
        const content = JSON.parse(jsonMatch[0]);
        title = content.title || null;
        description = content.description || content.desc || null;
        
        console.log('✅ JSON parseado:');
        console.log(`   Título: ${title}`);
        console.log(`   Descrição: ${description}`);
      } catch (parseError) {
        console.error('❌ Erro ao fazer parse do JSON:', parseError);
        console.error('JSON encontrado:', jsonMatch[0].substring(0, 200));
      }
    }
    
    // Se não conseguiu parsear, tentar extrair manualmente
    if (!title) {
      const titleMatch = response.match(/["']title["']\s*:\s*["']([^"']+)["']/i);
      if (titleMatch) {
        title = titleMatch[1];
      }
    }
    
    if (!description || description.trim() === '#shorts') {
      if (title) {
        description = `${title}\n\n#shorts #viral #youtube #trending`;
      } else {
        description = '#shorts #viral #youtube #trending';
      }
    }
    
    res.json({
      success: true,
      title: title || 'Título não gerado',
      description: description || 'Descrição não gerada',
      rawResponse: response // Incluir resposta bruta para debug
    });
  } catch (error) {
    console.error('❌ Erro no teste:', error);
    res.json({ 
      success: false, 
      error: error.message, 
      stack: error.stack 
    });
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

// ===== ROTAS DE TESTE DE PAGAMENTO =====

// Página de teste de pagamento
router.get('/payment', (req, res) => {
  res.render('test-payment');
});

// Verificar configuração do Asaas
router.get('/payment/check', (req, res) => {
  try {
    const asaasService = require('../services/asaas-service');
    const configured = asaasService.isConfigured();
    
    res.json({
      configured: configured,
      apiKeyConfigured: !!process.env.ASAAS_API_KEY,
      environment: process.env.ASAAS_ENVIRONMENT || 'sandbox',
      baseURL: configured ? asaasService.baseURL : null
    });
  } catch (error) {
    res.status(500).json({
      configured: false,
      error: error.message
    });
  }
});

// Criar cliente de teste
router.post('/payment/create-customer', async (req, res) => {
  try {
    const asaasService = require('../services/asaas-service');
    
    if (!asaasService.isConfigured()) {
      return res.json({ success: false, error: 'Asaas não configurado' });
    }
    
    const result = await asaasService.createCustomer(req.body);
    
    if (result.success) {
      res.json({
        success: true,
        customerId: result.data.id,
        data: result.data
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Criar pagamento de teste
router.post('/payment/create-payment', async (req, res) => {
  try {
    const asaasService = require('../services/asaas-service');
    
    if (!asaasService.isConfigured()) {
      return res.json({ success: false, error: 'Asaas não configurado' });
    }
    
    const { customerId, value } = req.body;
    
    // Calcular data de vencimento (3 dias)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split('T')[0];
    
    const result = await asaasService.createPayment({
      customerId: customerId,
      billingType: 'PIX',
      value: value,
      dueDate: dueDateStr,
      description: `Pagamento de Teste - ${new Date().toLocaleString('pt-BR')}`,
      externalReference: `test_${Date.now()}`
    });
    
    if (result.success) {
      res.json({
        success: true,
        paymentId: result.data.id,
        data: result.data
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

// Buscar QR Code PIX
router.get('/payment/get-qrcode/:paymentId', async (req, res) => {
  try {
    const asaasService = require('../services/asaas-service');
    
    if (!asaasService.isConfigured()) {
      return res.json({ success: false, error: 'Asaas não configurado' });
    }
    
    const { paymentId } = req.params;
    const result = await asaasService.getPixQrCode(paymentId);
    
    if (result.success) {
      res.json({
        success: true,
        qrCode: result.data.encodedImage,
        copyPaste: result.data.payload,
        data: result.data
      });
    } else {
      res.json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
