const express = require('express');
const path = require('path');
const fs = require('fs-extra');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { configs, schedules } = require('../database');

const USER_CONFIGS_DIR = path.join(__dirname, '../user_configs');

// Dashboard do usuário
router.get('/dashboard', async (req, res) => {
  // O middleware requireAuth já garante que req.user existe
  const userId = req.user.id;
  console.log('📊 Dashboard acessado por:', req.user.username, 'ID:', userId);
  
  // Buscar estatísticas (assíncrono no PostgreSQL)
  const { schedules, published } = require('../database');
  let userSchedules, userPublished;
  
  try {
    if (schedules.findByUserId.constructor.name === 'AsyncFunction') {
      userSchedules = await schedules.findByUserId(userId);
    } else {
      userSchedules = await Promise.resolve(schedules.findByUserId(userId));
    }
  } catch (err) {
    userSchedules = schedules.findByUserId(userId);
  }
  
  try {
    if (published.findByUserId.constructor.name === 'AsyncFunction') {
      userPublished = await published.findByUserId(userId);
    } else {
      userPublished = await Promise.resolve(published.findByUserId(userId));
    }
  } catch (err) {
    userPublished = published.findByUserId(userId);
  }
  
  // Calcular estatísticas
  const totalPublished = userPublished.length;
  const totalScheduled = userSchedules.length;
  const pendingScheduled = userSchedules.filter(s => s.status === 'pending').length;
  
  // Publicados hoje
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const publishedToday = userPublished.filter(v => {
    const publishedDate = new Date(v.published_at);
    publishedDate.setHours(0, 0, 0, 0);
    return publishedDate.getTime() === today.getTime();
  }).length;

  // Verificar se tem fatura pendente
  const { invoices } = require('../database');
  let pendingInvoice = null;
  try {
    let userInvoices;
    if (invoices && invoices.findByUserId) {
      const isAsync = invoices.findByUserId.constructor && invoices.findByUserId.constructor.name === 'AsyncFunction';
      if (isAsync) {
        userInvoices = await invoices.findByUserId(userId);
      } else {
        userInvoices = invoices.findByUserId(userId);
      }
    }
    
    if (userInvoices && Array.isArray(userInvoices)) {
      pendingInvoice = userInvoices.find(inv => inv.status === 'pending');
    }
  } catch (err) {
    console.error('Erro ao buscar faturas no dashboard:', err);
  }

  res.render('user/dashboard', {
    token: req.token || req.query.token,
    user: req.user,
    stats: {
      totalPublished,
      totalScheduled,
      pendingScheduled,
      publishedToday
    },
    pendingInvoice: pendingInvoice,
    query: req.query
  });
});

// Página de vincular contas
router.get('/accounts', async (req, res) => {
  const userId = req.user.id;
  
  // Buscar configuração do banco (pode ser async no PostgreSQL)
  let dbConfig;
  try {
    if (configs.findByUserId.constructor.name === 'AsyncFunction') {
      dbConfig = await configs.findByUserId(userId);
    } else {
      dbConfig = configs.findByUserId(userId);
    }
  } catch (err) {
    dbConfig = configs.findByUserId(userId);
  }
  
  let userConfig = null;
  if (dbConfig) {
    // Verificar se o arquivo realmente existe
    const fileExists = dbConfig.config_path ? fs.existsSync(dbConfig.config_path) : false;
    
    userConfig = {
      configPath: dbConfig.config_path,
      uploadedAt: dbConfig.uploaded_at,
      channelId: dbConfig.channel_id,
      channelName: dbConfig.channel_name,
      isAuthenticated: dbConfig.is_authenticated === 1,
      authenticatedAt: dbConfig.authenticated_at,
      fileExists: fileExists
    };
  }

  res.render('user/accounts', {
    user: req.user,
    hasConfig: !!userConfig,
    config: userConfig,
    query: req.query,
    token: req.token || req.query.token
  });
});

// Upload de configuração do YouTube
router.post('/upload-config', async (req, res) => {
  if (!req.files || !req.files.configFile) {
    return res.json({ success: false, error: 'Nenhum arquivo enviado' });
  }

  const userId = req.user.id;
  const configFile = req.files.configFile;
  const userConfigDir = path.join(USER_CONFIGS_DIR, `user_${userId}`);
  const userConfigPath = path.join(userConfigDir, 'client_secrets.json');

  try {
    // Criar diretório do usuário
    fs.ensureDirSync(userConfigDir);

    // Validar se é um JSON válido
    try {
      const fileContent = configFile.data.toString('utf8');
      JSON.parse(fileContent);
    } catch (parseError) {
      return res.json({ success: false, error: 'Arquivo JSON inválido. Verifique o formato do arquivo.' });
    }

    // Salvar arquivo (substitui o anterior se existir)
    await configFile.mv(userConfigPath);

    // Salvar no banco de dados
    configs.upsert(userId, userConfigPath);

    res.json({ 
      success: true, 
      message: 'Configuração atualizada com sucesso! Agora você pode autenticar seu canal.' 
    });
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    res.json({ success: false, error: 'Erro ao fazer upload do arquivo: ' + error.message });
  }
});

