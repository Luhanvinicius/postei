// Função para obter token do localStorage ou URL
function getAuthToken() {
  // Tentar do localStorage primeiro
  const token = localStorage.getItem('auth_token');
  if (token) {
    return token;
  }
  
  // Tentar da URL
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');
  if (urlToken) {
    // Salvar na localStorage se veio da URL
    localStorage.setItem('auth_token', urlToken);
    return urlToken;
  }
  
  return null;
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
    fetch('/auth/logout?token=' + token, {
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

// Função para adicionar token aos links e formulários
function addTokenToElements() {
  const token = getAuthToken();
  if (!token) return;
  
  // Adicionar token em todos os links internos
  document.querySelectorAll('a[href]').forEach(link => {
    const href = link.getAttribute('href');
    if (href && 
        !href.startsWith('#') && 
        !href.startsWith('javascript:') && 
        !href.startsWith('mailto:') &&
        !href.startsWith('tel:') &&
        !href.includes('token=') &&
        (href.startsWith('/') || href.startsWith(window.location.origin))) {
      
      // Modificar o href diretamente
      const separator = href.includes('?') ? '&' : '?';
      link.setAttribute('href', href + separator + 'token=' + token);
    }
  });
  
  // Adicionar token em todos os formulários
  document.querySelectorAll('form').forEach(form => {
    const action = form.getAttribute('action') || form.action;
    if (action && !action.includes('token=') && (action.startsWith('/') || action.startsWith(window.location.origin))) {
      const separator = action.includes('?') ? '&' : '?';
      form.setAttribute('action', action + separator + 'token=' + token);
    }
  });
}

// Salvar token da URL no localStorage se presente
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const urlToken = urlParams.get('token');
  if (urlToken) {
    localStorage.setItem('auth_token', urlToken);
    // Remover token da URL para manter limpa (mas manter em histórico)
    urlParams.delete('token');
    const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
    window.history.replaceState({}, '', newUrl);
  }
  
  // Executar quando o DOM estiver pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      addTokenToElements();
    });
  } else {
    addTokenToElements();
  }
  
  // Re-executar após mudanças no DOM (para conteúdo dinâmico)
  const observer = new MutationObserver(function(mutations) {
    addTokenToElements();
  });
  
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
  
  // Interceptar cliques em links para garantir que o token seja mantido
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href]');
    if (link) {
      const href = link.getAttribute('href');
      const token = getAuthToken();
      
      if (token && 
          href && 
          !href.startsWith('#') && 
          !href.startsWith('javascript:') &&
          !href.includes('token=') &&
          (href.startsWith('/') || href.startsWith(window.location.origin))) {
        
        // Adicionar token se não estiver presente
        const separator = href.includes('?') ? '&' : '?';
        link.setAttribute('href', href + separator + 'token=' + token);
      }
    }
  }, true); // Usar capture phase para pegar antes do navegador processar
  
  // Interceptar submit de formulários
  document.addEventListener('submit', function(e) {
    const form = e.target;
    if (form.tagName === 'FORM') {
      const token = getAuthToken();
      if (token) {
        const action = form.getAttribute('action') || form.action;
        if (action && !action.includes('token=') && (action.startsWith('/') || action.startsWith(window.location.origin))) {
          const separator = action.includes('?') ? '&' : '?';
          form.setAttribute('action', action + separator + 'token=' + token);
        }
      }
    }
  }, true);
})();
