// Funções auxiliares JavaScript
console.log('YouTube Automation - Sistema carregado');

// Auto-dismiss alerts após 5 segundos
setTimeout(() => {
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        const bsAlert = new bootstrap.Alert(alert);
        setTimeout(() => bsAlert.close(), 5000);
    });
}, 1000);


