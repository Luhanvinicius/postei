const { google } = require('googleapis');
const path = require('path');
const fs = require('fs-extra');

async function uploadVideoToYouTube(userId, videoPath, title, description, thumbnailPath = null) {
  try {
    // Carregar configuração do banco
    const { configs } = require('../database');
    const dbConfig = configs.findByUserId(userId);
    
    if (!dbConfig || !dbConfig.is_authenticated || !dbConfig.refresh_token) {
      return { success: false, error: 'Canal não autenticado' };
    }

    // Verificar se vídeo existe
    if (!fs.existsSync(videoPath)) {
      return { success: false, error: 'Vídeo não encontrado' };
    }

    // Ler credenciais do arquivo do usuário
    const userCredentials = JSON.parse(fs.readFileSync(dbConfig.config_path, 'utf8'));
    const clientId = userCredentials.installed?.client_id || userCredentials.web?.client_id;
    const clientSecret = userCredentials.installed?.client_secret || userCredentials.web?.client_secret;

    if (!clientId || !clientSecret) {
      return { success: false, error: 'Credenciais inválidas no arquivo' };
    }

    const redirectUri = process.env.YOUTUBE_REDIRECT_URI || 'http://localhost:3000/user/auth/callback';
    
    // Configurar OAuth2
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    oauth2Client.setCredentials({
      refresh_token: dbConfig.refresh_token
    });

    // Obter novo access token
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

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

