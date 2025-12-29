// Função para obter token do localStorage ou URL
function getAuthToken() {
  // Tentar do localStorage primeiro
  const token = localStorage.getItem('auth_token');
  if (token) {
    return token;
  }
  
  // Tentar da URL
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('token');
}

// Função para fazer requisições autenticadas
function authenticatedFetch(url, options = {}) {
  const token = getAuthToken();
  if (token) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  
  // Adicionar token na URL também (fallback)
  if (token && !url.includes('token=')) {
    url += (url.includes('?') ? '&' : '?') + 'token=' + token;
  }
  
  return fetch(url, options);
}

// Função de logout
function logout() {
  const token = getAuthToken();
  if (token) {
    // Chamar endpoint de logout
    fetch('/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token: token })
    }).finally(() => {
      localStorage.removeItem('auth_token');
      window.location.href = '/auth/login';
    });
  } else {
    localStorage.removeItem('auth_token');
    window.location.href = '/auth/login';
  }
}

// Adicionar token automaticamente em todos os links e formulários
document.addEventListener('DOMContentLoaded', function() {
  const token = getAuthToken();
  if (token) {
    // Adicionar token em todos os links
    document.querySelectorAll('a[href]').forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.includes('token=')) {
        link.addEventListener('click', function(e) {
          if (!this.href.includes('token=')) {
            const separator = this.href.includes('?') ? '&' : '?';
            this.href = this.href + separator + 'token=' + token;
          }
        });
      }
    });
    
    // Adicionar token em todos os formulários
    document.querySelectorAll('form').forEach(form => {
      if (!form.action.includes('token=')) {
        const action = form.getAttribute('action') || form.action;
        const separator = action.includes('?') ? '&' : '?';
        form.action = action + separator + 'token=' + token;
      }
    });
  }
});
