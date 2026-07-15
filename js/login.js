// js/login.js

document.addEventListener('DOMContentLoaded', async () => {
    // بررسی وضعیت نشست کاربر
    if (window.Auth) {
        window.Auth.checkSessionAndRedirect('login');
    } else if (localStorage.getItem('adminLoggedIn') === 'true') {
        window.location.href = 'dashboard.html';
    }

    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
});

async function handleLogin(event) {
    event.preventDefault();
    
    const card = document.getElementById('loginCard');
    const userEl = document.getElementById('username');
    const passEl = document.getElementById('password');
    const errorAlert = document.getElementById('errorAlert');
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = document.getElementById('submitBtn');
    const btnText = document.getElementById('btnText');
    const btnSpinner = document.getElementById('btnSpinner');

    const username = userEl.value.trim();
    const password = passEl.value;

    // ریست خطاهای قبلی و فعال کردن انیمیشن دکمه
    if (errorAlert) errorAlert.classList.add('hidden');
    if (card) card.classList.remove('shake');
    if (submitBtn) submitBtn.disabled = true;
    if (btnText) btnText.textContent = 'در حال بررسی هویت...';
    if (btnSpinner) btnSpinner.style.display = 'block';

    try {
        if (!window.DB) {
            throw new Error('سیستم پایگاه داده بارگذاری نشده است.');
        }

        const result = await window.DB.loginUser(username, password);

        if (result.success) {
            // ورود موفقیت‌آمیز
            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('userPhone', result.user.phone);
            localStorage.setItem('userRole', result.user.role);
            
            if (btnText) btnText.textContent = 'احراز هویت موفق، خوش‌آمدید ✓';
            if (btnSpinner) btnSpinner.style.display = 'none';
            if (submitBtn) {
                submitBtn.classList.replace('btn-login-gradient', 'bg-emerald-600');
                submitBtn.classList.add('bg-emerald-600');
            }
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 600);
        } else {
            // ورود ناموفق
            if (errorMessage) errorMessage.textContent = result.message;
            if (errorAlert) errorAlert.classList.remove('hidden');
            if (card) card.classList.add('shake');
            if (submitBtn) submitBtn.disabled = false;
            if (btnText) btnText.textContent = 'ورود به پنل مدیریت';
            if (btnSpinner) btnSpinner.style.display = 'none';
            
            // فوکوس مجدد روی کلمه عبور
            if (passEl) {
                passEl.value = '';
                passEl.focus();
            }
        }
    } catch (err) {
        console.error(err);
        if (errorMessage) errorMessage.textContent = err.message || 'خطای غیرمنتظره رخ داد.';
        if (errorAlert) errorAlert.classList.remove('hidden');
        if (card) card.classList.add('shake');
        if (submitBtn) submitBtn.disabled = false;
        if (btnText) btnText.textContent = 'ورود به پنل مدیریت';
        if (btnSpinner) btnSpinner.style.display = 'none';
    }
}
