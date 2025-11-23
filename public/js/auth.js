/**
 * Gerenciamento de autenticação com JWT Token
 * Token é salvo no localStorage E mantido na URL para persistência
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

// Capturar token da query string após login
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  
  if (token) {
    saveToken(token);
    console.log('✅ Token capturado da URL e salvo no localStorage');
  }
  
  // SEMPRE manter token na URL para garantir persistência ao recarregar
  const savedToken = getToken();
  if (savedToken) {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('token')) {
      url.searchParams.set('token', savedToken);
      window.history.replaceState({}, document.title, url.toString());
    }
  }
})();

// Interceptar todas as requisições fetch para adicionar token
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

// Interceptar TODOS os cliques em links para adicionar token
document.addEventListener('click', function(e) {
  const link = e.target.closest('a[href^="/"]');
  if (link) {
    const token = getToken();
    if (token) {
      const href = link.getAttribute('href');
      if (href && !href.includes('token=')) {
        try {
          const url = new URL(href, window.location.origin);
          url.searchParams.set('token', token);
          link.href = url.toString();
        } catch (err) {
          // Se não for URL válida, adicionar como query string simples
          const separator = href.includes('?') ? '&' : '?';
          link.setAttribute('href', href + separator + 'token=' + encodeURIComponent(token));
        }
      }
    }
  }
}, true); // Use capture phase

// Adicionar token em formulários
function addTokenToForms() {
  const token = getToken();
  if (!token) return;
  
  const forms = document.querySelectorAll('form');
  forms.forEach(form => {
    // Adicionar token como hidden input
    if (!form.querySelector('input[name="token"]')) {
      const tokenInput = document.createElement('input');
      tokenInput.type = 'hidden';
      tokenInput.name = 'token';
      tokenInput.value = token;
      form.appendChild(tokenInput);
    }
    
    // Adicionar na action URL se for GET
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
