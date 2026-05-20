// auth.js — Landing page logic
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');

// Check if already logged in
fetch('/api/me').then(r => r.json()).then(data => {
    if (data.loggedIn) window.location.href = '/dashboard';
});

// Tab switching
tabLogin.onclick = () => switchTab('login');
tabRegister.onclick = () => switchTab('register');
document.getElementById('go-register').onclick = (e) => { e.preventDefault(); switchTab('register'); };
document.getElementById('go-login').onclick = (e) => { e.preventDefault(); switchTab('login'); };

function switchTab(tab) {
    if (tab === 'login') {
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
        tabLogin.classList.add('active');
        tabRegister.classList.remove('active');
    } else {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        tabLogin.classList.remove('active');
        tabRegister.classList.add('active');
    }
}

// Login
document.getElementById('login-btn').onclick = async () => {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    if (!email || !password) return showToast('Please fill in all fields', 'error');

    const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success) {
        showToast(`Welcome back, ${data.name}!`, 'success');
        setTimeout(() => window.location.href = '/dashboard', 800);
    } else {
        showToast(data.error, 'error');
    }
};

document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
});

// Register
document.getElementById('register-btn').onclick = async () => {
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    if (!name || !email || !password) return showToast('Please fill in all fields', 'error');

    const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();
    if (data.success) {
        showToast(`Account created! Welcome, ${data.name}!`, 'success');
        setTimeout(() => window.location.href = '/dashboard', 800);
    } else {
        showToast(data.error, 'error');
    }
};

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}
