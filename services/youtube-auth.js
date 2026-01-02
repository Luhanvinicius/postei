const { google } = require('googleapis');
const path = require('path');
const fs = require('fs-extra');

async function authenticateYouTube(userId, credentialsPath, req = null) {
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
    
    // Obter URL base - prioridade: BASE_URL > RENDER_EXTERNAL_URL > VERCEL_URL > req.headers > localhost
    let baseUrl = process.env.BASE_URL;
    if (!baseUrl && isProduction) {
      baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.VERCEL_URL || '';
      
      // Se ainda não encontrou, tentar construir a partir dos headers da requisição
      if (!baseUrl && req && req.headers && req.headers.host) {
        const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http') || 'https';
        baseUrl = `${protocol}://${req.headers.host}`;
        console.log('🔍 URL construída a partir dos headers da requisição:', baseUrl);
      }
    }
    
    // Normalizar URL (garantir www se necessário)
    if (baseUrl && baseUrl.includes('postei.pro') && !baseUrl.includes('www.')) {
      baseUrl = baseUrl.replace('postei.pro', 'www.postei.pro');
      console.log('🔍 URL normalizada para incluir www:', baseUrl);
    }
    
    if (!baseUrl) {
      baseUrl = 'http://localhost:3000';
    }
    
    console.log('🔍 Debug - Detecção de URL:', {
      isProduction,
      RENDER: process.env.RENDER,
      VERCEL: process.env.VERCEL,
      RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      BASE_URL: process.env.BASE_URL,
      baseUrlFinal: baseUrl,
      hasReq: !!req,
      reqHost: req?.headers?.host,
      protocol: req?.headers?.['x-forwarded-proto'] || (req?.secure ? 'https' : 'http')
    });
    
    let redirectUri = process.env.YOUTUBE_REDIRECT_URI;
    
    if (!redirectUri) {
      if (isDesktopApp) {
        // Para aplicações desktop, usar http://localhost:PORT (não precisa configurar no Google Cloud Console)
        // O Google aceita automaticamente http://localhost ou http://localhost:PORT para desktop apps
        if (isProduction && baseUrl) {
          redirectUri = `${baseUrl}/user/auth/callback`;
        } else {
          // Local: usar porta 3000
          redirectUri = 'http://localhost:3000/user/auth/callback';
        }
        console.log('📱 Detectado: Aplicação Desktop - usando', redirectUri);
      } else if (isWebApp) {
        // Para aplicações web, em produção SEMPRE usar URL do ambiente, não do arquivo
        if (isProduction && baseUrl) {
          // Em produção, ignorar redirect URIs do arquivo e usar URL do ambiente
          redirectUri = `${baseUrl}/user/auth/callback`;
          console.log('🌐 Detectado: Aplicação Web em Produção - usando URL do ambiente:', redirectUri);
        } else {
          // Local: tentar pegar do arquivo ou usar padrão
          const redirectUris = userCredentials.web?.redirect_uris || [];
          if (redirectUris.length > 0) {
            // Procurar por localhost no array
            const localhostUri = redirectUris.find(uri => uri.includes('localhost'));
            if (localhostUri) {
              redirectUri = localhostUri === 'http://localhost' 
                ? 'http://localhost:3000/user/auth/callback'
                : localhostUri;
            } else {
              redirectUri = redirectUris[0];
            }
          } else {
            redirectUri = 'http://localhost:3000/user/auth/callback';
          }
          console.log('🌐 Detectado: Aplicação Web Local');
        }
      } else {
        // Fallback: assumir desktop se não detectar
        if (isProduction && baseUrl) {
          redirectUri = `${baseUrl}/user/auth/callback`;
        } else {
          redirectUri = 'http://localhost:3000/user/auth/callback';
        }
        console.log('⚠️  Tipo não detectado, assumindo Desktop - usando', redirectUri);
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
    
    // Obter URL base - prioridade: BASE_URL > RENDER_EXTERNAL_URL > VERCEL_URL > localhost
    let baseUrl = process.env.BASE_URL;
    if (!baseUrl && isProduction) {
      baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.VERCEL_URL || '';
    }
    
    // Normalizar URL (garantir www se necessário)
    if (baseUrl && baseUrl.includes('postei.pro') && !baseUrl.includes('www.')) {
      baseUrl = baseUrl.replace('postei.pro', 'www.postei.pro');
      console.log('🔍 URL normalizada para incluir www:', baseUrl);
    }
    
    if (!baseUrl) {
      baseUrl = 'http://localhost:3000';
    }
    
    console.log('🔍 Debug callback - Detecção de URL:', {
      isProduction,
      RENDER_EXTERNAL_URL: process.env.RENDER_EXTERNAL_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      BASE_URL: process.env.BASE_URL,
      baseUrlFinal: baseUrl
    });
    
    let redirectUri = process.env.YOUTUBE_REDIRECT_URI;
    
    if (!redirectUri) {
      if (isDesktopApp) {
        // Para aplicações desktop, usar http://localhost:PORT (não precisa configurar no Google Cloud Console)
        // O Google aceita automaticamente http://localhost ou http://localhost:PORT para desktop apps
        if (isProduction && baseUrl) {
          redirectUri = `${baseUrl}/user/auth/callback`;
        } else {
          // Local: usar porta 3000
          redirectUri = 'http://localhost:3000/user/auth/callback';
        }
        console.log('📱 Detectado: Aplicação Desktop - usando', redirectUri);
      } else if (isWebApp) {
        // Para aplicações web, em produção SEMPRE usar URL do ambiente, não do arquivo
        if (isProduction && baseUrl) {
          // Em produção, ignorar redirect URIs do arquivo e usar URL do ambiente
          redirectUri = `${baseUrl}/user/auth/callback`;
          console.log('🌐 Detectado: Aplicação Web em Produção - usando URL do ambiente:', redirectUri);
        } else {
          // Local: tentar pegar do arquivo ou usar padrão
          const redirectUris = userCredentials.web?.redirect_uris || [];
          if (redirectUris.length > 0) {
            // Procurar por localhost no array
            const localhostUri = redirectUris.find(uri => uri.includes('localhost'));
            if (localhostUri) {
              redirectUri = localhostUri === 'http://localhost' 
                ? 'http://localhost:3000/user/auth/callback'
                : localhostUri;
            } else {
              redirectUri = redirectUris[0];
            }
          } else {
            redirectUri = 'http://localhost:3000/user/auth/callback';
          }
          console.log('🌐 Detectado: Aplicação Web Local');
        }
      } else {
        // Fallback: assumir desktop se não detectar
        if (isProduction && baseUrl) {
          redirectUri = `${baseUrl}/user/auth/callback`;
        } else {
          redirectUri = 'http://localhost:3000/user/auth/callback';
        }
        console.log('⚠️  Tipo não detectado, assumindo Desktop - usando', redirectUri);
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

    console.log('🔄 Tentando trocar código OAuth por tokens...');
    console.log('🔑 Client ID:', clientId);
    console.log('🔗 Redirect URI usado no callback:', redirectUri);
    
    const { tokens } = await oauth2Client.getToken(code);
    console.log('✅ Tokens recebidos com sucesso!');
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

