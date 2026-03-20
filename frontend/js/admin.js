/* ═══════════════════════════════════════════════════════════════
   admin.js — Admin portal: login, analytics, users, recipes, logs
   ═══════════════════════════════════════════════════════════════ */

function getAdminToken() { return localStorage.getItem('ka_admin_token'); }

async function adminFetch(url, options = {}) {
    const token = getAdminToken();
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(API + url, { ...options, headers });

    if (res.status === 401) {
        console.warn('Session expired. Redirecting to login.');
        adminLogout();
        return res;
    }

    return res;
}

function showAdminToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${{ success: '✅', error: '❌', info: 'ℹ️' }[type]}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, 3500);
}

function showAdminAlert(id, msg, type = 'error') {
    const el = document.getElementById(id); if (!el) return;
    el.className = `alert ${type}`; el.textContent = msg; el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('ka_theme', next);
    document.getElementById('adminThemeBtn').textContent = next === 'dark' ? '🌙 Dark' : '☀️ Light';
}

// ─── Admin Login ──────────────────────────────────────────────────────────────
async function adminLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('adminLoginBtn');
    btn.disabled = true; btn.querySelector('.btn-text').textContent = '⏳ Verifying...';
    try {
        const res = await fetch(`${API}/api/auth/admin-login`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: document.getElementById('adminEmail').value.trim(), password: document.getElementById('adminPassword').value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        localStorage.setItem('ka_admin_token', data.token);
        localStorage.setItem('ka_admin_user', JSON.stringify(data.user));
        document.getElementById('adminUsername').textContent = data.user.username;
        document.getElementById('adminLoginOverlay').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'flex';
        const saved = localStorage.getItem('ka_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
        document.getElementById('adminThemeBtn').textContent = saved === 'dark' ? '🌙 Dark' : '☀️ Light';
        loadAnalytics();
    } catch (err) {
        showAdminAlert('adminAlert', err.message, 'error');
    } finally {
        btn.disabled = false; btn.querySelector('.btn-text').textContent = '🛡️ Access Admin Portal';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const token = getAdminToken();
    if (token) {
        const user = JSON.parse(localStorage.getItem('ka_admin_user') || '{}');
        document.getElementById('adminUsername').textContent = user.username || 'Admin';
        document.getElementById('adminLoginOverlay').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'flex';
        const saved = localStorage.getItem('ka_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', saved);
        document.getElementById('adminThemeBtn').textContent = saved === 'dark' ? '🌙 Dark' : '☀️ Light';
        loadAnalytics();
    }
});

function adminLogout() { localStorage.removeItem('ka_admin_token'); localStorage.removeItem('ka_admin_user'); window.location.reload(); }

// ─── Section Nav ──────────────────────────────────────────────────────────────
function showAdminSection(name, navEl) {
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`admin-${name}`).classList.add('active');
    navEl.classList.add('active');
    const titles = { analytics: '📊 Analytics', users: '👥 User Management', recipes: '🍳 Recipe Management', logs: '📋 Audit Logs', feedback: '📬 Feedback Inbox' };
    document.getElementById('adminTopbarTitle').textContent = titles[name] || name;
    if (name === 'users') loadUsers();
    if (name === 'recipes') loadAdminRecipes();
    if (name === 'logs') loadAdminLogs();
    if (name === 'feedback') loadFeedbackInbox();
}

