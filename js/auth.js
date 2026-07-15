// js/auth.js

// مدیریت امنیت و نشست کلینیک (Clinical Session / Auth Management)
const Auth = {
    checkSessionAndRedirect(page) {
        const isLoggedIn = localStorage.getItem('adminLoggedIn') === 'true';
        if (page === 'login') {
            if (isLoggedIn) {
                window.location.href = 'dashboard.html';
            }
        } else {
            if (!isLoggedIn) {
                window.location.href = 'index.html';
            }
        }
    },
    
    logout() {
        localStorage.removeItem('adminLoggedIn');
        window.location.href = 'index.html';
    }
};

window.Auth = Auth;