// Autenticar canal do YouTube
router.post('/authenticate', async (req, res) => {
  const userId = req.user.id;

  try {
    // Buscar configuração (pode ser async no PostgreSQL)
    let dbConfig;
    try {
      if (configs.findByUserId.constructor.name === 'AsyncFunction') {
        dbConfig = await configs.findByUserId(userId);
      } else {
        dbConfig = configs.findByUserId(userId);
      }
    } catch (err) {
      dbConfig = configs.findByUserId(userId);
    }
    
    if (!dbConfig || !dbConfig.config_path) {
      return res.json({ success: false, error: 'Configure primeiro seu arquivo de credenciais' });
    }

    // Verificar se o arquivo existe
    if (!fs.existsSync(dbConfig.config_path)) {
      console.error('❌ Arquivo de credenciais não encontrado no caminho:', dbConfig.config_path);
      return res.json({ 
        success: false, 
        error: 'Arquivo de credenciais não encontrado. Por favor, faça upload novamente do arquivo client_secrets.json' 
      });
    }

    const { authenticateYouTube } = require('../services/youtube-auth');
    // Passar req para obter headers (host, protocol) em produção
    const authResult = await authenticateYouTube(userId, dbConfig.config_path, req);
    
    if (authResult.success) {
      // Atualizar no banco (pode ser async no PostgreSQL)
      try {
        if (configs.updateAuth.constructor.name === 'AsyncFunction') {
          await configs.updateAuth(
            userId,
            true,
            authResult.channelId,
            authResult.channelName,
            authResult.refreshToken || dbConfig.refresh_token,
            authResult.accessToken || dbConfig.access_token
          );
        } else {
          configs.updateAuth(
            userId,
            true,
            authResult.channelId,
            authResult.channelName,
            authResult.refreshToken || dbConfig.refresh_token,
            authResult.accessToken || dbConfig.access_token
          );
        }
        console.log('✅ Autenticação salva no banco com sucesso!');
      } catch (updateError) {
        console.error('❌ Erro ao salvar no banco:', updateError);
        return res.json({ success: false, error: 'Erro ao salvar autenticação: ' + updateError.message });
      }

      res.json({ 
        success: true, 
        message: 'Canal autenticado com sucesso!',
        channelName: authResult.channelName
      });
    } else if (authResult.needsAuth && authResult.authUrl) {
      // Precisa autenticar - redirecionar para OAuth
      console.log('🔗 Redirecionando para autenticação OAuth');
      console.log('🔗 Redirect URI:', authResult.redirectUri);
      res.json({ 
        success: false, 
        needsAuth: true,
        authUrl: authResult.authUrl,
        redirectUri: authResult.redirectUri,
        message: `IMPORTANTE: Configure o redirect_uri "${authResult.redirectUri}" no Google Cloud Console antes de autenticar!`
      });
    } else {
      console.error('❌ Erro na autenticação:', authResult.error);
      res.json({ 
        success: false, 
        error: authResult.error || 'Erro ao autenticar. Verifique o console do servidor para mais detalhes.' 
      });
    }
  } catch (error) {
    console.error('❌ Erro na autenticação:', error);
    res.json({ success: false, error: 'Erro ao autenticar canal: ' + error.message });
  }
});

