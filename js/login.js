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

    const passwordToggle = document.getElementById('passwordToggle');
    const passwordInput = document.getElementById('password');
    passwordToggle?.addEventListener('click', () => {
        const shouldShow = passwordInput.type === 'password';
        passwordInput.type = shouldShow ? 'text' : 'password';
        passwordToggle.setAttribute('aria-pressed', String(shouldShow));
        passwordToggle.setAttribute('aria-label', shouldShow ? 'پنهان کردن کلمه عبور' : 'نمایش کلمه عبور');
        passwordToggle.querySelector('i')?.classList.toggle('fa-eye', !shouldShow);
        passwordToggle.querySelector('i')?.classList.toggle('fa-eye-slash', shouldShow);
        passwordInput.focus({ preventScroll: true });
    });
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

    userEl.setAttribute('aria-invalid', 'false');
    passEl.setAttribute('aria-invalid', 'false');
    if (!username || !password) {
        const emptyField = !username ? userEl : passEl;
        emptyField.setAttribute('aria-invalid', 'true');
        if (errorMessage) errorMessage.textContent = 'شماره تماس و کلمه عبور را کامل وارد کنید.';
        if (errorAlert) errorAlert.hidden = false;
        emptyField.focus();
        return;
    }

    if (errorAlert) errorAlert.hidden = true;
    if (card) card.classList.remove('shake');
    if (submitBtn) submitBtn.disabled = true;
    if (submitBtn) submitBtn.setAttribute('aria-busy', 'true');
    if (btnText) btnText.textContent = 'در حال بررسی هویت...';

    try {
        if (!window.DB) {
            throw new Error('سیستم پایگاه داده بارگذاری نشده است.');
        }

        const health = await window.DB.healthCheck();
        if (!health.ok) {
            throw health.error || new Error('ارتباط با پایگاه داده برقرار نشد.');
        }

        const result = await window.DB.loginUser(username, password);

        if (result.success) {
            // ورود موفقیت‌آمیز
            localStorage.setItem('adminLoggedIn', 'true');
            localStorage.setItem('userPhone', result.user.phone);
            localStorage.setItem('userRole', result.user.role);
            
            if (btnText) btnText.textContent = 'احراز هویت موفق، خوش‌آمدید ✓';
            if (submitBtn) {
                submitBtn.classList.add('is-success');
                submitBtn.setAttribute('aria-busy', 'false');
            }
            
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 600);
        } else {
            // ورود ناموفق
            if (errorMessage) errorMessage.textContent = result.message;
            if (errorAlert) errorAlert.hidden = false;
            if (card) card.classList.add('shake');
            if (submitBtn) submitBtn.disabled = false;
            if (submitBtn) submitBtn.setAttribute('aria-busy', 'false');
            if (btnText) btnText.textContent = 'ورود به پنل مدیریت';
            userEl.setAttribute('aria-invalid', 'true');
            passEl.setAttribute('aria-invalid', 'true');
            
            // فوکوس مجدد روی کلمه عبور
            if (passEl) {
                passEl.value = '';
                passEl.focus();
            }
        }
    } catch (err) {
        console.error(err);
        if (errorMessage) errorMessage.textContent = err.message || 'خطای غیرمنتظره رخ داد.';
        if (errorAlert) errorAlert.hidden = false;
        if (card) card.classList.add('shake');
        if (submitBtn) submitBtn.disabled = false;
        if (submitBtn) submitBtn.setAttribute('aria-busy', 'false');
        if (btnText) btnText.textContent = 'ورود به پنل مدیریت';
    }
}
