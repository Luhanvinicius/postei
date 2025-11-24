const { google } = require('googleapis');
const path = require('path');
const fs = require('fs-extra');

async function authenticateYouTube(userId, credentialsPath) {
  try {
    if (!fs.existsSync(credentialsPath)) {
      return { success: false, error: 'Arquivo de credenciais não encontrado' };
    }

    // Ler credenciais do arquivo do usuário
    const userCredentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));
    const clientId = userCredentials.installed?.client_id || userCredentials.web?.client_id;
    const clientSecret = userCredentials.installed?.client_secret || userCredentials.web?.client_secret;

    if (!clientId || !clientSecret) {
      return { success: false, error: 'Credenciais inválidas no arquivo. Verifique se o arquivo contém client_id e client_secret.' };
    }

    // Detectar tipo de aplicação (desktop/installed ou web)
    const isDesktopApp = !!userCredentials.installed;
    const isWebApp = !!userCredentials.web;
    
    // Detectar se está em produção (Render/Vercel) ou local
    const isProduction = process.env.RENDER || process.env.VERCEL || process.env.NODE_ENV === 'production';
    const baseUrl = process.env.BASE_URL || (isProduction ? (process.env.RENDER_EXTERNAL_URL || process.env.VERCEL_URL || '') : 'http://localhost:3000');
    
    let redirectUri = process.env.YOUTUBE_REDIRECT_URI;
    
    if (!redirectUri) {
      if (isDesktopApp) {
        // Para aplicações desktop, usar http://localhost (não precisa configurar no Google Cloud Console)
        // O Google aceita automaticamente http://localhost para desktop apps
        redirectUri = 'http://localhost/user/auth/callback';
        console.log('📱 Detectado: Aplicação Desktop - usando http://localhost');
      } else if (isWebApp) {
        // Para aplicações web, tentar pegar do arquivo ou usar padrão
        const redirectUris = userCredentials.web?.redirect_uris || [];
        if (redirectUris.length > 0) {
          redirectUri = redirectUris[0];
          if (redirectUri === 'http://localhost') {
            redirectUri = 'http://localhost:3000/user/auth/callback';
          }
        } else {
          // Usar URL base do ambiente
          if (isProduction && baseUrl) {
            redirectUri = `${baseUrl}/user/auth/callback`;
          } else {
            redirectUri = 'http://localhost:3000/user/auth/callback';
          }
        }
        console.log('🌐 Detectado: Aplicação Web');
      } else {
        // Fallback: assumir desktop se não detectar
        redirectUri = 'http://localhost/user/auth/callback';
        console.log('⚠️  Tipo não detectado, assumindo Desktop');
      }
    }
    
    console.log('🔗 Ambiente:', isProduction ? 'Produção' : 'Local');
    console.log('🔗 Base URL:', baseUrl);
    console.log('🔗 Redirect URI usado:', redirectUri);
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    // Se já tem refresh token salvo, usar ele (buscar do banco)
    const { configs } = require('../database');
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
    if (dbConfig && dbConfig.refresh_token) {
      oauth2Client.setCredentials({
        refresh_token: dbConfig.refresh_token
      });
      
      // Obter novo access token
      const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
      oauth2Client.setCredentials(newCredentials);
      
      // Obter informações do canal
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      const response = await youtube.channels.list({
        part: 'snippet',
        mine: true
      });
      
      if (response.data.items && response.data.items.length > 0) {
        const channel = response.data.items[0];
        return {
          success: true,
          channelId: channel.id,
          channelName: channel.snippet.title,
          refreshToken: dbConfig.refresh_token,
          accessToken: newCredentials.access_token,
          oauth2Client: oauth2Client
        };
      }
    }

    // Se não tem refresh token, precisa autenticar
    // Usar escopos mais amplos para evitar "Insufficient Permission"
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube',
        'https://www.googleapis.com/auth/youtube.readonly'
      ],
      prompt: 'consent',
      include_granted_scopes: true
    });

    console.log('🔗 URL de autenticação gerada:', authUrl);
    console.log('🔗 Redirect URI usado:', redirectUri);

    return {
      success: false,
      needsAuth: true,
      authUrl: authUrl,
      redirectUri: redirectUri
    };
  } catch (error) {
    console.error('❌ Erro na autenticação:', error);
    console.error('❌ Stack trace:', error.stack);
    return { 
      success: false, 
      error: `Erro ao autenticar: ${error.message}. Verifique se o redirect_uri está configurado no Google Cloud Console.` 
    };
  }
}

