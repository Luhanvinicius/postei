const { google } = require('googleapis');
const path = require('path');
const fs = require('fs-extra');

async function uploadVideoToYouTube(userId, videoPath, title, description, thumbnailPath = null) {
  try {
    console.log(`\n📤 ===== INICIANDO UPLOAD PARA YOUTUBE =====`);
    console.log(`👤 User ID: ${userId}`);
    console.log(`📹 Vídeo: ${videoPath}`);
    console.log(`📝 Título: ${title}`);
    
    // Carregar configuração do banco (pode ser async no PostgreSQL)
    const { configs } = require('../database');
    let dbConfig;
    try {
      if (configs.findByUserId.constructor.name === 'AsyncFunction') {
        dbConfig = await configs.findByUserId(userId);
        console.log('✅ Configuração carregada (PostgreSQL)');
      } else {
        dbConfig = configs.findByUserId(userId);
        console.log('✅ Configuração carregada (SQLite)');
      }
    } catch (err) {
      dbConfig = configs.findByUserId(userId);
      console.log('✅ Configuração carregada (fallback)');
    }
    
    console.log('🔍 Verificando autenticação...');
    console.log('   dbConfig existe?', !!dbConfig);
    console.log('   is_authenticated?', dbConfig?.is_authenticated);
    console.log('   refresh_token existe?', !!dbConfig?.refresh_token);
    console.log('   channel_name?', dbConfig?.channel_name);
    
    if (!dbConfig) {
      console.error('❌ Configuração do usuário não encontrada no banco de dados');
      return { success: false, error: 'Configuração do YouTube não encontrada. Por favor, faça upload do arquivo client_secrets.json e autentique seu canal na página "Vincular Contas".' };
    }
    
    // Verificar autenticação (PostgreSQL usa 1/0, SQLite também pode usar 1/0 ou true/false)
    const isAuthenticated = dbConfig.is_authenticated === 1 || dbConfig.is_authenticated === true || dbConfig.is_authenticated === '1';
    if (!isAuthenticated) {
      console.error('❌ Canal não está marcado como autenticado no banco');
      console.error('   Valor de is_authenticated:', dbConfig.is_authenticated, 'Tipo:', typeof dbConfig.is_authenticated);
      return { success: false, error: 'Canal não autenticado. Por favor, autentique seu canal na página "Vincular Contas".' };
    }
    
    if (!dbConfig.refresh_token) {
      console.error('❌ Refresh token não encontrado no banco');
      return { success: false, error: 'Token de autenticação não encontrado. Por favor, autentique seu canal novamente na página "Vincular Contas".' };
    }
    
    console.log('✅ Canal autenticado:', dbConfig.channel_name);

    // Verificar se vídeo existe
    if (!fs.existsSync(videoPath)) {
      console.error(`❌ Vídeo não encontrado: ${videoPath}`);
      return { success: false, error: `Vídeo não encontrado: ${videoPath}` };
    }
    
    console.log('✅ Vídeo encontrado');

    // Verificar se arquivo de credenciais existe
    if (!dbConfig.config_path || !fs.existsSync(dbConfig.config_path)) {
      console.error(`❌ Arquivo de credenciais não encontrado: ${dbConfig.config_path}`);
      return { success: false, error: 'Arquivo de credenciais não encontrado. Por favor, faça upload novamente do arquivo client_secrets.json.' };
    }
    
    console.log('✅ Arquivo de credenciais encontrado');

    // Ler credenciais do arquivo do usuário
    const userCredentials = JSON.parse(fs.readFileSync(dbConfig.config_path, 'utf8'));
    console.log('✅ Credenciais lidas do arquivo');
    const clientId = userCredentials.installed?.client_id || userCredentials.web?.client_id;
    const clientSecret = userCredentials.installed?.client_secret || userCredentials.web?.client_secret;

    if (!clientId || !clientSecret) {
      console.error('❌ Credenciais inválidas no arquivo');
      return { success: false, error: 'Credenciais inválidas no arquivo' };
    }
    
    console.log('✅ Client ID e Secret encontrados');

    // Detectar redirect URI (mesma lógica do youtube-auth.js)
    const isProduction = process.env.RENDER || process.env.VERCEL || process.env.NODE_ENV === 'production';
    let redirectUri = process.env.YOUTUBE_REDIRECT_URI;
    
    if (!redirectUri) {
      const isDesktopApp = !!userCredentials.installed;
      const isWebApp = !!userCredentials.web;
      
      if (isDesktopApp) {
        if (isProduction && process.env.BASE_URL) {
          redirectUri = `${process.env.BASE_URL}/user/auth/callback`;
        } else {
          redirectUri = 'http://localhost:3000/user/auth/callback';
        }
      } else if (isWebApp) {
        const redirectUris = userCredentials.web?.redirect_uris || [];
        if (isProduction && process.env.BASE_URL) {
          redirectUri = `${process.env.BASE_URL}/user/auth/callback`;
        } else if (redirectUris.length > 0) {
          redirectUri = redirectUris[0];
          if (redirectUri === 'http://localhost') {
            redirectUri = 'http://localhost:3000/user/auth/callback';
          }
        } else {
          redirectUri = 'http://localhost:3000/user/auth/callback';
        }
      } else {
        redirectUri = isProduction && process.env.BASE_URL 
          ? `${process.env.BASE_URL}/user/auth/callback`
          : 'http://localhost:3000/user/auth/callback';
      }
    }
    
    console.log('🔗 Redirect URI:', redirectUri);
    
    // Configurar OAuth2
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    console.log('🔄 Configurando credenciais OAuth2...');
    oauth2Client.setCredentials({
      refresh_token: dbConfig.refresh_token
    });

    // Obter novo access token
    console.log('🔄 Renovando access token...');
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(credentials);
      console.log('✅ Access token renovado com sucesso');
    } catch (tokenError) {
      console.error('❌ Erro ao renovar access token:', tokenError.message);
      return { 
        success: false, 
        error: 'Erro ao renovar token de autenticação. Por favor, autentique seu canal novamente na página "Vincular Contas".' 
      };
    }

    // Upload do vídeo
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    console.log('📤 Iniciando upload do vídeo...');
    const response = await youtube.videos.insert({
      part: ['snippet', 'status'],
      requestBody: {
        snippet: {
          title: title,
          description: description,
          tags: ['shorts', 'automation'],
          categoryId: '22' // People & Blogs
        },
        status: {
          privacyStatus: 'public',
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream(videoPath)
      }
    });

    const videoId = response.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    console.log(`✅ Vídeo publicado! ID: ${videoId}`);
    
    // Upload do thumbnail se fornecido
    if (thumbnailPath && fs.existsSync(thumbnailPath)) {
      try {
        console.log(`📸 Fazendo upload do thumbnail: ${thumbnailPath}`);
        await youtube.thumbnails.set({
          videoId: videoId,
          media: {
            body: fs.createReadStream(thumbnailPath)
          }
        });
        console.log(`✅ Thumbnail enviado com sucesso!`);
      } catch (thumbnailError) {
        console.error(`⚠️  Erro ao fazer upload do thumbnail: ${thumbnailError.message}`);
        // Não falhar o upload se o thumbnail der erro
      }
    } else if (thumbnailPath) {
      console.warn(`⚠️  Thumbnail não encontrado: ${thumbnailPath}`);
    }
    
    // Mover vídeo para pasta posted
    const postedDir = path.join(__dirname, '../posted', `user_${userId}`);
    fs.ensureDirSync(postedDir);
    const postedPath = path.join(postedDir, path.basename(videoPath));
    
    // Copiar ao invés de mover (pode estar na pasta scheduled)
    if (fs.existsSync(videoPath)) {
      await fs.copy(videoPath, postedPath);
      console.log(`✅ Vídeo copiado para pasta posted: ${postedPath}`);
      
      // Deletar vídeo da pasta videos se estiver lá (não deletar se estiver em scheduled ou posted)
      const videosDir = path.join(__dirname, '../videos');
      const videoInVideosDir = path.join(videosDir, path.basename(videoPath));
      
      // Verificar se o vídeo está na pasta videos (não em scheduled ou posted)
      const isInVideosFolder = videoPath.includes('videos') && !videoPath.includes('scheduled') && !videoPath.includes('posted');
      
      if (isInVideosFolder && fs.existsSync(videoInVideosDir)) {
        try {
          await fs.remove(videoInVideosDir);
          console.log(`🗑️  Vídeo deletado da pasta videos: ${path.basename(videoPath)}`);
        } catch (deleteError) {
          console.warn(`⚠️  Erro ao deletar vídeo da pasta videos: ${deleteError.message}`);
          // Não falhar o upload se não conseguir deletar
        }
      } else if (fs.existsSync(videoInVideosDir) && !videoPath.includes('scheduled') && !videoPath.includes('posted')) {
        // Fallback: se o caminho não contém 'videos' mas o arquivo existe na pasta videos
        try {
          await fs.remove(videoInVideosDir);
          console.log(`🗑️  Vídeo deletado da pasta videos (fallback): ${path.basename(videoPath)}`);
        } catch (deleteError) {
          console.warn(`⚠️  Erro ao deletar vídeo da pasta videos: ${deleteError.message}`);
        }
      }
    }

    return {
      success: true,
      videoId: videoId,
      videoUrl: videoUrl
    };
  } catch (error) {
    console.error('Erro ao fazer upload:', error);
    
    // Mensagens de erro mais amigáveis
    let errorMessage = error.message;
    
    if (error.message.includes('exceeded the number of videos')) {
      errorMessage = 'Limite de uploads excedido! O YouTube limita o número de vídeos que podem ser enviados por dia. Tente novamente amanhã ou verifique sua conta no YouTube.';
    } else if (error.message.includes('quota')) {
      errorMessage = 'Cota da API do YouTube excedida. Aguarde algumas horas ou verifique suas configurações no Google Cloud Console.';
    } else if (error.message.includes('authentication')) {
      errorMessage = 'Erro de autenticação. Por favor, vincule sua conta novamente na página "Vincular Contas".';
    } else if (error.message.includes('not found')) {
      errorMessage = 'Vídeo ou arquivo não encontrado. Verifique se o arquivo ainda existe.';
    }
    
    return { success: false, error: errorMessage };
  }
}

module.exports = {
  uploadVideoToYouTube
};

