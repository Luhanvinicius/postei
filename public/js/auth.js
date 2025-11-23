/**
 * Gerenciamento de autenticação com JWT Token
 * Token é salvo no localStorage e enviado via header Authorization
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
    // Remover token da URL
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
    console.log('✅ Token capturado da URL e salvo');
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

// Adicionar token em formulários via hidden input
document.addEventListener('DOMContentLoaded', function() {
  const token = getToken();
  if (token) {
    // Adicionar token em todos os formulários
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      // Verificar se já não tem um input de token
      if (!form.querySelector('input[name="token"]')) {
        const tokenInput = document.createElement('input');
        tokenInput.type = 'hidden';
        tokenInput.name = 'token';
        tokenInput.value = token;
        form.appendChild(tokenInput);
      }
    });
  }
});

// Logout - remover token
function logout() {
  removeToken();
  window.location.href = '/auth/login';
}

