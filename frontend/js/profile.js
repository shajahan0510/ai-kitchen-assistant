const API = '';

document.addEventListener('DOMContentLoaded', () => {
    initProfilePage();
});

async function initProfilePage() {
    const urlParams = new URLSearchParams(window.location.search);
    const targetUsername = urlParams.get('user');

    if (!targetUsername) {
        document.getElementById('profileLoading').style.display = 'none';
        document.getElementById('profileError').style.display = 'block';
        return;
    }

    const currentUser = getUser();
    if (currentUser) {
        document.getElementById('authUserNav').innerHTML = `<span style="font-weight:600; color:var(--text2);">Logged in as <a href="dashboard.html" class="text-gradient">${currentUser.username}</a></span>`;
    } else {
        document.getElementById('authUserNav').innerHTML = `<a href="index.html" class="btn btn-primary btn-sm">Sign In</a>`;
    }

    try {
        const res = await fetch(`${API}/api/users/${targetUsername}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'User not found');

        renderProfile(data.profile, data.recipes, currentUser);

    } catch (err) {
        document.getElementById('profileLoading').style.display = 'none';
        document.getElementById('profileError').textContent = err.message;
        document.getElementById('profileError').style.display = 'block';
    }
}

let currentViewedUserId = null;

function renderProfile(profile, recipes, currentUser) {
    document.getElementById('profileLoading').style.display = 'none';
    document.getElementById('profileView').style.display = 'block';

    currentViewedUserId = profile.id;

    // Header
    document.getElementById('profileUsername').textContent = profile.username;
    document.getElementById('sectionUsername').textContent = profile.username;

    const bioEl = document.getElementById('profileBio');
    if (profile.bio) {
        bioEl.textContent = profile.bio;
        bioEl.style.display = 'block';
    } else {
        bioEl.style.display = 'none';
    }

    const avatarEl = document.getElementById('profileAvatar');
    if (profile.avatar_url) {
        avatarEl.innerHTML = `<img src="${profile.avatar_url}" alt="${profile.username}" />`;
    } else {
        avatarEl.innerHTML = profile.username[0].toUpperCase();
    }

    // Stats
    document.getElementById('statFollowers').textContent = (profile.followers || 0).toLocaleString();
    document.getElementById('statFollowing').textContent = (profile.following || 0).toLocaleString();
    document.getElementById('statRecipes').textContent = (recipes ? recipes.length : 0).toLocaleString();

    // Action Buttons
    if (currentUser && currentUser.id === profile.id) {
        document.getElementById('editProfileBtn').style.display = 'inline-flex';
    } else if (currentUser) {
        checkFollowStatus(profile.id);
    }

    // Recipes
    renderUserRecipes(recipes);
}

// ─── Following Logic ──────────────────────────────────────────────────────────
let isFollowing = false;

async function checkFollowStatus(targetId) {
    try {
        const token = getToken();
        if (!token) return;

        // Check our own following list
        const res = await fetch(`${API}/api/social/following/${getUser().id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();

        if (res.ok && data.following) {
            isFollowing = data.following.some(u => u.id === targetId);
        }
        updateFollowBtnUI();
    } catch (err) {
        console.error('Failed to check follow status', err);
    }
}

function updateFollowBtnUI() {
    const btn = document.getElementById('followBtn');
    btn.style.display = 'inline-flex';
    const textSpan = btn.querySelector('.btn-text');

    if (isFollowing) {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
        textSpan.textContent = 'Following';
    } else {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
        textSpan.textContent = 'Follow User';
    }
}

async function toggleFollow() {
    if (!currentViewedUserId) return;

    const btn = document.getElementById('followBtn');
    const endpoint = isFollowing ? `/api/social/unfollow/${currentViewedUserId}` : `/api/social/follow/${currentViewedUserId}`;
    const method = isFollowing ? 'DELETE' : 'POST';

    const token = getToken();
    if (!token) {
        window.location.href = 'index.html'; // Force login
        return;
    }

    setLoading('followBtn', true);

    try {
        const res = await fetch(API + endpoint, {
            method: method,
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
        });

        if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Action failed');
        }

        isFollowing = !isFollowing;
        updateFollowBtnUI();

        // Optimistically update counter
        const counter = document.getElementById('statFollowers');
        let currentCount = parseInt(counter.textContent.replace(/,/g, '')) || 0;
        counter.textContent = (isFollowing ? currentCount + 1 : currentCount - 1).toLocaleString();

    } catch (err) {
        alert(err.message);
    } finally {
        setLoading('followBtn', false);
    }
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

// ─── Recipe Rendering ─────────────────────────────────────────────────────────

function renderUserRecipes(recipes) {
    const grid = document.getElementById('userRecipesGrid');
    if (!recipes || recipes.length === 0) {
        grid.innerHTML = '<div class="empty-state">No recipes published yet.</div>';
        grid.style.display = 'block';
        return;
    }

    grid.style.display = 'grid'; // Revert to grid if it was block
    grid.innerHTML = recipes.map(r => `
        <div class="recipe-card glass" onclick="viewRecipe('${r.id}')">
            <div class="recipe-img-container">
                <img src="${r.image_url}" alt="${r.title}">
                <div class="recipe-badges">
                    ${r.category ? `<span class="badge badge-blue">${r.category}</span>` : ''}
                </div>
            </div>
            <div class="recipe-content">
                <h3 class="recipe-title">${r.title}</h3>
                <div class="recipe-meta">
                    <span>⏱️ ${r.cooking_time || 0}m</span>
                    <span>👀 ${r.views || 0}</span>
                    <span>👍 ${r.likes || 0}</span>
                </div>
            </div>
        </div>
    `).join('');
}

// Dummy view flow for now
function viewRecipe(id) {
    alert("In a real app, this would open the recipe modal. We'll link this back to the dashboard modal system next!");
}

function getUser() { try { return JSON.parse(localStorage.getItem('ka_user')); } catch { return null; } }
function getToken() { return localStorage.getItem('ka_token'); }
