/**
 * Gerenciamento de autenticação com JWT Token
 * SOLUÇÃO DEFINITIVA: Token SEMPRE na URL e em TODOS os links
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

  // Garantir que token está na URL atual (CRÍTICO)
  function ensureTokenInURL() {
    const token = getToken();
    if (token) {
      const url = new URL(window.location.href);
      if (!url.searchParams.has('token')) {
        url.searchParams.set('token', token);
        window.history.replaceState({}, document.title, url.toString());
        console.log('✅ Token adicionado à URL atual');
      }
    } else {
      // Se não tem token e não está na página de login, redirecionar
      if (!window.location.pathname.includes('/auth/login') && 
          !window.location.pathname.includes('/auth/register')) {
        console.warn('⚠️  Sem token e não está na página de login, redirecionando...');
        window.location.href = '/auth/login';
      }
    }
  }

  // Capturar token da query string após login
  (function captureTokenFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromURL = urlParams.get('token');
    
    if (tokenFromURL) {
      saveToken(tokenFromURL);
      console.log('✅ Token capturado da URL e salvo no localStorage');
      // Remover token da URL após salvar (opcional, mas mantém URL limpa)
      // Não vamos remover para garantir que funcione ao recarregar
    }
    
    // Garantir que token está na URL
    ensureTokenInURL();
  })();

  // Função para adicionar token a um link
  function addTokenToLink(link) {
    const token = getToken();
    if (!token) {
      return false;
    }
    
    let href = link.getAttribute('href');
    if (!href) {
      return false;
    }
    
    // Ignorar links externos, âncoras, javascript:, etc
    if (href.startsWith('http://') || 
        href.startsWith('https://') || 
        href.startsWith('#') || 
        href.startsWith('javascript:') ||
        href.startsWith('mailto:')) {
      return false;
    }
    
    // Se já tem token, não precisa adicionar
    if (href.includes('token=')) {
      return true;
    }
    
    try {
      const url = new URL(href, window.location.origin);
      url.searchParams.set('token', token);
      link.href = url.toString();
      return true;
    } catch (err) {
      // Fallback para URLs relativas simples
      const separator = href.includes('?') ? '&' : '?';
      link.setAttribute('href', href + separator + 'token=' + encodeURIComponent(token));
      return true;
    }
  }

  // Adicionar token em TODOS os links
  function addTokenToAllLinks() {
    const token = getToken();
    if (!token) {
      console.warn('⚠️  Nenhum token no localStorage para adicionar aos links');
      return;
    }
    
    const links = document.querySelectorAll('a[href^="/"], a[href^="./"], a[href^="../"]');
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

  // Interceptar TODOS os cliques em links - CRÍTICO
  document.addEventListener('click', function(e) {
    const link = e.target.closest('a[href^="/"], a[href^="./"], a[href^="../"]');
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
      const href = link.getAttribute('href');
      if (href && !href.includes('token=')) {
        if (!addTokenToLink(link)) {
          console.error('❌ Erro ao adicionar token ao link:', href);
          e.preventDefault();
          return false;
        }
      }
      
      console.log('🔗 Navegando para:', link.href);
    }
  }, true); // Capture phase - executa ANTES de qualquer outro handler

  // Função de inicialização
  function init() {
    console.log('🚀 Inicializando autenticação...');
    
    // Garantir token na URL
    ensureTokenInURL();
    
    // Adicionar token em todos os links
    addTokenToAllLinks();
    
    // Adicionar token em formulários
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      const token = getToken();
      if (token) {
        // Adicionar como hidden input
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
      }
    });
    
    console.log('✅ Autenticação inicializada');
  }

  // Executar imediatamente se DOM já carregou
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM já carregou, executar imediatamente
    init();
  }

  // Observar mudanças no DOM para adicionar token a novos links
  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(function(mutations) {
      addTokenToAllLinks();
      ensureTokenInURL();
    });
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    } else {
      // Se body ainda não existe, aguardar
      document.addEventListener('DOMContentLoaded', function() {
        if (document.body) {
          observer.observe(document.body, { childList: true, subtree: true });
        }
      });
    }
  }

  // Interceptar fetch para adicionar token no header
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
  
  // Re-executar init periodicamente para garantir que links novos tenham token
  setInterval(function() {
    ensureTokenInURL();
    addTokenToAllLinks();
  }, 2000); // A cada 2 segundos
})();
