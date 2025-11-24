/**
 * Autenticação baseada em SESSÕES
 * Não precisa gerenciar tokens - tudo é feito via cookies/sessão no servidor
 * Este arquivo está aqui apenas para compatibilidade, mas não faz nada
 */

// Função de logout (chamada pelo botão de sair)
function logout() {
  // O logout é feito via POST para /auth/logout no servidor
  // Não precisa fazer nada aqui, o servidor vai destruir a sessão
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = '/auth/logout';
  document.body.appendChild(form);
  form.submit();
}

// Expor globalmente se necessário
window.logout = logout;
