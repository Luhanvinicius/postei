const crypto = require('crypto');

const SECRET = process.env.SESSION_SECRET || 'change-this-secret-key';
const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;

/**
 * LÓGICA SIMPLES: 100% COOKIE
 * 1. Login cria cookie
 * 2. attachUser lê cookie em TODAS as requisições
 * 3. requireAuth verifica se tem req.user
 */

/**
 * Ler usuário do cookie
 */
const readAuthCookie = (req) => {
  try {
    console.log('🔍 Lendo cookie...');
    console.log('   req.cookies:', req.cookies ? Object.keys(req.cookies) : 'null');
    
    const cookieValue = req.cookies?.user_data;
    
    if (!cookieValue) {
      console.log('   ❌ Cookie user_data não encontrado');
      return null;
    }

    if (typeof cookieValue !== 'string') {
      console.log('   ❌ Cookie não é string:', typeof cookieValue);
      return null;
    }

    if (!cookieValue.includes('.')) {
      console.log('   ❌ Cookie não tem assinatura (sem ponto)');
      return null;
    }

    const [userData, signature] = cookieValue.split('.');
    const expectedSignature = crypto.createHmac('sha256', SECRET).update(userData).digest('hex');
    
    if (signature !== expectedSignature) {
      console.log('   ❌ Assinatura inválida');
      console.log('      Recebida:', signature.substring(0, 20) + '...');
      console.log('      Esperada:', expectedSignature.substring(0, 20) + '...');
      return null;
    }

    const user = JSON.parse(userData);
    console.log('   ✅ Cookie válido, usuário:', user.username);
    return user;
  } catch (err) {
    console.error('   ❌ Erro ao ler cookie:', err.message);
    return null;
  }
};

/**
 * Criar cookie de autenticação
 */
const createAuthCookie = (res, user) => {
  try {
    console.log('🍪 Criando cookie para:', user.username);
    const userData = JSON.stringify({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    });
    
    const signature = crypto.createHmac('sha256', SECRET).update(userData).digest('hex');
    const signedData = `${userData}.${signature}`;
    
    console.log('   Tamanho do cookie:', signedData.length);
    console.log('   Ambiente Vercel:', isVercel);
    
    res.cookie('user_data', signedData, {
      httpOnly: true,
      secure: isVercel ? true : false,
      sameSite: isVercel ? 'none' : 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });
    
    console.log('   ✅ Cookie criado com sucesso');
    return true;
  } catch (err) {
    console.error('❌ Erro ao criar cookie:', err);
    return false;
  }
};

/**
 * Remover cookie
 */
const clearAuthCookie = (res) => {
  res.clearCookie('user_data', {
    path: '/',
    httpOnly: true,
    secure: isVercel ? true : false,
    sameSite: isVercel ? 'none' : 'lax'
  });
};

/**
 * Middleware global: anexar usuário do cookie
 */
const attachUser = (req, res, next) => {
  const user = readAuthCookie(req);
  req.user = user;
  
  if (user) {
    console.log('✅ Usuário anexado:', user.username, 'Role:', user.role);
  } else {
    console.log('⚠️  Nenhum usuário autenticado');
  }
  
  next();
};

/**
 * Middleware: verificar autenticação
 */
const requireAuth = (req, res, next) => {
  console.log('🔒 requireAuth - Verificando autenticação...');
  console.log('   req.user:', req.user ? req.user.username : 'null');
  
  if (!req.user) {
    console.log('   ❌ Não autenticado, redirecionando para login');
    return res.redirect('/auth/login');
  }
  
  console.log('   ✅ Autenticado, permitindo acesso');
  next();
};

/**
 * Middleware: verificar se é admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).send('Acesso negado. Apenas administradores.');
  }
  next();
};

module.exports = {
  attachUser,
  requireAuth,
  requireAdmin,
  createAuthCookie,
  clearAuthCookie
};