// ─── Analytics ────────────────────────────────────────────────────────────────
async function loadAnalytics() {
    try {
        const res = await adminFetch('/api/admin/analytics');
        const data = await res.json();
        document.getElementById('analyticsGrid').innerHTML = `
      <div class="analytics-card"><div class="analytics-num">${data.users?.total || 0}</div><div class="analytics-label">Total Users</div></div>
      <div class="analytics-card"><div class="analytics-num">${data.users?.admins || 0}</div><div class="analytics-label">Admins</div></div>
      <div class="analytics-card"><div class="analytics-num">${data.recipes?.total || 0}</div><div class="analytics-label">Recipes</div></div>
      <div class="analytics-card"><div class="analytics-num">${(data.recipes?.total_views || 0).toLocaleString()}</div><div class="analytics-label">Total Views</div></div>
      <div class="analytics-card"><div class="analytics-num">${(data.recipes?.total_likes || 0).toLocaleString()}</div><div class="analytics-label">Total Likes</div></div>
      <div class="analytics-card"><div class="analytics-num">${data.meal_plans?.total || 0}</div><div class="analytics-label">Meal Plans</div></div>`;
        const top = data.top_recipes || [];
        document.getElementById('topRecipesTbody').innerHTML = top.length
            ? top.map((r, i) => `<tr class="glass"><td>${i + 1}</td><td><strong>${r.title}</strong></td><td>${r.profiles?.username || '—'}</td><td>${(r.views || 0).toLocaleString()}</td><td>${(r.likes || 0).toLocaleString()}</td></tr>`).join('')
            : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3);">No recipes yet</td></tr>';
    } catch (err) { document.getElementById('analyticsGrid').innerHTML = `<div class="alert error">${err.message}</div>`; }
}

// ─── Users ────────────────────────────────────────────────────────────────────
let allUsers = [];

async function loadUsers() {
    try {
        const res = await adminFetch('/api/admin/users?limit=100');
        const data = await res.json();
        allUsers = data.users || [];
        renderUsersTable(allUsers);
    } catch (err) { document.getElementById('usersTbody').innerHTML = `<tr><td colspan="5" style="color:var(--danger);padding:20px;text-align:center;">${err.message}</td></tr>`; }
}

function renderUsersTable(users) {
    document.getElementById('usersTbody').innerHTML = users.length
        ? users.map(u => `<tr>
        <td><strong>${u.username}</strong></td>
        <td><span style="color:var(--text2); font-size: 0.85rem;">${u.email || '—'}</span></td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-orange' : 'badge-blue'}">${u.role}</span></td>
        <td style="color:var(--text3);font-size:0.82rem;">${new Date(u.created_at).toLocaleDateString()}</td>
        <td><div class="actions"><button class="btn btn-danger btn-sm" onclick="deleteUser('${u.id}','${u.username}')">Delete</button></div></td>
      </tr>`).join('')
        : '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text3);">No users found</td></tr>';
}

function filterUsers(val) { renderUsersTable(allUsers.filter(u => u.username.toLowerCase().includes(val.toLowerCase()))); }