async function handleAuthCallback(userId, code) {
  try {
    // Carregar configuração do banco
    const { configs } = require('../database');
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
      return { success: false, error: 'Configuração do usuário não encontrada' };
    }

    if (!fs.existsSync(dbConfig.config_path)) {
      return { success: false, error: 'Arquivo de credenciais não encontrado' };
    }

    // Ler credenciais do arquivo do usuário
    const userCredentials = JSON.parse(fs.readFileSync(dbConfig.config_path, 'utf8'));
    const clientId = userCredentials.installed?.client_id || userCredentials.web?.client_id;
    const clientSecret = userCredentials.installed?.client_secret || userCredentials.web?.client_secret;

    if (!clientId || !clientSecret) {
      return { success: false, error: 'Credenciais inválidas no arquivo' };
    }

    // Detectar tipo de aplicação (desktop/installed ou web)
    const isDesktopApp = !!userCredentials.installed;
    const isWebApp = !!userCredentials.web;
    
    // Detectar se está em produção (Render/Vercel) ou local
    const isProduction = process.env.RENDER || process.env.VERCEL || process.env.NODE_ENV === 'production';
    const baseUrl = process.env.BASE_URL || (isProduction ? (process.env.RENDER_EXTERNAL_URL || process.env.VERCEL_URL || '') : 'http://localhost:3000');
    
    let redirectUri = process.env.YOUTUBE_REDIRECT_URI;
    
    if (!redirectUri) {
      if (isDesktopApp) {
        // Para aplicações desktop, usar http://localhost (não precisa configurar no Google Cloud Console)
        // O Google aceita automaticamente http://localhost para desktop apps
        redirectUri = 'http://localhost/user/auth/callback';
        console.log('📱 Detectado: Aplicação Desktop - usando http://localhost');
      } else if (isWebApp) {
        // Para aplicações web, tentar pegar do arquivo ou usar padrão
        const redirectUris = userCredentials.web?.redirect_uris || [];
        if (redirectUris.length > 0) {
          redirectUri = redirectUris[0];
          if (redirectUri === 'http://localhost') {
            redirectUri = 'http://localhost:3000/user/auth/callback';
          }
        } else {
          // Usar URL base do ambiente
          if (isProduction && baseUrl) {
            redirectUri = `${baseUrl}/user/auth/callback`;
          } else {
            redirectUri = 'http://localhost:3000/user/auth/callback';
          }
        }
        console.log('🌐 Detectado: Aplicação Web');
      } else {
        // Fallback: assumir desktop se não detectar
        redirectUri = 'http://localhost/user/auth/callback';
        console.log('⚠️  Tipo não detectado, assumindo Desktop');
      }
    }
    
    console.log('🔗 Ambiente:', isProduction ? 'Produção' : 'Local');
    console.log('🔗 Base URL:', baseUrl);
    console.log('🔗 Redirect URI usado:', redirectUri);
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Salvar refresh token no banco
    if (!tokens.refresh_token) {
      console.warn('⚠️  Aviso: refresh_token não recebido. Pode ser necessário revogar acesso anterior.');
    }

    // Obter informações do canal
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const response = await youtube.channels.list({
      part: 'snippet',
      mine: true
    });

    if (response.data.items && response.data.items.length > 0) {
      const channel = response.data.items[0];
      
      // Atualizar no banco (será feito na rota)
      return {
        success: true,
        channelId: channel.id,
        channelName: channel.snippet.title,
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        oauth2Client: oauth2Client
      };
    }

    return { success: false, error: 'Não foi possível obter informações do canal' };
  } catch (error) {
    console.error('❌ Erro no callback:', error);
    console.error('❌ Detalhes do erro:', error.response?.data || error.message);
    
    // Mensagem de erro mais específica
    let errorMessage = error.message;
    if (error.message && error.message.includes('Insufficient Permission')) {
      errorMessage = 'Permissão insuficiente. Verifique se os escopos do YouTube estão habilitados no Google Cloud Console e se o OAuth consent screen está configurado corretamente.';
    } else if (error.response?.data?.error_description) {
      errorMessage = error.response.data.error_description;
    }
    
    return { success: false, error: errorMessage };
  }
}

module.exports = {
  authenticateYouTube,
  handleAuthCallback
};