// Callback do OAuth (GET) - Google redireciona aqui após autenticação
router.get('/auth/callback', async (req, res) => {
  const { code, error } = req.query;
  const userId = req.user.id;

  if (error) {
    console.error('❌ Erro no OAuth:', error);
    return res.redirect(`/user/dashboard?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/user/dashboard?error=no_code');
  }

  try {
    // Buscar configuração (pode ser async no PostgreSQL)
    let dbConfig;
    try {
      if (configs.findByUserId.constructor.name === 'AsyncFunction') {
        dbConfig = await configs.findByUserId(userId);
      } else {
        dbConfig = configs.findByUserId(userId);
      }
    } catch (err) {
      dbConfig = configs.findByUserId(userId);
    }
    
    if (!dbConfig || !dbConfig.config_path) {
      return res.redirect('/user/dashboard?error=config_not_found');
    }
    
    // Verificar se o arquivo existe
    if (!fs.existsSync(dbConfig.config_path)) {
      console.error('❌ Arquivo de credenciais não encontrado no callback:', dbConfig.config_path);
      return res.redirect('/user/accounts?error=file_not_found');
    }

    const { handleAuthCallback } = require('../services/youtube-auth');
    const result = await handleAuthCallback(userId, code);

    if (result.success) {
      console.log('✅ Autenticação bem-sucedida! Canal:', result.channelName);
      console.log('📝 Salvando no banco de dados...');
      
      // Atualizar no banco (pode ser async no PostgreSQL)
      try {
        if (configs.updateAuth.constructor.name === 'AsyncFunction') {
          await configs.updateAuth(
            userId,
            true,
            result.channelId,
            result.channelName,
            result.refreshToken,
            result.accessToken
          );
        } else {
          configs.updateAuth(
            userId,
            true,
            result.channelId,
            result.channelName,
            result.refreshToken,
            result.accessToken
          );
        }
        console.log('✅ Dados salvos no banco com sucesso!');
      } catch (updateError) {
        console.error('❌ Erro ao salvar no banco:', updateError);
        return res.redirect('/user/accounts?error=' + encodeURIComponent('Erro ao salvar autenticação: ' + updateError.message));
      }
      
      // Redirecionar para a página de contas para mostrar o status atualizado
      res.redirect('/user/accounts?success=authenticated');
    } else {
      console.error('❌ Erro na autenticação:', result.error);
      res.redirect('/user/accounts?error=' + encodeURIComponent(result.error || 'Erro ao autenticar'));
    }
  } catch (error) {
    console.error('❌ Erro no callback:', error);
    res.redirect('/user/dashboard?error=' + encodeURIComponent(error.message || 'Erro no callback'));
  }
});

// Upload de vídeo
router.post('/upload-video', async (req, res) => {
  if (!req.files || !req.files.video) {
    return res.json({ success: false, error: 'Nenhum vídeo enviado' });
  }

  const userId = req.user.id;
  const video = req.files.video;
  const videosDir = path.join(__dirname, '../videos', `user_${userId}`);

  try {
    fs.ensureDirSync(videosDir);
    
    // Usar nome único para evitar conflitos
    const timestamp = Date.now();
    const originalName = video.name;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const uniqueName = `${baseName}_${timestamp}${ext}`;
    
    const videoPath = path.join(videosDir, uniqueName);
    await video.mv(videoPath);

    console.log('✅ Vídeo enviado:', videoPath);

    res.json({ 
      success: true, 
      message: 'Vídeo enviado com sucesso!',
      videoPath: videoPath,
      originalName: originalName
    });
  } catch (error) {
    console.error('Erro ao fazer upload do vídeo:', error);
    res.json({ success: false, error: 'Erro ao fazer upload do vídeo: ' + error.message });
  }
});

// Rota alternativa para upload (compatibilidade)
router.post('/videos/upload', async (req, res) => {
  if (!req.files || !req.files.video) {
    return res.json({ success: false, error: 'Nenhum vídeo enviado' });
  }

  const userId = req.user.id;
  const video = req.files.video;
  const videosDir = path.join(__dirname, '../videos', `user_${userId}`);

  try {
    fs.ensureDirSync(videosDir);
    
    // Usar nome único para evitar conflitos
    const timestamp = Date.now();
    const originalName = video.name;
    const ext = path.extname(originalName);
    const baseName = path.basename(originalName, ext);
    const uniqueName = `${baseName}_${timestamp}${ext}`;
    
    const videoPath = path.join(videosDir, uniqueName);
    await video.mv(videoPath);

    console.log('✅ Vídeo enviado:', videoPath);

    res.json({ 
      success: true, 
      message: 'Vídeo enviado com sucesso!',
      videoPath: videoPath,
      originalName: originalName
    });
  } catch (error) {
    console.error('Erro ao fazer upload do vídeo:', error);
    res.json({ success: false, error: 'Erro ao fazer upload do vídeo: ' + error.message });
  }
});

// Página de gerenciamento de vídeos
// Rota de teste para Gemini
router.get('/test-gemini', (req, res) => {
  res.render('test-gemini');
});

router.get('/videos', async (req, res) => {
  const userId = req.user.id;
  
  // Verificar se o usuário tem plano ativo
  if (req.user.payment_status !== 'paid' && req.user.role !== 'admin') {
    // Buscar planos disponíveis para mostrar na tela de bloqueio
    const { plans: planDB } = require('../database');
    let allPlans = [];
    try {
      if (planDB.findAll.constructor.name === 'AsyncFunction') {
        allPlans = await planDB.findAll();
      } else {
        allPlans = planDB.findAll();
      }
    } catch (err) {
      allPlans = planDB.findAll();
    }
    
    return res.render('user/videos-locked', {
      user: req.user,
      plans: allPlans,
      token: req.token || req.query.token
    });
  }
  
  const dbConfig = configs.findByUserId(userId);
  
  res.render('user/videos', {
    user: req.user,
    defaultFolder: dbConfig?.default_video_folder || null,
    token: req.token || req.query.token
  });
});

// API: Salvar pasta padrão
router.post('/videos/save-folder', async (req, res) => {
  try {
    const { folderPath } = req.body;
    const userId = req.user.id;
    
    console.log('💾 Salvando pasta padrão:', folderPath, 'para usuário:', userId);
    
    // Permitir salvar mesmo se folderPath for vazio (para limpar)
    configs.updateDefaultFolder(userId, folderPath || '');
    
    console.log('✅ Pasta salva com sucesso');
    res.json({ success: true, message: folderPath ? 'Pasta salva como padrão' : 'Pasta padrão removida' });
  } catch (error) {
    console.error('❌ Erro ao salvar pasta:', error);
    res.json({ success: false, error: error.message });
  }
});

// API: Escanear pasta e listar vídeos
router.post('/videos/scan', async (req, res) => {
  try {
    let { folderPath } = req.body;
    const userId = req.user.id;
    
    if (!folderPath) {
      return res.json({ success: false, error: 'Caminho da pasta não fornecido' });
    }
    
    // Limpar e normalizar o caminho
    folderPath = folderPath.trim();
    
    // Verificar se a pasta existe
    if (!fs.existsSync(folderPath)) {
      console.error('❌ Pasta não encontrada:', folderPath);
      return res.json({ success: false, error: `Pasta não encontrada: ${folderPath}` });
    }
    
    // Verificar se é realmente uma pasta
    const stat = fs.statSync(folderPath);
    if (!stat.isDirectory()) {
      return res.json({ success: false, error: 'O caminho especificado não é uma pasta' });
    }

    // Buscar vídeos já publicados (pode ser async no PostgreSQL)
    const { published } = require('../database');
    let publishedVideos = [];
    try {
      if (published.findByUserId.constructor.name === 'AsyncFunction') {
        publishedVideos = await published.findByUserId(userId);
      } else {
        publishedVideos = published.findByUserId(userId);
      }
    } catch (err) {
      publishedVideos = published.findByUserId(userId);
    }
    
    // Criar um Set com os caminhos dos vídeos já publicados (normalizado)
    const publishedPaths = new Set();
    publishedVideos.forEach(pv => {
      if (pv.video_path) {
        // Normalizar caminho para comparação (remover diferenças de barra)
        const normalized = pv.video_path.replace(/\\/g, '/').toLowerCase();
        publishedPaths.add(normalized);
        // Também adicionar apenas o nome do arquivo (caso o caminho seja diferente)
        const fileName = path.basename(pv.video_path).toLowerCase();
        publishedPaths.add(fileName);
      }
    });
    
    console.log(`📊 Total de vídeos já publicados: ${publishedVideos.length}`);
    console.log(`📊 Caminhos normalizados para filtrar: ${publishedPaths.size}`);

    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];
    const videos = [];

    const files = fs.readdirSync(folderPath);
    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isFile()) {
        const ext = path.extname(file).toLowerCase();
        if (videoExtensions.includes(ext)) {
          // Normalizar caminho para comparação
          const normalizedPath = filePath.replace(/\\/g, '/').toLowerCase();
          const normalizedFileName = file.toLowerCase();
          
          // Verificar se já foi publicado
          const isPublished = publishedPaths.has(normalizedPath) || publishedPaths.has(normalizedFileName);
          
          if (!isPublished) {
            videos.push({
              name: file,
              path: filePath,
              size: stat.size,
              sizeMB: (stat.size / (1024 * 1024)).toFixed(2)
            });
          } else {
            console.log(`⏭️  Vídeo já publicado, ignorando: ${file}`);
          }
        }
      }
    }

    console.log(`✅ Vídeos encontrados: ${videos.length} (${files.length - videos.length} já publicados foram filtrados)`);
    res.json({ success: true, videos });
  } catch (error) {
    console.error('Erro ao escanear pasta:', error);
    res.json({ success: false, error: error.message });
  }
});

// API: Gerar conteúdo com IA
router.post('/videos/generate', async (req, res) => {
  // Timeout de 10 minutos (Render pode ter timeout menor, então vamos processar rápido)
  req.setTimeout(600000); // 10 minutos
    
  // Configurar headers para evitar timeout do Render
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=600');
  
  try {
    let { videoPath } = req.body;
    
    console.log(`📥 Recebido pedido para gerar conteúdo: ${videoPath}`);
    console.log(`⏱️  Timeout configurado: 5 minutos`);
    
    if (!videoPath) {
      return res.json({ success: false, error: 'Caminho do vídeo não fornecido' });
    }
    
    // Normalizar caminho (Windows)
    let normalizedPath = videoPath.replace(/\\/g, path.sep).trim();
    
    // Se o caminho é relativo (começa com "videos/" ou não tem barra inicial), tentar resolver
    if (!path.isAbsolute(normalizedPath)) {
      console.log('⚠️  Caminho relativo detectado, tentando resolver...');
      
      // Se começa com "videos/", remover esse prefixo e tentar encontrar
      if (normalizedPath.startsWith('videos/')) {
        normalizedPath = normalizedPath.replace(/^videos\//, '');
      }
      
      // Tentar encontrar o arquivo na pasta padrão do usuário
      const userId = req.user.id;
      let dbConfig;
      try {
        if (configs.findByUserId.constructor.name === 'AsyncFunction') {
          dbConfig = await configs.findByUserId(userId);
        } else {
          dbConfig = configs.findByUserId(userId);
        }
      } catch (err) {
        dbConfig = configs.findByUserId(userId);
      }
      
      if (dbConfig && dbConfig.default_video_folder) {
        console.log('📁 Pasta padrão encontrada:', dbConfig.default_video_folder);
        
        // Tentar construir caminho absoluto a partir da pasta padrão
        // Primeiro, tentar com o caminho completo (pode ter subpastas)
        const possiblePath = path.join(dbConfig.default_video_folder, normalizedPath);
        if (fs.existsSync(possiblePath)) {
          normalizedPath = possiblePath;
          console.log('✅ Caminho resolvido usando pasta padrão + caminho completo:', normalizedPath);
        } else {
          // Tentar apenas o nome do arquivo na pasta padrão
          const fileName = path.basename(normalizedPath);
          const possiblePath2 = path.join(dbConfig.default_video_folder, fileName);
          if (fs.existsSync(possiblePath2)) {
            normalizedPath = possiblePath2;
            console.log('✅ Caminho resolvido usando pasta padrão + nome do arquivo:', normalizedPath);
          } else {
            console.warn('⚠️  Arquivo não encontrado nem com caminho completo nem apenas nome');
          }
        }
      } else {
        console.warn('⚠️  Nenhuma pasta padrão configurada para o usuário');
      }
    }
    
    // Se ainda não existe, verificar se é uma pasta e procurar vídeos
    if (!fs.existsSync(normalizedPath)) {
      console.warn(`⚠️  Caminho não encontrado: ${normalizedPath}`);
      console.warn(`🔍 Tentando encontrar arquivo pelo nome...`);
      
      // Última tentativa: procurar pelo nome do arquivo na pasta padrão
      const userId2 = req.user.id;
      let dbConfig2;
      try {
        if (configs.findByUserId.constructor.name === 'AsyncFunction') {
          dbConfig2 = await configs.findByUserId(userId2);
        } else {
          dbConfig2 = configs.findByUserId(userId2);
        }
      } catch (err) {
        dbConfig2 = configs.findByUserId(userId2);
      }
      
      if (dbConfig2 && dbConfig2.default_video_folder) {
        const fileName = path.basename(normalizedPath);
        const searchPath = path.join(dbConfig2.default_video_folder, fileName);
        if (fs.existsSync(searchPath)) {
          normalizedPath = searchPath;
          console.log('✅ Arquivo encontrado pelo nome:', normalizedPath);
        } else {
          return res.json({ success: false, error: `Caminho não encontrado: ${videoPath}. Verifique se o arquivo existe na pasta: ${dbConfig2.default_video_folder}` });
        }
      } else {
        return res.json({ success: false, error: `Caminho não encontrado: ${normalizedPath}. Configure uma pasta padrão em "Selecionar Pasta".` });
      }
    }

    // Verificar se é uma pasta ou arquivo
    const stat = fs.statSync(normalizedPath);
    
    if (stat.isDirectory()) {
      // É uma pasta, procurar primeiro vídeo
      console.log(`📁 É uma pasta, procurando vídeos...`);
      const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];
      const files = fs.readdirSync(normalizedPath);
      
      let videoFile = null;
      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (videoExtensions.includes(ext)) {
          videoFile = path.join(normalizedPath, file);
          break;
        }
      }
      
      if (!videoFile) {
        return res.json({ success: false, error: `Nenhum vídeo encontrado na pasta: ${normalizedPath}` });
      }
      
      normalizedPath = videoFile;
      console.log(`✅ Vídeo encontrado na pasta: ${normalizedPath}`);
    } else if (!stat.isFile()) {
      return res.json({ success: false, error: `O caminho não é um arquivo nem uma pasta: ${normalizedPath}` });
    }

    // Verificar extensão do arquivo
    const ext = path.extname(normalizedPath).toLowerCase();
    const videoExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm', '.flv', '.wmv'];
    if (!videoExtensions.includes(ext)) {
      return res.json({ success: false, error: `Arquivo não é um vídeo válido: ${ext}` });
    }

    console.log(`✅ Vídeo encontrado: ${normalizedPath}`);
    
        const { generateContentWithGemini } = require('../services/gemini-service');
        const videoName = path.basename(normalizedPath);
        
        console.log(`\n🎬 ===== INICIANDO GERAÇÃO DE CONTEÚDO =====`);
        console.log(`📹 Vídeo: ${videoName}`);
        console.log(`📁 Caminho: ${normalizedPath}`);
        
        const content = await generateContentWithGemini(normalizedPath, videoName);

        console.log(`\n✅ ===== CONTEÚDO GERADO =====`);
        console.log(`✅ Título recebido: ${content.title || 'N/A'}`);
        console.log(`✅ Descrição recebida: ${content.description || 'N/A'}`);
        console.log(`📸 Thumbnail path recebido (raw): ${content.thumbnail_path || 'N/A'}`);
        console.log(`📸 Thumbnail path tipo: ${typeof content.thumbnail_path}`);
        console.log(`📸 Thumbnail path existe? ${content.thumbnail_path ? fs.existsSync(content.thumbnail_path) : 'N/A'}`);
        
        // Validar se título e descrição foram gerados
        if (!content.title || content.title.trim().length === 0) {
          console.error('❌ ERRO: Título não foi gerado!');
          return res.json({ success: false, error: 'Erro ao gerar título. Tente novamente.' });
        }
        
        if (!content.description || content.description.trim().length === 0) {
          console.warn('⚠️  Descrição não foi gerada, usando padrão...');
          content.description = '#shorts';
        }
    
    // Converter caminho absoluto para caminho relativo da web
    let thumbnailUrl = null;
    if (content.thumbnail_path) {
      try {
        // Extrair apenas o nome do arquivo do caminho
        const thumbnailFileName = path.basename(content.thumbnail_path);
        console.log(`📸 Nome do arquivo extraído: ${thumbnailFileName}`);
        
        // Verificar se o arquivo realmente existe na pasta thumbnails
        const thumbnailsDir = path.join(__dirname, '../thumbnails');
        const fullThumbnailPath = path.join(thumbnailsDir, thumbnailFileName);
        console.log(`📸 Caminho completo verificado: ${fullThumbnailPath}`);
        console.log(`📸 Arquivo existe na pasta thumbnails? ${fs.existsSync(fullThumbnailPath)}`);
        
        // Se o arquivo existe na pasta thumbnails, criar URL relativa
        if (fs.existsSync(fullThumbnailPath)) {
          // Express.static lida com espaços automaticamente, mas vamos codificar para garantir
          // Usar encodeURIComponent para caracteres especiais (espaços, etc)
          const encodedFileName = encodeURIComponent(thumbnailFileName);
          thumbnailUrl = `/thumbnails/${encodedFileName}`;
          console.log(`📸 Thumbnail URL para web: ${thumbnailUrl}`);
          console.log(`📸 Nome original: ${thumbnailFileName}`);
          console.log(`📸 Nome codificado: ${encodedFileName}`);
        } else {
          // Se não existe na pasta thumbnails, mas existe no caminho original, copiar
          if (fs.existsSync(content.thumbnail_path)) {
            console.log(`📸 Arquivo existe no caminho original, copiando para pasta thumbnails...`);
            try {
              fs.copyFileSync(content.thumbnail_path, fullThumbnailPath);
              console.log(`✅ Arquivo copiado para pasta thumbnails!`);
              const encodedFileName = encodeURIComponent(thumbnailFileName);
              thumbnailUrl = `/thumbnails/${encodedFileName}`;
              console.log(`📸 Thumbnail URL para web: ${thumbnailUrl}`);
            } catch (copyError) {
              console.error(`❌ Erro ao copiar arquivo: ${copyError.message}`);
            }
          } else {
            console.warn(`⚠️  Arquivo não encontrado nem no caminho original nem na pasta thumbnails`);
            console.warn(`   Caminho original: ${content.thumbnail_path}`);
            console.warn(`   Caminho thumbnails: ${fullThumbnailPath}`);
          }
        }
      } catch (conversionError) {
        console.error(`❌ Erro ao converter thumbnail path: ${conversionError.message}`);
        console.error(`   Stack: ${conversionError.stack}`);
      }
    } else {
      console.warn(`⚠️  content.thumbnail_path é null ou undefined`);
    }
    
    console.log(`📸 Thumbnail URL final para retornar: ${thumbnailUrl}`);
    
    // Retornar no mesmo formato do bot antigo
    res.json({ 
      success: true, 
      title: content.title,
      description: content.description,
      thumbnail_path: thumbnailUrl || null  // URL relativa para a web
    });
  } catch (error) {
    console.error('❌ Erro ao gerar conteúdo:', error);
    res.json({ success: false, error: error.message });
  }
});

// API: Publicar vídeo agora
router.post('/videos/publish', async (req, res) => {
  try {
    const { videoPath, title, description, thumbnail_path } = req.body;
    const userId = req.user.id;

    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.json({ success: false, error: 'Vídeo não encontrado' });
    }

    if (!title) {
      return res.json({ success: false, error: 'Título é obrigatório' });
    }

    // Converter URL relativa para caminho absoluto do thumbnail
    let thumbnailAbsolutePath = null;
    if (thumbnail_path) {
      // Se for URL relativa (/thumbnails/nome.jpg), converter para caminho absoluto
      if (thumbnail_path.startsWith('/thumbnails/')) {
        const thumbnailFileName = decodeURIComponent(thumbnail_path.replace('/thumbnails/', ''));
        const thumbnailsDir = path.join(__dirname, '../thumbnails');
        thumbnailAbsolutePath = path.join(thumbnailsDir, thumbnailFileName);
        
        if (!fs.existsSync(thumbnailAbsolutePath)) {
          console.warn(`⚠️  Thumbnail não encontrado: ${thumbnailAbsolutePath}`);
          thumbnailAbsolutePath = null;
        } else {
          console.log(`✅ Thumbnail encontrado: ${thumbnailAbsolutePath}`);
        }
      } else if (fs.existsSync(thumbnail_path)) {
        // Se já for caminho absoluto
        thumbnailAbsolutePath = thumbnail_path;
      }
    }

    const { uploadVideoToYouTube } = require('../services/youtube-uploader');
    const result = await uploadVideoToYouTube(
      userId, 
      videoPath, 
      title, 
      description || '#shorts',
      thumbnailAbsolutePath  // Passar caminho do thumbnail
    );

    if (result.success) {
      // Salvar no banco de vídeos publicados
      const { published } = require('../database');
      published.create(userId, videoPath, result.videoId, result.videoUrl, title, description || '#shorts', thumbnailAbsolutePath);

      res.json({ 
        success: true, 
        message: 'Vídeo publicado com sucesso!',
        videoId: result.videoId,
        videoUrl: result.videoUrl
      });
    } else {
      res.json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error('Erro ao publicar vídeo:', error);
    res.json({ success: false, error: error.message });
  }
});

// API: Agendar vídeo
router.post('/videos/schedule', async (req, res) => {
  try {
    const { videoPath, scheduledTime, title, description, thumbnailPath } = req.body;
    const userId = req.user.id;

    if (!videoPath || !fs.existsSync(videoPath)) {
      return res.json({ success: false, error: 'Vídeo não encontrado' });
    }

    if (!scheduledTime) {
      return res.json({ success: false, error: 'Data/hora de agendamento é obrigatória' });
    }

    if (!title) {
      return res.json({ success: false, error: 'Título é obrigatório' });
    }

    // Mover vídeo para pasta scheduled
    const scheduledDir = path.join(__dirname, '../scheduled', `user_${userId}`);
    fs.ensureDirSync(scheduledDir);
    const scheduledVideoPath = path.join(scheduledDir, path.basename(videoPath));
    
    // Copiar vídeo (não mover, pois pode estar na pasta original do usuário)
    await fs.copy(videoPath, scheduledVideoPath);

    let scheduleId;
    try {
      if (schedules.create.constructor.name === 'AsyncFunction') {
        scheduleId = await schedules.create(userId, scheduledVideoPath, scheduledTime, title, description || '#shorts', thumbnailPath);
      } else {
        scheduleId = schedules.create(userId, scheduledVideoPath, scheduledTime, title, description || '#shorts', thumbnailPath);
      }
    } catch (err) {
      scheduleId = schedules.create(userId, scheduledVideoPath, scheduledTime, title, description || '#shorts', thumbnailPath);
    }

    res.json({ 
      success: true, 
      message: 'Vídeo agendado com sucesso!',
      scheduleId
    });
  } catch (error) {
    console.error('Erro ao agendar vídeo:', error);
    res.json({ success: false, error: error.message });
  }
});

// API: Agendamento Semanal com IA
router.post('/videos/schedule-weekly', async (req, res) => {
  try {
    const { startDate, schedule, videos } = req.body;
    const userId = req.user.id;

    if (!startDate || !schedule || !videos || videos.length === 0) {
      return res.json({ success: false, error: 'Dados incompletos' });
    }

    // Validar total de vídeos necessários
    const totalNeeded = schedule.reduce((sum, day) => sum + day.qtd, 0);
    if (totalNeeded > videos.length) {
      return res.json({ success: false, error: `Você precisa de ${totalNeeded} vídeos, mas só tem ${videos.length} disponíveis.` });
    }

    if (totalNeeded === 0) {
      return res.json({ success: false, error: 'Nenhum vídeo configurado para agendar' });
    }

    // Validar limite de 4 vídeos por dia
    for (const day of schedule) {
      if (day.qtd > 4) {
        return res.json({ success: false, error: `Máximo de 4 vídeos por dia. ${day.dayName} tem ${day.qtd} vídeos configurados.` });
      }
    }

    const { generateContentWithGemini } = require('../services/gemini-service');
    let videoIndex = 0;
    let scheduledCount = 0;
    const errors = [];

    // Processar cada dia configurado
    for (const dayConfig of schedule) {
      const qtd = dayConfig.qtd;
      const times = dayConfig.times;

      // Usar data exata do dia (já vem calculada do frontend)
      const targetDate = new Date(dayConfig.date || startDate);

      // Agendar cada vídeo do dia
      for (let i = 0; i < qtd && videoIndex < videos.length; i++) {
        const video = videos[videoIndex];
        const time = times[i] || times[0] || '08:00'; // Usar horário configurado ou padrão

        try {
          // NÃO gerar conteúdo com IA agora - será gerado 10 minutos antes do horário
          // Usar título temporário baseado no nome do arquivo
          const tempTitle = video.name.replace(/\.[^/.]+$/, '');
          const tempDescription = '#shorts';

          // Combinar data e hora (usar data exata do diaConfig)
          const [hours, minutes] = time.split(':');
          const scheduledDateTime = new Date(targetDate);
          scheduledDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

          // Verificar se a data não é no passado
          if (scheduledDateTime < new Date()) {
            // Se for no passado, adicionar 7 dias
            scheduledDateTime.setDate(scheduledDateTime.getDate() + 7);
          }

          // Agendar vídeo
          const scheduledDir = path.join(__dirname, '../scheduled', `user_${userId}`);
          fs.ensureDirSync(scheduledDir);
          const scheduledVideoPath = path.join(scheduledDir, path.basename(video.path));
          
          // Copiar vídeo
          if (fs.existsSync(video.path)) {
            await fs.copy(video.path, scheduledVideoPath);
          }

          // Criar agendamento SEM conteúdo gerado (será gerado 10 min antes)
          // title e description serão NULL para indicar que precisa gerar com IA
          let scheduleId;
          try {
            if (schedules.create.constructor.name === 'AsyncFunction') {
              scheduleId = await schedules.create(
                userId, 
                scheduledVideoPath, 
                scheduledDateTime.toISOString(), 
                null, // title será gerado 10 min antes
                null, // description será gerado 10 min antes
                null  // thumbnail será gerado 10 min antes
              );
            } else {
              scheduleId = schedules.create(
                userId, 
                scheduledVideoPath, 
                scheduledDateTime.toISOString(), 
                null,
                null,
                null
              );
            }
          } catch (err) {
            scheduleId = schedules.create(
              userId, 
              scheduledVideoPath, 
              scheduledDateTime.toISOString(), 
              null,
              null,
              null
            );
          }
          
          console.log(`✅ Vídeo agendado: ${video.name} para ${scheduledDateTime.toLocaleString('pt-BR')} (conteúdo será gerado 10 min antes)`);

          scheduledCount++;
          console.log(`✅ Vídeo agendado: ${video.name} para ${scheduledDateTime.toLocaleString('pt-BR')}`);

        } catch (error) {
          console.error(`❌ Erro ao agendar vídeo ${video.name}:`, error);
          errors.push(`${video.name}: ${error.message}`);
        }

        videoIndex++;
      }
    }

    if (scheduledCount === 0) {
      return res.json({ 
        success: false, 
        error: 'Nenhum vídeo foi agendado. Erros: ' + errors.join('; ') 
      });
    }

    res.json({ 
      success: true, 
      message: `${scheduledCount} vídeo(s) agendado(s) com sucesso!`,
      scheduled: scheduledCount,
      errors: errors.length > 0 ? errors : null
    });

  } catch (error) {
    console.error('Erro ao processar agendamento semanal:', error);
    res.json({ success: false, error: 'Erro ao processar agendamento: ' + error.message });
  }
});

// Tela de vídeos agendados
router.get('/scheduled', async (req, res) => {
  try {
    const userId = req.user.id;
    let userSchedules;
    
    try {
      if (schedules.findByUserId.constructor.name === 'AsyncFunction') {
        userSchedules = await schedules.findByUserId(userId);
      } else {
        userSchedules = schedules.findByUserId(userId);
      }
    } catch (err) {
      userSchedules = schedules.findByUserId(userId);
    }
    
    // Garantir que é um array
    if (!Array.isArray(userSchedules)) {
      userSchedules = [];
    }
    
    res.render('user/scheduled', {
      user: req.user,
      schedules: userSchedules,
      token: req.token || req.query.token
    });
  } catch (error) {
    console.error('Erro ao carregar vídeos agendados:', error);
    res.render('user/scheduled', {
      user: req.user,
      schedules: [],
      token: req.token || req.query.token
    });
  }
});

// Tela de vídeos publicados
router.get('/published', async (req, res) => {
  const userId = req.user.id;
  const { published } = require('../database');
  
  // Buscar vídeos publicados (pode ser async no PostgreSQL)
  let userPublished = [];
  try {
    if (published.findByUserId.constructor.name === 'AsyncFunction') {
      userPublished = await published.findByUserId(userId);
    } else {
      userPublished = published.findByUserId(userId);
    }
  } catch (err) {
    userPublished = published.findByUserId(userId);
  }
  
  res.render('user/published', {
    user: req.user,
    videos: userPublished,
    token: req.token || req.query.token
  });
});

// Página de escolher planos
router.get('/plans', async (req, res) => {
  const { plans: planDB } = require('../database');
  
  let allPlans = [];
  try {
    if (planDB.findAll.constructor.name === 'AsyncFunction') {
      allPlans = await planDB.findAll();
    } else {
      allPlans = planDB.findAll();
    }
  } catch (err) {
    allPlans = planDB.findAll();
  }
  
  res.render('user/plans', {
    user: req.user,
    plans: allPlans,
    token: req.token || req.query.token
  });
});

// Página de perfil
router.get('/profile', async (req, res) => {
  const userId = req.user.id;
  const { users, subscriptions, invoices: invoiceDB } = require('../database');
  
  // Buscar dados completos do usuário (pode ser async no PostgreSQL)
  let userData;
  try {
    if (users.findById.constructor.name === 'AsyncFunction') {
      userData = await users.findById(userId);
    } else {
      userData = users.findById(userId);
    }
  } catch (err) {
    userData = users.findById(userId);
  }
  
  // Buscar assinatura ativa
  let subscription = null;
  try {
    if (subscriptions.findByUserId.constructor.name === 'AsyncFunction') {
      subscription = await subscriptions.findByUserId(userId);
    } else {
      subscription = subscriptions.findByUserId(userId);
    }
  } catch (err) {
    subscription = subscriptions.findByUserId(userId);
  }
  
  // Buscar faturas (apenas se não for admin)
  let userInvoices = [];
  if (req.user.role !== 'admin') {
    try {
      if (invoiceDB.findByUserId.constructor.name === 'AsyncFunction') {
        userInvoices = await invoiceDB.findByUserId(userId);
      } else {
        userInvoices = invoiceDB.findByUserId(userId);
      }
    } catch (err) {
      userInvoices = invoiceDB.findByUserId(userId);
    }
  }
  
  // Preparar dados do plano
  let planData = null;
  if (subscription) {
    const nextBilling = subscription.current_period_end 
      ? new Date(subscription.current_period_end).toLocaleDateString('pt-BR')
      : null;
    
    // Mapear billing_period para português
    let billingText = 'mensal'; // padrão
    if (subscription.billing_period) {
      if (subscription.billing_period === 'yearly' || subscription.billing_period === 'annual') {
        billingText = 'anual';
      } else if (subscription.billing_period === 'monthly') {
        billingText = 'mensal';
      }
    }
    
    planData = {
      name: subscription.plan_name || 'Sem Plano',
      price: subscription.price ? `R$ ${parseFloat(subscription.price).toFixed(2)}` : 'R$ 0,00',
      billing: billingText,
      status: subscription.status || 'inactive',
      nextBilling: nextBilling || 'N/A',
      maxVideos: subscription.max_videos,
      maxChannels: subscription.max_channels
    };
  } else {
    planData = {
      name: 'Sem Plano Ativo',
      price: 'R$ 0,00',
      billing: 'mensal',
      status: 'inactive',
      nextBilling: 'N/A'
    };
  }
  
  res.render('user/profile', {
    user: userData || req.user,
    plan: planData,
    invoices: userInvoices,
    isAdmin: req.user.role === 'admin',
    token: req.token || req.query.token
  });
});

// Alterar senha
router.post('/profile/change-password', async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  try {
    if (!currentPassword || !newPassword) {
      return res.json({ success: false, error: 'Preencha todos os campos' });
    }

    if (newPassword.length < 6) {
      return res.json({ success: false, error: 'A senha deve ter no mínimo 6 caracteres' });
    }

    // Buscar usuário
    const { users } = require('../database');
    let user;
    try {
      if (users.findById.constructor.name === 'AsyncFunction') {
        user = await users.findById(userId);
      } else {
        user = users.findById(userId);
      }
    } catch (err) {
      user = users.findById(userId);
    }

    if (!user) {
      return res.json({ success: false, error: 'Usuário não encontrado' });
    }

    // Verificar senha atual
    const bcrypt = require('bcryptjs');
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    
    if (!validPassword) {
      return res.json({ success: false, error: 'Senha atual incorreta' });
    }

    // Atualizar senha
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    let updated;
    try {
      if (users.updatePassword.constructor.name === 'AsyncFunction') {
        updated = await users.updatePassword(userId, hashedPassword);
      } else {
        updated = users.updatePassword(userId, hashedPassword);
      }
    } catch (err) {
      updated = users.updatePassword(userId, hashedPassword);
    }

    if (!updated) {
      return res.json({ success: false, error: 'Erro ao atualizar senha' });
    }

    console.log(`✅ Senha alterada para usuário: ${user.username}`);
    res.json({ success: true, message: 'Senha alterada com sucesso!' });
  } catch (error) {
    console.error('Erro ao alterar senha:', error);
    res.json({ success: false, error: 'Erro ao alterar senha: ' + error.message });
  }
});

// Cancelar assinatura
router.post('/subscription/cancel', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Buscar assinatura ativa do usuário
    const { subscriptions } = require('../database');
    let subscription = null;
    try {
      if (subscriptions.findByUserId.constructor && subscriptions.findByUserId.constructor.name === 'AsyncFunction') {
        subscription = await subscriptions.findByUserId(userId);
      } else {
        subscription = subscriptions.findByUserId(userId);
      }
    } catch (err) {
      subscription = subscriptions.findByUserId(userId);
    }
    
    if (!subscription) {
      return res.json({ success: false, error: 'Nenhuma assinatura ativa encontrada' });
    }
    
    if (subscription.status !== 'active') {
      return res.json({ success: false, error: 'A assinatura já está cancelada ou inativa' });
    }
    
    // Cancelar no Asaas se tiver asaas_subscription_id
    if (subscription.asaas_subscription_id && !subscription.asaas_subscription_id.startsWith('dev_')) {
      const asaasService = require('../services/asaas-service');
      if (asaasService.isConfigured()) {
        try {
          const cancelResult = await asaasService.cancelSubscription(subscription.asaas_subscription_id);
          if (!cancelResult.success) {
            console.warn('⚠️ Erro ao cancelar no Asaas, mas continuando cancelamento local:', cancelResult.error);
          } else {
            console.log('✅ Assinatura cancelada no Asaas');
          }
        } catch (err) {
          console.warn('⚠️ Erro ao cancelar no Asaas, mas continuando cancelamento local:', err.message);
        }
      }
    }
    
    // Atualizar status da assinatura para 'canceled'
    const canceledAt = new Date().toISOString();
    try {
      if (subscriptions.updateStatus.constructor && subscriptions.updateStatus.constructor.name === 'AsyncFunction') {
        await subscriptions.updateStatus(subscription.id, 'canceled');
      } else {
        subscriptions.updateStatus(subscription.id, 'canceled');
      }
    } catch (err) {
      subscriptions.updateStatus(subscription.id, 'canceled');
    }
    
    // Atualizar canceled_at no banco (SQL direto)
    const { db } = require('../database');
    try {
      if (db.prepare) {
        // SQLite
        db.prepare('UPDATE subscriptions SET canceled_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
          .run(canceledAt, subscription.id);
      } else {
        // PostgreSQL
        await db.query('UPDATE subscriptions SET canceled_at = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', 
          [canceledAt, subscription.id]);
      }
    } catch (err) {
      console.error('Erro ao atualizar canceled_at:', err);
    }
    
    // Atualizar payment_status do usuário para 'pending' (não pago)
    const { users } = require('../database');
    try {
      if (users.updatePaymentStatus.constructor && users.updatePaymentStatus.constructor.name === 'AsyncFunction') {
        await users.updatePaymentStatus(userId, 'pending');
      } else {
        users.updatePaymentStatus(userId, 'pending');
      }
    } catch (err) {
      users.updatePaymentStatus(userId, 'pending');
    }
    
    // Atualizar sessão
    if (req.session && req.session.user) {
      req.session.user.payment_status = 'pending';
      req.session.save((err) => {
        if (err) {
          console.error('Erro ao salvar sessão:', err);
        }
      });
    }
    
    console.log(`✅ Assinatura cancelada para usuário: ${req.user.username}`);
    
    res.json({ 
      success: true, 
      message: 'Assinatura cancelada com sucesso! Você ainda terá acesso até o final do período pago.' 
    });
  } catch (error) {
    console.error('Erro ao cancelar assinatura:', error);
    res.json({ success: false, error: 'Erro ao cancelar assinatura: ' + error.message });
  }
});

module.exports = router;