async function deleteUser(id, username) {
    if (!confirm(`Delete user "${username}"? Cannot be undone.`)) return;
    try {
        const res = await adminFetch(`/api/admin/users/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Delete failed');
        allUsers = allUsers.filter(u => u.id !== id);
        renderUsersTable(allUsers);
        showAdminToast(`User "${username}" deleted`, 'success');
    } catch (err) { showAdminToast(err.message, 'error'); }
}

function showAddUserModal() { document.getElementById('addUserModal').style.display = 'flex'; }
function closeAddUserModal() { document.getElementById('addUserModal').style.display = 'none'; }

async function addUser() {
    const btn = document.getElementById('addUserBtn');
    btn.disabled = true; btn.textContent = '⏳ Creating...';
    try {
        const res = await adminFetch('/api/admin/users', {
            method: 'POST',
            body: JSON.stringify({ username: document.getElementById('newUsername').value.trim(), email: document.getElementById('newUserEmail').value.trim(), password: document.getElementById('newUserPassword').value, role: document.getElementById('newUserRole').value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Create failed');
        showAdminToast('User created!', 'success');
        closeAddUserModal();
        loadUsers();
    } catch (err) { showAdminAlert('addUserAlert', err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Create User'; }
}

// ─── Recipes ──────────────────────────────────────────────────────────────────
let allAdminRecipes = [];

function showAddRecipeModal() {
    document.getElementById('adminRecipeForm').reset();
    document.getElementById('addRecipeModal').style.display = 'flex';
}
function closeAddRecipeModal() { document.getElementById('addRecipeModal').style.display = 'none'; }

async function adminAddRecipe(e) {
    e.preventDefault();
    const btn = document.getElementById('adminAddRecipeBtn');
    btn.disabled = true; btn.textContent = '⏳ Publishing...';
    try {
        const ingredients = document.getElementById('adminRecipeIngredients').value.split('\n').filter(l => l.trim());
        const steps = document.getElementById('adminRecipeSteps').value.split('\n').filter(l => l.trim());
        const isFeatured = document.getElementById('adminRecipeFeatured').checked;

        const res = await adminFetch('/api/recipes', {
            method: 'POST',
            body: JSON.stringify({
                title: document.getElementById('adminRecipeTitle').value.trim(),
                category: document.getElementById('adminRecipeCategory').value,
                cuisine: document.getElementById('adminRecipeCuisine').value.trim() || 'Global',
                cooking_time: document.getElementById('adminRecipeTime').value.trim(),
                description: document.getElementById('adminRecipeDesc').value.trim(),
                ingredients,
                steps,
                is_featured: isFeatured
            }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || data.errors?.[0]?.msg || 'Publish failed');

        if (isFeatured) {
            await adminFetch(`/api/admin/recipes/${data.recipe.id}/feature`, {
                method: 'PUT',
                body: JSON.stringify({ is_featured: true }),
            });
        }

        showAdminToast('Official recipe published!', 'success');
        closeAddRecipeModal();
        loadAdminRecipes();
    } catch (err) { showAdminAlert('adminRecipeAlert', err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Publish Officially'; }
}

async function loadAdminRecipes() {
    try {
        const res = await adminFetch('/api/admin/recipes?limit=100');
        const data = await res.json();
        allAdminRecipes = data.recipes || [];
        renderAdminRecipesTable(allAdminRecipes);
    } catch (err) { document.getElementById('adminRecipesTbody').innerHTML = `<tr><td colspan="7" style="color:var(--danger);padding:20px;text-align:center;">${err.message}</td></tr>`; }
}

function renderAdminRecipesTable(recipes) {
    document.getElementById('adminRecipesTbody').innerHTML = recipes.length
        ? recipes.map(r => `<tr>
        <td><strong>${r.title}</strong></td>
        <td>${r.profiles?.username || '—'}</td>
        <td>
          <span class="badge badge-orange">${r.category || '—'}</span>
          ${r.is_featured ? '<span class="badge badge-green" style="margin-left:4px;">🌟 Featured</span>' : ''}
        </td>
        <td>${(r.views || 0).toLocaleString()}</td>
        <td>${(r.likes || 0).toLocaleString()}</td>
        <td style="color:var(--text3);font-size:0.82rem;">${new Date(r.created_at).toLocaleDateString()}</td>
        <td><div class="actions">
          <button class="btn btn-ghost btn-sm" onclick="toggleFeature('${r.id}', ${!r.is_featured})">${r.is_featured ? 'Unfeature' : '⭐ Feature'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteAdminRecipe('${r.id}',\`${r.title.replace(/`/g, '')}\`)">Delete</button>
        </div></td>
      </tr>`).join('')
        : '<tr><td colspan="7" style="text-align:center;padding:20px;color:var(--text3);">No recipes found</td></tr>';
}

function filterAdminRecipes(val) { renderAdminRecipesTable(allAdminRecipes.filter(r => r.title.toLowerCase().includes(val.toLowerCase()))); }

async function deleteAdminRecipe(id, title) {
    if (!confirm(`Delete recipe "${title}"?`)) return;
    try {
        const res = await adminFetch(`/api/admin/recipes/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        allAdminRecipes = allAdminRecipes.filter(r => r.id !== id);
        renderAdminRecipesTable(allAdminRecipes);
        showAdminToast('Recipe deleted', 'success');
    } catch (err) { showAdminToast(err.message, 'error'); }
}

async function toggleFeature(id, is_featured) {
    try {
        const res = await adminFetch(`/api/admin/recipes/${id}/feature`, {
            method: 'PUT',
            body: JSON.stringify({ is_featured }),
        });
        if (!res.ok) throw new Error('Update failed');
        showAdminToast(is_featured ? 'Recipe featured!' : 'Feature removed', 'success');
        loadAdminRecipes();
    } catch (err) { showAdminToast(err.message, 'error'); }
}

// ─── Audit Logs ───────────────────────────────────────────────────────────────
async function loadAdminLogs() {
    const container = document.getElementById('logsContainer');
    try {
        const res = await adminFetch('/api/admin/logs');
        const data = await res.json();
        const logs = data.logs || [];
        if (!logs.length) { container.innerHTML = '<p style="text-align:center;padding:30px;color:var(--text3);">No logs yet.</p>'; return; }
        container.innerHTML = logs.map(log => `
      <div class="log-row">
        <span class="log-badge log-action-${log.action}">${log.action}</span>
        <span style="flex:1;color:var(--text2);">by <strong>${log.profiles?.username || 'unknown'}</strong></span>
        <span style="font-size:0.8rem;color:var(--text3);">${log.target_id?.substring(0, 12) || '—'}</span>
        <span style="font-size:0.78rem;color:var(--text3);white-space:nowrap;">${new Date(log.created_at).toLocaleString()}</span>
      </div>`).join('');
    } catch (err) { container.innerHTML = `<p style="color:var(--danger);padding:20px;text-align:center;">${err.message}</p>`; }
}

// ─── Feedback Inbox (Instagram Style) ──────────────────────────────────────────
let activeAdminConv = null;
let adminChatInterval = null;

async function loadFeedbackInbox() {
    try {
        const res = await adminFetch('/api/chat/admin/inbox');
        if (!res.ok) throw new Error('Failed to fetch inbox');

        const threads = await res.json();
        const dmList = document.getElementById('dmList');

        if (!Array.isArray(threads) || threads.length === 0) {
            dmList.innerHTML = '<div class="dm-empty-state" style="padding:20px;">No messages yet.</div>';
            return;
        }

        dmList.innerHTML = threads.map(t => {
            const userObj = t.user || { username: 'Unknown' };
            const isActive = activeAdminConv === t.id;
            const snippet = t.last_message || 'New conversation';
            const avatarChar = userObj.username.charAt(0).toUpperCase();

            return `
                <div class="dm-thread-item ${isActive ? 'active' : ''}" onclick="selectDMThread('${t.id}', '${userObj.username}')">
                    <div class="avatar">${avatarChar}</div>
                    <div class="dm-thread-info">
                        <div class="dm-thread-name">${userObj.username}</div>
                        <div class="dm-thread-snippet">${snippet}</div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        document.getElementById('dmList').innerHTML = `<div style="color:var(--danger);padding:20px;">${err.message}</div>`;
    }
}

async function selectDMThread(id, username) {
    activeAdminConv = id;

    // UI states
    document.querySelectorAll('.dm-thread-item').forEach(el => el.classList.remove('active'));
    // Find the clicked element and activate it if it exists in the DOM
    const listItems = document.querySelectorAll('.dm-thread-item');
    listItems.forEach(item => {
        if (item.onclick && item.onclick.toString().includes(id)) {
            item.classList.add('active');
        }
    });

    document.getElementById('dmEmptyState').style.display = 'none';
    document.getElementById('dmActiveChat').style.display = 'flex';
    document.getElementById('dmActiveUsername').textContent = username;
    document.getElementById('dmActiveAvatar').textContent = username.charAt(0).toUpperCase();

    // Mobile: hide sidebar when chat is active
    if (window.innerWidth <= 480) {
        document.getElementById('dmList').parentElement.classList.add('collapsed');
    }

    const contentEl = document.getElementById('dmChatContent');
    contentEl.innerHTML = '<p style="text-align:center;padding:20px;color:var(--text3);">Loading messages...</p>';

    await loadAdminMessages();

    if (adminChatInterval) clearInterval(adminChatInterval);
    adminChatInterval = setInterval(loadAdminMessages, 4000);
}

async function loadAdminMessages() {
    if (!activeAdminConv) return;
    try {
        const res = await adminFetch(`/api/chat/messages/${activeAdminConv}`);
        if (!res.ok) return;
        const msgs = await res.json();
        const contentEl = document.getElementById('dmChatContent');
        if (!contentEl) return;

        // Check if user is near the bottom before we update the content
        const isAtBottom = contentEl.scrollHeight - contentEl.scrollTop <= contentEl.clientHeight + 100;
        const adminUser = JSON.parse(localStorage.getItem('ka_admin_user') || '{}');

        const newHtml = msgs.map(m => {
            const isMine = m.sender_id === adminUser.id;
            return `
                <div class="msg-bubble ${isMine ? 'msg-mine' : 'msg-theirs'}">
                    ${m.content}
                    <span class="msg-time">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
        }).join('');

        // Only update DOM if content changed to prevent layout thrashing and preserve selection
        if (contentEl.innerHTML !== newHtml) {
            contentEl.innerHTML = newHtml;

            // Scroll to bottom if we were already there
            if (isAtBottom) {
                setTimeout(() => {
                    contentEl.scrollTop = contentEl.scrollHeight;
                }, 10);
            }
        }
    } catch (err) {
        console.error('Failed to load messages:', err);
    }
}

async function adminSendMessage() {
    const input = document.getElementById('dmChatInput');
    const content = input.value.trim();
    if (!content || !activeAdminConv) return;

    try {
        const res = await adminFetch('/api/chat/messages', {
            method: 'POST',
            body: JSON.stringify({ conversation_id: activeAdminConv, content })
        });
        if (!res.ok) throw new Error('Send failed');
        input.value = '';
        await loadAdminMessages();
        // Force scroll to bottom on sent message
        const contentEl = document.getElementById('dmChatContent');
        if (contentEl) contentEl.scrollTop = contentEl.scrollHeight;

        loadFeedbackInbox();
    } catch (err) {
        showAdminToast(err.message, 'error');
    }
}

async function sendQuickReply(text) {
    if (!activeAdminConv) return;
    try {
        const res = await adminFetch('/api/chat/messages', {
            method: 'POST',
            body: JSON.stringify({ conversation_id: activeAdminConv, content: text })
        });
        if (!res.ok) throw new Error('Quick reply failed');
        await loadAdminMessages();
        // Force scroll to bottom on quick reply
        const contentEl = document.getElementById('dmChatContent');
        if (contentEl) contentEl.scrollTop = contentEl.scrollHeight;

        loadFeedbackInbox();
        showAdminToast('Quick reply sent!', 'success');
    } catch (err) {
        showAdminToast(err.message, 'error');
    }
}

function closeAdminChat() {
    activeAdminConv = null;
    if (adminChatInterval) clearInterval(adminChatInterval);
    document.getElementById('dmEmptyState').style.display = 'flex';
    document.getElementById('dmActiveChat').style.display = 'none';

    // Mobile: show sidebar when chat is closed
    if (window.innerWidth <= 480) {
        document.getElementById('dmList').parentElement.classList.remove('collapsed');
    }
}

// ─── Community Seeding Utility ────────────────────────────────────────────────
async function seedCommunityFeed() {
    const btn = document.getElementById('seedBtn');
    if (!confirm('This will seed 4 placeholder posts into the community feed. Continue?')) return;

    btn.disabled = true;
    btn.textContent = '⏳ Seeding...';

    const placeholders = [
        {
            image_url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=500',
            caption: 'Fresh morning salad! 🥗 #healthy #zero-waste',
        },
        {
            image_url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=500',
            caption: 'Pantry raid pasta night! Used up the last of my sun-dried tomatoes. 🍝',
        },
        {
            image_url: 'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&q=80&w=500',
            caption: 'Homemade pizza with fresh basil from my balcony garden. 🍕✨',
        },
        {
            image_url: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&q=80&w=500',
            caption: 'Quick fridge-cleanout stir fry. Turned out better than expected! 🥢🔥',
        }
    ];

    try {
        let successCount = 0;
        for (const post of placeholders) {
            const res = await adminFetch('/api/social/posts', {
                method: 'POST',
                body: JSON.stringify(post)
            });
            if (res && res.ok) successCount++;
        }
        showAdminToast(`Successfully seeded ${successCount} community posts!`, 'success');
        if (typeof loadSocialFeed === 'function') loadSocialFeed();
    } catch (err) {
        showAdminToast('Seeding failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = '✨ Seed Now';
    }
}
