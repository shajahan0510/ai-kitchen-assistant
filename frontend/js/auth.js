/* ═══════════════════════════════════════════════════════════
   auth.js — Handles login, signup, logout, token management
   ═══════════════════════════════════════════════════════════ */

window.API = ''; // Backend serves frontend from same origin

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem('ka_token'); }
function getUser() { try { return JSON.parse(localStorage.getItem('ka_user')); } catch { return null; } }

function setSession(token, user) {
    localStorage.setItem('ka_token', token);
    localStorage.setItem('ka_user', JSON.stringify(user));
}

function clearSession() {
    localStorage.removeItem('ka_token');
    localStorage.removeItem('ka_user');
}

function showAlert(id, msg, type = 'error') {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = `alert ${type}`;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    const text = btn.querySelector('.btn-text');
    const loader = btn.querySelector('.btn-loader');
    btn.disabled = loading;
    if (text) text.style.display = loading ? 'none' : 'inline';
    if (loader) loader.style.display = loading ? 'inline' : 'none';
}

// ─── Tab Switching ────────────────────────────────────────────────────────────
function switchTab(tab) {
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`${tab}Form`).classList.add('active');
    document.getElementById(`${tab}Tab`).classList.add('active');
}

// ─── Password Toggle ──────────────────────────────────────────────────────────
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const isPass = input.type === 'password';
    input.type = isPass ? 'text' : 'password';
    btn.textContent = isPass ? '🙈' : '👁️';
}

// ─── Login ────────────────────────────────────────────────────────────────────
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('loginBtn', true);
        try {
            const res = await fetch(`${API}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('loginEmail').value.trim(),
                    password: document.getElementById('loginPassword').value,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Login failed');
            setSession(data.token, data.user);
            window.location.href = 'dashboard.html';
        } catch (err) {
            showAlert('authAlert', err.message, 'error');
        } finally {
            setLoading('loginBtn', false);
        }
    });
}

// ─── Signup ───────────────────────────────────────────────────────────────────
const signupForm = document.getElementById('signupForm');
if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        setLoading('signupBtn', true);
        try {
            const res = await fetch(`${API}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: document.getElementById('signupUsername').value.trim(),
                    email: document.getElementById('signupEmail').value.trim(),
                    password: document.getElementById('signupPassword').value,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Signup failed');
            showAlert('authAlert', 'Account created! Please log in.', 'success');
            switchTab('login');
        } catch (err) {
            showAlert('authAlert', err.message, 'error');
        } finally {
            setLoading('signupBtn', false);
        }
    });
}

// ─── Logout ───────────────────────────────────────────────────────────────────
async function logout() {
    try {
        const token = getToken();
        if (token) {
            await fetch(`${API}/api/auth/logout`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
            });
        }
    } catch (_) { }
    clearSession();
    window.location.href = 'index.html';
}

// ─── Guard: redirect to login if not authenticated ────────────────────────────
function requireAuth() {
    if (!getToken() || !getUser()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}

// ─── Guard: redirect to dashboard if already logged in ────────────────────────
if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    if (getToken() && getUser()) {
        window.location.href = 'dashboard.html';
    }
}

// ─── Fetch with auth header ───────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
    const token = getToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(window.API + url, { ...options, headers });
    if (res.status === 401) { clearSession(); window.location.href = 'index.html'; return; }
    return res;
}
