/**
 * Gerenciamento de autenticação com JWT Token
 * SOLUÇÃO ROBUSTA: Token SEMPRE na URL
 */

(function() {
  'use strict';
  
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
        console.log('✅ Token adicionado à URL atual:', url.toString());
      }
    }
  }

  // Capturar token da query string após login
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromURL = urlParams.get('token');
  
  if (tokenFromURL) {
    saveToken(tokenFromURL);
    console.log('✅ Token capturado da URL e salvo no localStorage');
  }
  
  // Garantir que token está na URL
  ensureTokenInURL();

  // Função para adicionar token a um link
  function addTokenToLink(link) {
    const token = getToken();
    if (!token) {
      console.warn('⚠️  Tentativa de adicionar token a link, mas não há token no localStorage');
      return false;
    }
    
    let href = link.getAttribute('href');
    if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
      return false; // Links externos ou âncoras, não adicionar token
    }
    
    if (href.includes('token=')) {
      return true; // Já tem token
    }
    
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

  // Adicionar token em TODOS os links
  function addTokenToAllLinks() {
    const token = getToken();
    if (!token) {
      console.log('⚠️  Nenhum token no localStorage para adicionar aos links');
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

  // Interceptar TODOS os cliques em links - MUITO IMPORTANTE
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href^="/"]');
    if (link) {
      const token = getToken();
      if (!token) {
        console.error('❌ Tentativa de navegar sem token!');
        e.preventDefault();
        e.stopPropagation();
        alert('Sessão expirada. Faça login novamente.');
        window.location.href = '/auth/login';
        return false;
      }
      
      // Garantir que token está no link ANTES de navegar
      if (!addTokenToLink(link)) {
        console.error('❌ Erro ao adicionar token ao link');
        e.preventDefault();
        return false;
      }
      
      console.log('🔗 Navegando para:', link.href);
    }
  }, true); // Capture phase - executa ANTES de qualquer outro handler

  // Executar quando DOM carregar
  function init() {
    addTokenToAllLinks();
    ensureTokenInURL();
    
    // Adicionar token em formulários
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const token = getToken();
      if (token) {
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
      }
    });
  }

  // Executar imediatamente
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Observar mudanças no DOM
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(function(mutations) {
      addTokenToAllLinks();
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  }

  // Interceptar fetch
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

  // Interceptar XMLHttpRequest
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

  // Expor funções globalmente
  window.authToken = {
    get: getToken,
    save: saveToken,
    remove: removeToken,
    ensureInURL: ensureTokenInURL
  };

  // Logout
  window.logout = function() {
    removeToken();
    window.location.href = '/auth/login';
  };
})();
