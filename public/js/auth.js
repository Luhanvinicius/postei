/**
 * Gerenciamento de autenticação com JWT Token
 * Token SEMPRE na URL para garantir persistência
 */

// Salvar token no localStorage
function saveToken(token) {
  if (token) {
    localStorage.setItem('auth_token', token);
    console.log('✅ Token salvo no localStorage');
  }
}

// Obter token do localStorage
function getToken() {
  return localStorage.getItem('auth_token');
}

// Remover token
function removeToken() {
  localStorage.removeItem('auth_token');
  console.log('✅ Token removido do localStorage');
}

// Garantir que token está na URL atual
function ensureTokenInURL() {
  const token = getToken();
  if (token) {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('token')) {
      url.searchParams.set('token', token);
      window.history.replaceState({}, document.title, url.toString());
      console.log('✅ Token adicionado à URL atual');
    }
  }
}

// Capturar token da query string após login
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    saveToken(token);
    console.log('✅ Token capturado da URL e salvo no localStorage');
  }
  
  // Garantir que token está na URL
  ensureTokenInURL();
})();

// Interceptar TODAS as requisições fetch para adicionar token
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  const token = getToken();
  
  if (token) {
    if (!options.headers) {
      options.headers = {};
    }
    options.headers['Authorization'] = `Bearer ${token}`;
  }
  
  return originalFetch(url, options);
};

// Interceptar XMLHttpRequest também
const originalOpen = XMLHttpRequest.prototype.open;
const originalSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function(method, url, ...args) {
  this._url = url;
  return originalOpen.apply(this, [method, url, ...args]);
};

XMLHttpRequest.prototype.send = function(...args) {
  const token = getToken();
  if (token && this._url && !this._url.startsWith('http://') && !this._url.startsWith('https://')) {
    this.setRequestHeader('Authorization', `Bearer ${token}`);
  }
  return originalSend.apply(this, args);
};

// Função para adicionar token a um link
function addTokenToLink(link) {
  const token = getToken();
  if (!token) return false;
  
  let href = link.getAttribute('href');
  if (!href || href.includes('token=')) return true;
  
  try {
    const url = new URL(href, window.location.origin);
    url.searchParams.set('token', token);
    link.href = url.toString();
    return true;
  } catch (err) {
    const separator = href.includes('?') ? '&' : '?';
    link.setAttribute('href', href + separator + 'token=' + encodeURIComponent(token));
    return true;
  }
}

// Interceptar TODOS os cliques em links ANTES de navegar
document.addEventListener('click', function(e) {
  const link = e.target.closest('a[href^="/"]');
  if (link) {
    const token = getToken();
    if (!token) {
      console.error('❌ Tentativa de navegar sem token!');
      e.preventDefault();
      alert('Sessão expirada. Faça login novamente.');
      window.location.href = '/auth/login';
      return false;
    }
    
    if (!addTokenToLink(link)) {
      console.error('❌ Erro ao adicionar token ao link');
    }
  }
}, true); // Capture phase - executa ANTES do clique

// Adicionar token em TODOS os links quando DOM carregar
function addTokenToAllLinks() {
  const token = getToken();
  if (!token) {
    console.log('⚠️  Nenhum token no localStorage');
    return;
  }
  
  const links = document.querySelectorAll('a[href^="/"]');
  let count = 0;
  links.forEach(link => {
    if (addTokenToLink(link)) {
      count++;
    }
  });
  if (count > 0) {
    console.log('🔗 Token adicionado a', count, 'links');
  }
}

// Executar IMEDIATAMENTE
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    addTokenToAllLinks();
    ensureTokenInURL();
  });
} else {
  addTokenToAllLinks();
  ensureTokenInURL();
}

// Observar mudanças no DOM (para links dinâmicos)
if (typeof MutationObserver !== 'undefined') {
  const observer = new MutationObserver(function(mutations) {
    addTokenToAllLinks();
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// Adicionar token em formulários
function addTokenToForms() {
  const token = getToken();
  if (!token) return;
  
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    if (!form.querySelector('input[name="token"]')) {
      const tokenInput = document.createElement('input');
      tokenInput.type = 'hidden';
      tokenInput.name = 'token';
      tokenInput.value = token;
      form.appendChild(tokenInput);
    }
    
    if (form.method.toUpperCase() === 'GET') {
      const action = form.getAttribute('action') || window.location.pathname;
      if (action && !action.includes('token=')) {
        try {
          const url = new URL(action, window.location.origin);
          url.searchParams.set('token', token);
          form.setAttribute('action', url.toString());
        } catch (err) {
          const separator = action.includes('?') ? '&' : '?';
          form.setAttribute('action', action + separator + 'token=' + encodeURIComponent(token));
        }
      }
    }
  });
}

// Executar quando DOM carregar
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addTokenToForms);
} else {
  addTokenToForms();
}

// Logout - remover token
function logout() {
  removeToken();
  window.location.href = '/auth/login';
}
