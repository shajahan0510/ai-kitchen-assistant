console.log('!!! AI KITCHEN SYSTEM LOADED - VERSION: 5.0.3 (CACHE BUSTER V3) !!!');
/* ═══════════════════════════════════════════════════════════════
   dashboard.js — Main dashboard: section nav, ingredients, AI,
   fridge scanner, trending, recipe modal, upload recipe
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    initDashboard();
});

function initDashboard() {
    const user = getUser();
    if (user) {
        document.getElementById('sidebarUsername').innerHTML = (user.username || user.email) + (checkProStatus() ? ' <span class="pro-badge">PRO</span>' : '');
        document.getElementById('sidebarRole').textContent = user.role === 'admin' ? '⭐ Admin' : '🍴 Member';
        const avatarEl = document.getElementById('sidebarAvatar');
        if (user.avatar_url) {
            avatarEl.innerHTML = `<img src="${user.avatar_url}" alt="Avatar" />`;
        } else {
            avatarEl.innerHTML = `<span>${(user.username || user.email || 'U')[0].toUpperCase()}</span>`;
        }
        // Show bio if available
        const bioEl = document.getElementById('sidebarBio');
        if (bioEl && user.bio) {
            bioEl.textContent = user.bio;
            bioEl.style.display = 'block';
        } else if (bioEl) {
            bioEl.style.display = 'none';
        }
    }
    const saved = localStorage.getItem('ka_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    document.getElementById('themeBtn').textContent = saved === 'dark' ? '🌙 Dark' : '☀️ Light';
    loadStats();
    loadTrending();

    // Wire up drag-and-drop on the fridge scanner dropzone
    const dropZone = document.getElementById('scanDropZone');
    if (dropZone) {
        dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
        dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
        dropZone.addEventListener('drop', e => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            const file = e.dataTransfer?.files?.[0];
            if (file && file.type.startsWith('image/')) {
                const input = document.getElementById('scanFileInput');
                const dt = new DataTransfer();
                dt.items.add(file);
                input.files = dt.files;
                handleScanFile(input);
            }
        });
    }
}

// ─── Section Navigation ───────────────────────────────────────────────────────
const sectionTitles = {
    suggest: 'AI Suggested Recipes', discover: 'Community Feed',
    scanner: 'Ingredient Scanner', snaprecipe: 'Snap-to-Recipe',
    pantry: 'Smart Pantry',
    trending: 'Trending Recipes', planner: 'Meal Planner',
    grocery: 'Grocery List', upload: 'Upload Recipe',
    chatbot: 'Chef Chatbot', messages: 'Messages',
    nutrition: 'Nutrition Analytics',
};

function showSection(name, navEl) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`section-${name}`).classList.add('active');
    navEl.classList.add('active');
    document.getElementById('topbarTitle').textContent = sectionTitles[name] || name;
    // Show stats row only on the AI Suggest section
    const statsRow = document.getElementById('statsRow');
    if (statsRow) statsRow.style.display = name === 'suggest' ? '' : 'none';
    if (name === 'trending') loadTrending();
    if (name === 'planner') { renderCalendar(); loadMealPlans(); }
    if (name === 'grocery') { loadGroceryList(); updateBudgetBar(); }
    if (name === 'messages') initChat();
    if (name === 'chatbot') initAIChat();
    if (name === 'discover') loadSocialFeed();
    if (name === 'pantry') loadPantryList();
    if (name === 'nutrition') loadNutritionDashboard();
    // Auto-close sidebar on mobile after navigation
    if (window.innerWidth < 1024) { closeSidebar(); }
}

function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    const overlay = document.getElementById('sidebarOverlay');
    if (overlay) overlay.classList.remove('visible');
    document.body.style.overflow = '';
}

function toggleSidebar() {
    const isOpen = document.getElementById('sidebar').classList.contains('open');
    isOpen ? closeSidebar() : openSidebar();
}

function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', next);
    localStorage.setItem('ka_theme', next);
    document.getElementById('themeBtn').textContent = next === 'dark' ? '🌙 Dark' : '☀️ Light';
}

// ─── Stats ────────────────────────────────────────────────────────────────────
async function loadStats() {
    const user = getUser();
    try {
        const [userRecipesRes, planner, grocery, profileRes] = await Promise.all([
            apiFetch(`/api/recipes?limit=1&author_id=${user.id}`).then(r => r.json()),
            apiFetch('/api/planner').then(r => r.json()),
            apiFetch('/api/grocery').then(r => r.json()),
            apiFetch('/api/auth/me').then(r => r.json())
        ]);

        const userRecipeCount = userRecipesRes.total || 0;
        const xp = profileRes.user?.xp || 0;
        const rankPoints = profileRes.user?.rank_points || 0;

        document.getElementById('statRecipes').textContent = userRecipeCount;
        document.getElementById('statPlans').textContent = planner.plans?.length || 0;
        document.getElementById('statGrocery').textContent = grocery.list?.items?.length || 0;
        document.getElementById('statLikes').textContent = xp;

        // Calculate Chef Rank from XP
        let rank = '🍴 Novice';
        let xpForNext = 100;
        if (xp >= 1000) { rank = '👨‍🍳 Executive Chef'; xpForNext = 5000; }
        else if (xp >= 500) { rank = '🍳 Chef de Partie'; xpForNext = 1000; }
        else if (xp >= 100) { rank = '🏠 Home Cook'; xpForNext = 500; }

        if (user.role === 'admin') rank = '⭐ Admin';
        document.getElementById('sidebarRole').innerHTML = `
            ${rank}
            <div class="xp-bar-container">
                <div class="xp-bar-fill" style="width: ${Math.min((xp % xpForNext) / xpForNext * 100, 100)}%"></div>
            </div>
            <small style="font-size:0.6rem;opacity:0.7;">${xp} XP · ${xpForNext - (xp % xpForNext)} to next rank</small>
        `;
    } catch (err) {
        console.warn('[loadStats] Failed to load stats:', err.message);
        showToast('Could not load stats. Check server connection.', 'error');
    }
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${{ success: '✅', error: '❌', info: 'ℹ️' }[type]}</span><span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, 3500);
}

function showProfileAlert(msg, type = 'error') {
    const el = document.getElementById('profileAlert');
    if (!el) return;
    el.className = `alert ${type}`; el.textContent = msg; el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 5000);
}

// ─── Ingredient Chips ─────────────────────────────────────────────────────────
let ingredients = [];

document.getElementById('ingredientInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addIngredient(); }
});

function addIngredient() {
    const input = document.getElementById('ingredientInput');
    const val = input.value.replace(',', '').trim();
    if (!val || ingredients.includes(val.toLowerCase())) { input.value = ''; return; }
    ingredients.push(val.toLowerCase());
    renderChips('chipContainer', ingredients, removeIngredient);
    input.value = '';
}

function removeIngredient(idx) {
    ingredients.splice(idx, 1);
    renderChips('chipContainer', ingredients, removeIngredient);
}

function clearIngredients() {
    ingredients = [];
    renderChips('chipContainer', ingredients, removeIngredient);
}

function renderChips(containerId, items, onRemove) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!items.length) {
        container.innerHTML = '<span style="color:var(--text3);font-size:0.82rem;">No ingredients yet — type above and press Enter</span>';
        return;
    }
    container.innerHTML = items.map((item, i) =>
        `<span class="ingredient-chip">${item}
            <button class="ingredient-chip-remove" onclick="${onRemove.name}(${i})" title="Remove">✕</button>
        </span>`
    ).join('');
}

// ─── AI Suggest ───────────────────────────────────────────────────────────────
async function suggestRecipes() {
    if (!ingredients.length) { showToast('Add at least one ingredient first!', 'error'); return; }
    const btn = document.getElementById('suggestBtn');
    btn.disabled = true; btn.textContent = '⏳ Thinking...';
    document.getElementById('suggestResults').innerHTML = '<div class="spinner"></div><p class="loading-text">AI is crafting recipes for you...</p>';
    try {
        const res = await apiFetch('/api/ai/suggest', { method: 'POST', body: JSON.stringify({ ingredients }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'AI failed');
        renderRecipeCards('suggestResults', data.recipes, true);
        loadTrending(); // Refresh trending list to show the new AI-added recipes
    } catch (err) {
        document.getElementById('suggestResults').innerHTML = `<div class="alert error">${err.message}</div>`;
    } finally {
        btn.disabled = false; btn.textContent = '✨ Suggest Recipes';
    }
}

// ─── Recipe Image Handlers ──────────────────────────────────────────────────
window.handleRecipeImageError = function(img, title, category) {
    console.warn(`[AI KITCHEN] Image failed for: ${title}. Trying fallbacks...`);
    // First fallback: LoremFlickr (multi-keyword)
    if (!img.dataset.triedFallback) {
        img.dataset.triedFallback = 'true';
        const keywords = title.toLowerCase().replace(/ and | with | style | type/g, ',').split(' ').slice(0, 3).join(',');
        img.src = `https://loremflickr.com/400/300/food,${encodeURIComponent(keywords)}/all`;
    } else {
        // Final fallback: Hide image and let the emoji shine
        img.style.display = 'none';
    }
};

// ─── Recipe Cards ─────────────────────────────────────────────────────────────
function renderRecipeCards(containerId, recipes, isAI = false) {
    const container = document.getElementById(containerId);
    if (!recipes?.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽️</div><p>No recipes found.</p></div>';
        return;
    }
    container.innerHTML = recipes.map(r => `
      <div class="recipe-card glass" onclick="openRecipeModal('${encodeCardData(r, isAI)}')">
        ${r.image_url ? `<img src="${r.image_url}" class="recipe-img" alt="${r.title}">` : `
        <div class="recipe-img" style="background:var(--bg3);position:relative;overflow:hidden;height:170px;">
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:2rem;opacity:0.3;z-index:0;">${getCategoryEmoji(r.category)}</div>
            <img src="https://loremflickr.com/400/300/meal,${encodeURIComponent(r.title.toLowerCase().replace(/style|dish|bowl|plate|recipe| and | with | type/g, '').trim().split(' ').slice(0, 3).join(','))}/all" 
                 style="width:100%;height:100%;object-fit:cover;position:relative;z-index:1;opacity:0;transition:opacity 0.8s ease;" 
                 onload="this.style.opacity=1" 
                 onerror="handleRecipeImageError(this, '${r.title.replace(/'/g, "\\'")}', '${r.category || ""}')" 
                 alt="Image of ${r.title}">
        </div>`}
        <div class="recipe-content">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
            <h4 style="font-size:1.05rem;line-height:1.3;margin:0;">${r.title}</h4>
            ${r.difficulty ? `<span class="badge ${r.difficulty === 'Easy' ? 'badge-green' : r.difficulty === 'Medium' ? 'badge-orange' : 'badge-blue'}">${r.difficulty}</span>` : ''}
          </div>
          <div class="recipe-meta" style="margin-bottom:12px;">
            <span class="badge badge-orange">${r.category || 'Selection'}</span>
            ${r.cuisine ? `<span class="badge badge-blue">${r.cuisine}</span>` : ''}
          </div>
          ${!isAI && r.author ? `
            <div class="recipe-author" onclick="event.stopPropagation(); window.location.hash='profile'; /* Need to wire profile view */" style="display:flex;align-items:center;gap:6px;margin-bottom:12px;cursor:pointer;">
              <img src="${r.author.avatar_url || 'https://images.unsplash.com/photo-1577214190018-40a603f59316?w=100&h=100&fit=crop'}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;">
              <span style="font-size:0.8rem;color:var(--text2);font-weight:600;">${r.author.username || 'Chef'}</span>
            </div>
          ` : ''}
          <p class="recipe-desc" style="font-size:0.85rem;color:var(--text3);margin-bottom:16px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${r.description || 'A delicious dish crafted in the AI Kitchen.'}</p>
          <div class="recipe-footer" style="display:flex;justify-content:space-between;align-items:center;padding-top:12px;border-top:1px solid var(--glass-border);gap:12px;">
            <div class="recipe-stats" style="display:flex;gap:8px;font-size:0.75rem;color:var(--text3);">
              <span>⏱️ ${r.cooking_time || '?'}</span>
              ${!isAI ? `<span>👁️ ${r.views || 0}</span>` : ''}
            </div>
            <button class="btn btn-primary btn-sm" style="padding:6px 12px; font-size:0.75rem;">Pick Recipe</button>
            ${!isAI ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); likeRecipe('${r.id}', this)" style="padding:4px 8px;">❤️</button>` : ''}
          </div>
        </div>
      </div>
    `).join('');
}

function encodeCardData(r, isAI) {
    return btoa(unescape(encodeURIComponent(JSON.stringify({ ...r, isAI }))));
}

function getCategoryEmoji(cat) {
    return { Breakfast: '🥞', Lunch: '🥗', Dinner: '🍝', Snack: '🧆', Dessert: '🍰' }[cat] || '🍽️';
}

// ─── Recipe Modal ─────────────────────────────────────────────────────────────
let currentRecipeId = null;

function openRecipeModal(encoded) {
    const r = JSON.parse(decodeURIComponent(escape(atob(encoded))));
    currentRecipeId = r.id || null;
    document.getElementById('modalRecipeTitle').textContent = r.title;

    const ing = Array.isArray(r.ingredients) ? r.ingredients : JSON.parse(r.ingredients || '[]');
    const steps = Array.isArray(r.steps) ? r.steps : JSON.parse(r.steps || '[]');
    const nut = r.nutrition || {};

    document.getElementById('modalRecipeBody').innerHTML = `
    ${r.image_url ? `<img src="${r.image_url}" alt="${r.title}" style="width:100%;height:220px;object-fit:cover;border-radius:12px;margin-bottom:16px;" />` : ''}
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;">
      ${r.category ? `<span class="badge badge-orange">${r.category}</span>` : ''}
      ${r.cuisine ? `<span class="badge badge-blue">${r.cuisine}</span>` : ''}
      ${r.cooking_time ? `<span class="badge badge-blue">⏱️ ${r.cooking_time}</span>` : ''}
      ${r.difficulty ? `<span class="badge badge-green">${r.difficulty}</span>` : ''}
      ${r.servings ? `<span class="badge" style="background:var(--bg3);color:var(--text2);">🍽️ ${r.servings} servings</span>` : ''}
    </div>
    ${r.description ? `<p style="color:var(--text2);font-size:0.9rem;margin-bottom:16px;">${r.description}</p>` : ''}
    
    <div class="scale-slider-container">
        <label>Adjust Servings</label>
        <input type="range" min="1" max="12" value="${r.servings || 2}" oninput="document.getElementById('scaleValDisplay').textContent=this.value" onchange="smartScaleRecipe(this.value)">
        <span id="scaleValDisplay" class="scale-value">${r.servings || 2}</span>
    </div>
    <div id="scaleInfo"></div>

    ${nut.calories ? `<div class="nutrition-grid" style="margin-top:16px;">
      <div class="nutrition-item"><div class="nutrition-value">${nut.calories}</div><div class="nutrition-label">Calories</div></div>
      <div class="nutrition-item"><div class="nutrition-value">${nut.protein}</div><div class="nutrition-label">Protein</div></div>
      <div class="nutrition-item"><div class="nutrition-value">${nut.carbs}</div><div class="nutrition-label">Carbs</div></div>
      <div class="nutrition-item"><div class="nutrition-value">${nut.fat}</div><div class="nutrition-label">Fat</div></div>
    </div>` : ''}
    <h4 style="font-weight:700;margin-bottom:10px;">🥗 Ingredients</h4>
    <ul id="modalIngredients" style="list-style:none;display:flex;flex-wrap:wrap;gap:8px;margin-bottom:18px;">
      ${ing.map(i => `<li class="badge badge-orange">${i} <button class="magic-swap-btn" onclick="getSmartSwap('${r.title.replace(/'/g, "\\'")}', '${i}', this)">🪄 Swap</button></li>`).join('')}
    </ul>
    <div id="swapTipContainer"></div>
    <h4 style="font-weight:700;margin-bottom:12px;">📝 Instructions</h4>
    <ol id="modalSteps" class="steps-list">${steps.map((s, idx) => `<li><span class="step-num">${idx + 1}</span><span>${s}</span></li>`).join('')}</ol>
    ${currentRecipeId ? `<div style="margin-top:20px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="openPlanModal('${currentRecipeId}','${r.title.replace(/'/g, "\\'")}')">📅 Plan This</button>
      <button class="btn btn-accent" onclick='startCookingMode(${JSON.stringify(r).replace(/'/g, "&apos;")})'>🎤 Voice Chef</button>
      <button class="btn btn-secondary" onclick='openCookingTimer(${JSON.stringify(steps).replace(/'/g, "&apos;")})'>⏱️ Timer</button>
      <button class="btn btn-ghost" onclick="shareToSocial('${currentRecipeId}', '${r.image_url || ''}')">📸 Share</button>
      <button class="btn btn-ghost" onclick="likeRecipeModal('${currentRecipeId}')">❤️ Like</button>
      <button class="btn btn-ghost" onclick="remixRecipe('${currentRecipeId}')">🔄 Remix</button>
    </div>` : ''}`;

    document.getElementById('recipeModal').style.display = 'flex';
}

function closeRecipeModal() { document.getElementById('recipeModal').style.display = 'none'; }

// ─── Edit Profile Tabs ────────────────────────────────────────────────────────
function switchEditTab(tab) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));

    const activeBtn = Array.from(document.querySelectorAll('.modal-tab')).find(b => b.textContent.toLowerCase().includes(tab));
    if (activeBtn) activeBtn.classList.add('active');

    const activeContent = document.getElementById(`tab-${tab}`);
    if (activeContent) activeContent.classList.add('active');
}

async function changePassword() {
    const newPass = document.getElementById('newPassword').value;
    const confirmPass = document.getElementById('confirmPassword').value;
    const btn = document.getElementById('changePassBtn');

    if (!newPass || newPass.length < 8) {
        showSecurityAlert('Password must be at least 8 characters', 'error');
        return;
    }
    if (newPass !== confirmPass) {
        showSecurityAlert('Passwords do not match', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = '⏳ Updating...';

    try {
        const res = await apiFetch('/api/auth/profile', {
            method: 'PUT',
            body: JSON.stringify({ password: newPass })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');

        showSecurityAlert('Password updated successfully!', 'success');
        document.getElementById('newPassword').value = '';
        showSecurityAlert('Password updated successfully!', 'success');
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    } catch (err) {
        showSecurityAlert(err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Change Password';
    }
}

function showSecurityAlert(msg, type) {
    const el = document.getElementById('securityAlert');
    el.className = `alert ${type}`;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ─── Social & Mixing ─────────────────────────────────────────────────────────

async function remixRecipe(recipeId) {
    if (!confirm('Remix this recipe? This will create a copy that you can edit.')) return;

    closeRecipeModal();
    // Use an overlay loader since we don't have a specific button context
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner"></div><p style="margin-top:16px;font-weight:600;color:white;">Creating your remix...</p>';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;';
    document.body.appendChild(overlay);

    try {
        const res = await apiFetch(`/api/recipes/${recipeId}/remix`, { method: 'POST' });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Failed to remix recipe');

        showToast('Recipe remixed! You can now edit your version.', 'success');

        // Refresh the 'Discover' feed which defaults to newest first
        document.querySelector('[data-section="discover"]').click();

    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        document.body.removeChild(overlay);
    }
}

function shareToSocial(recipeId, imageUrl) {
    const url = window.location.origin + window.location.pathname + `?recipe=${recipeId}`;
    if (navigator.share) {
        navigator.share({
            title: 'AI Kitchen Assistant Recipe',
            text: 'Check out this awesome recipe I found!',
            url: url
        }).catch(err => console.log('Error sharing:', err));
    } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copied to clipboard! 📋', 'success');
        }).catch(() => {
            showToast('Could not copy link.', 'error');
        });
    }
}

// ─── Custom Avatar Handling ──────────────────────────────────────────────────
function showSecurityAlert(msg, type = 'error') {
    const el = document.getElementById('securityAlert');
    el.textContent = msg;
    el.className = `alert alert-${type}`;
    el.style.display = 'block';
    setTimeout(() => { if (el) el.style.display = 'none'; }, 5000);
}

// ─── Trending ─────────────────────────────────────────────────────────────────
let allRecipes = [];
const CATEGORIES = ['All', 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert'];

async function loadTrending(category = '', search = '') {
    const grid = document.getElementById('trendingGrid');
    grid.innerHTML = '<div class="spinner"></div>';

    // Render category filter chips if not yet rendered
    const catContainer = document.getElementById('trendingCategories');
    if (catContainer && !catContainer.hasChildNodes()) {
        catContainer.innerHTML = CATEGORIES.map(c =>
            `<button type="button" class="btn btn-ghost btn-sm tag-btn ${c === 'All' ? 'active' : ''}"
                onclick="filterRecipes('${c === 'All' ? '' : c}', this)">${c}</button>`
        ).join('');
    }

    try {
        let url = '/api/recipes?sort=views&order=desc&limit=20';
        if (category) url += `&category=${category}`;
        if (search) url += `&search=${encodeURIComponent(search)}`;
        const res = await apiFetch(url);
        const data = await res.json();
        allRecipes = data.recipes || [];
        renderRecipeCards('trendingGrid', allRecipes, false);
    } catch (err) {
        console.warn('[loadTrending] Failed:', err.message);
        grid.innerHTML = `<div class="alert alert-error" style="margin:8px 0;">⚠️ Failed to load recipes — check your server connection.</div>`;
    }
}

function filterRecipes(category, btn) {
    document.querySelectorAll('.tag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    loadTrending(category, document.getElementById('recipeSearch')?.value || '');
}

let searchVoiceRec = null;

function toggleVoiceSearch() {
    const btn = document.getElementById('voiceSearchBtn');
    const input = document.getElementById('recipeSearch');

    if (btn.classList.contains('listening')) {
        if (searchVoiceRec) searchVoiceRec.stop();
        return;
    }

    btn.classList.add('listening');
    showToast('Listening... 🎤', 'info');

    searchVoiceRec = startSearchVoice(
        (transcript, isFinal) => {
            input.value = transcript;
            if (isFinal) {
                searchRecipes(transcript);
                btn.classList.remove('listening');
            }
        },
        () => {
            btn.classList.remove('listening');
        }
    );
}

let searchTimeout;
function searchRecipes(val) {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadTrending('', val), 400);
}

// ─── Surprise Me ──────────────────────────────────────────────────────────────
async function surpriseMe() {
    if (!allRecipes.length) await loadTrending();
    if (!allRecipes.length) return;
    const random = allRecipes[Math.floor(Math.random() * allRecipes.length)];
    openRecipeModal(encodeCardData(random, false));
    showToast(`Surprise! 🎠 How about some "${random.title}"?`, 'info');
}

let activeTag = 'All';
function filterByTag(tag, btn) {
    // Clear active state from all category tag buttons
    document.querySelectorAll('#trendingCategories .tag-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTag = tag;

    if (tag === 'All') {
        renderRecipeCards('trendingGrid', allRecipes, false);
    } else {
        const filtered = allRecipes.filter(r =>
            r.category?.toLowerCase() === tag.toLowerCase() ||
            (r.tags || []).some(t => t.toLowerCase() === tag.toLowerCase())
        );
        renderRecipeCards('trendingGrid', filtered, false);
    }
}

async function likeRecipe(recipeId, btn) {
    btn.disabled = true;
    try {
        const res = await apiFetch(`/api/recipes/${recipeId}/like`, { method: 'POST' });
        const data = await res.json();
        showToast(data.liked ? 'Liked! ❤️' : 'Like removed', 'success');
    } catch (_) { showToast('Could not like recipe', 'error'); }
    finally { btn.disabled = false; }
}

async function likeRecipeModal(id) {
    try {
        const res = await apiFetch(`/api/recipes/${id}/like`, { method: 'POST' });
        const data = await res.json();
        showToast(data.liked ? 'Liked! ❤️' : 'Like removed', 'success');
    } catch (_) { showToast('Could not like recipe', 'error'); }
}

// ─── Fridge Scanner ───────────────────────────────────────────────────────────
let scanBase64 = null, scanMime = null, detectedIngredients = [];

function handleScanFile(input) {
    const file = input.files[0]; if (!file) return;
    scanMime = file.type;
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        scanBase64 = dataUrl.split(',')[1];
        document.getElementById('scanPreviewImg').src = dataUrl;
        document.getElementById('scanDropZone').style.display = 'none';
        document.getElementById('scanPreviewBox').style.display = 'block';
        document.getElementById('detectedIngredients').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

const dropZone = document.getElementById('scanDropZone');
if (dropZone) {
    ['dragenter', 'dragover'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.add('drag-over'); }));
    ['dragleave', 'drop'].forEach(e => dropZone.addEventListener(e, ev => { ev.preventDefault(); dropZone.classList.remove('drag-over'); }));
    dropZone.addEventListener('drop', (e) => {
        const file = e.dataTransfer.files[0];
        if (file) { const dt = new DataTransfer(); dt.items.add(file); document.getElementById('scanFileInput').files = dt.files; handleScanFile(document.getElementById('scanFileInput')); }
    });
}

async function scanFridge() {
    if (!scanBase64) return;
    const btn = document.getElementById('scanBtn');
    btn.disabled = true; btn.textContent = '🔍 Analyzing...';
    try {
        const res = await apiFetch('/api/ai/scan-fridge', { method: 'POST', body: JSON.stringify({ image: scanBase64, mimeType: scanMime }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Scan failed');
        detectedIngredients = data.ingredients || [];
        const chips = document.getElementById('detectedChips');
        chips.innerHTML = detectedIngredients.map((ing, i) =>
            `<span class="chip">${ing}<button class="chip-remove" onclick="detectedIngredients.splice(${i},1);this.closest('.chip').remove()">✕</button></span>`
        ).join('');
        document.getElementById('detectedIngredients').style.display = 'block';
        showToast(`Detected ${detectedIngredients.length} ingredients!`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '🔍 Detect Ingredients'; }
}

async function suggestFromFridge() {
    ingredients = [...detectedIngredients];
    renderChips('chipContainer', ingredients, removeIngredient);
    showSection('suggest', document.querySelector('[data-section="suggest"]'));
    await suggestRecipes();
}

function resetScanner() {
    scanBase64 = null; scanMime = null; detectedIngredients = [];
    document.getElementById('scanDropZone').style.display = 'block';
    document.getElementById('scanPreviewBox').style.display = 'none';
    document.getElementById('detectedIngredients').style.display = 'none';
    document.getElementById('scanFileInput').value = '';
}

// ─── Upload Recipe ─────────────────────────────────────────────────────────────
function previewRecipeImage(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const preview = document.getElementById('recipeImgPreview');
        preview.src = e.target.result; preview.style.display = 'block';
        document.getElementById('recipeImgZone').innerHTML = '<p style="color:var(--success);">✅ Image selected</p>';
    };
    reader.readAsDataURL(file);
}

async function uploadRecipe(e) {
    e.preventDefault();
    const btn = document.getElementById('uploadRecipeBtn');
    btn.disabled = true; btn.textContent = '⏳ Uploading...';
    try {
        const formData = new FormData();
        formData.append('title', document.getElementById('recipeTitle').value.trim());
        formData.append('description', document.getElementById('recipeDescription').value.trim());
        formData.append('category', document.getElementById('recipeCategory').value);
        formData.append('cooking_time', document.getElementById('recipeCookTime').value.trim());
        formData.append('servings', document.getElementById('recipeServings').value || '2');
        formData.append('ingredients', JSON.stringify(document.getElementById('recipeIngredients').value.trim().split('\n').filter(Boolean)));
        formData.append('steps', JSON.stringify(document.getElementById('recipeSteps').value.trim().split('\n').filter(Boolean)));
        
        const imgInput = document.getElementById('recipeImgInput');
        const imgFile = imgInput ? imgInput.files[0] : null;
        if (imgFile) formData.append('image', imgFile);

        const res = await fetch('/api/recipes', { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        const alertEl = document.getElementById('uploadAlert');
        alertEl.className = 'alert success'; alertEl.textContent = '✅ Recipe published!'; alertEl.style.display = 'block';
        document.getElementById('uploadRecipeForm').reset();
        document.getElementById('recipeImgPreview').style.display = 'none';
        showToast('Recipe published! 🎉', 'success');
    } catch (err) {
        const alertEl = document.getElementById('uploadAlert');
        alertEl.className = 'alert error'; alertEl.textContent = err.message; alertEl.style.display = 'block';
    } finally { btn.disabled = false; btn.textContent = '📤 Publish Recipe'; }
}

// ─── Plan Modal Bridge ────────────────────────────────────────────────────────
function openPlanModal(recipeId, recipeTitle) {
    closeRecipeModal();
    window._preselectedRecipeId = recipeId;
    showSection('planner', document.querySelector('[data-section="planner"]'));
    showToast(`Use the planner to assign "${recipeTitle}" to a date`, 'info');
}
// ─── Profile Management ──────────────────────────────────────────────────────
function openEditProfileModal() {
    const user = getUser();
    document.getElementById('editUsername').value = user.username || '';
    document.getElementById('editAvatarUrl').value = user.avatar_url || '';
    document.getElementById('editBio').value = user.bio || '';

    // Set preferences
    const prefs = user.preferences || {};
    const tags = document.querySelectorAll('#prefTags .pref-tag');
    tags.forEach(t => {
        if (prefs.diet === t.textContent || (Array.isArray(prefs.diet) && prefs.diet.includes(t.textContent))) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    updateAvatarPreview(user.avatar_url);
    document.getElementById('editProfileModal').style.display = 'flex';
}

function closeEditProfileModal() { document.getElementById('editProfileModal').style.display = 'none'; }

function updateAvatarPreview(url) {
    const preview = document.getElementById('profileAvatarPreview');
    if (url && url.trim()) {
        preview.innerHTML = `<img src="${url}" alt="Preview" />`;
        preview.style.background = 'none';
    } else {
        const user = getUser();
        preview.innerHTML = (user.username || user.email || 'U')[0].toUpperCase();
        preview.style.background = 'linear-gradient(135deg, var(--primary), var(--secondary))';
    }
}

function setPresetAvatar(url) {
    document.getElementById('editAvatarUrl').value = url;
    updateAvatarPreview(url);
    // Visual feedback for selected preset
    document.querySelectorAll('.avatar-preset-btn').forEach(btn => {
        if (btn.firstChild.src === url) btn.style.borderColor = 'var(--primary)';
        else btn.style.borderColor = 'transparent';
    });
}

async function handleCustomAvatar(input) {
    const file = input.files[0];
    if (!file) return;

    // Show local preview immediately
    const reader = new FileReader();
    reader.onload = (e) => {
        updateAvatarPreview(e.target.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    const btn = document.querySelector('.custom-avatar-upload button');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '⏳ Uploading...';

    const formData = new FormData();
    formData.append('avatar', file);

    try {
        const res = await fetch(`${window.API}/api/auth/profile-picture`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('ka_token')}` },
            body: formData
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        document.getElementById('editAvatarUrl').value = data.avatar_url;
        showToast('Avatar uploaded! 🎉', 'success');

        // Update local storage user object if needed, but saveProfile will handle full sync
    } catch (err) {
        console.error('[AvatarUpload]', err);
        showToast(err.message || 'Avatar upload failed', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function saveProfile() {
    const btn = document.getElementById('saveProfileBtn');
    btn.disabled = true; btn.textContent = '⏳ Saving...';

    const diet = Array.from(document.querySelectorAll('#prefTags .pref-tag.active')).map(t => t.textContent);

    try {
        const res = await apiFetch('/api/auth/profile', {
            method: 'PUT',
            body: JSON.stringify({
                username: document.getElementById('editUsername').value.trim(),
                avatar_url: document.getElementById('editAvatarUrl').value.trim(),
                bio: document.getElementById('editBio').value.trim(),
                preferences: { diet }
            })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');

        // Update local storage
        const user = getUser();
        const newUser = { ...user, ...data.user };
        localStorage.setItem('ka_user', JSON.stringify(newUser));

        // Refresh UI
        initDashboard();
        showToast('Profile updated!', 'success');
        closeEditProfileModal();
    } catch (err) {
        console.error('[SaveProfile]', err);
        showProfileAlert(err.message || 'Update failed', 'error');
    } finally {
        btn.disabled = false; btn.textContent = 'Save Changes';
    }
}

async function getSmartSwap(recipeTitle, ingredient, btn) {
    const tipContainer = document.getElementById('swapTipContainer');
    tipContainer.innerHTML = '<div class="spinner"></div> Finding alternatives...';
    try {
        const res = await apiFetch('/api/ai/substitute', {
            method: 'POST',
            body: JSON.stringify({ recipeTitle, ingredient })
        });
        const { tips } = await res.json();
        tipContainer.innerHTML = '<div class="magic-swap-tip">✨ <strong>Substitute for ' + ingredient + ':</strong><br>' + tips.replace(/\n/g, '<br>') + '</div>';
    } catch (err) {
        tipContainer.innerHTML = '<div class="alert error">AI is busy. Try swapping later!</div>';
    }
}

async function shareToSocial(recipeId, imageUrl) {
    if (!confirm('Share this recipe to the Discovery feed?')) return;
    try {
        const res = await apiFetch('/api/social/posts', {
            method: 'POST',
            body: JSON.stringify({
                recipe_id: recipeId,
                image_url: imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500',
                caption: 'Check out this amazing recipe I found!'
            })
        });
        if (res.ok) {
            showToast('Post shared to Discovery feed! 🎉 (+50 XP)', 'success');
            loadStats();
        }
    } catch (err) {
        showToast('Could not share post', 'error');
    }
}

// ─── Phase 14: Snap-to-Recipe (Image Reverse-Engineering) ─────────────────
let snapBase64 = null, snapMime = null;

function handleSnapFile(input) {
    const file = input.files[0]; if (!file) return;
    snapMime = file.type;
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        snapBase64 = dataUrl.split(',')[1];
        document.getElementById('snapPreviewImg').src = dataUrl;
        document.getElementById('snapDropZone').style.display = 'none';
        document.getElementById('snapPreviewBox').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

async function reverseEngineerImage() {
    if (!snapBase64) return;
    const btn = document.getElementById('snapBtn');
    btn.disabled = true; btn.textContent = '🔮 Analyzing dish...';
    try {
        const res = await apiFetch('/api/ai/image-to-recipe', {
            method: 'POST',
            body: JSON.stringify({ image: snapBase64, mimeType: snapMime })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Analysis failed');
        const recipe = data.recipe;
        // Render as a card
        const grid = document.getElementById('snapResults');
        grid.innerHTML = `
            <div class="glass" style="padding:24px; border-radius:var(--radius-lg);">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
                    <h3 style="margin:0;">${recipe.title}</h3>
                    <span class="badge badge-blue">🌐 ${recipe.cuisine || 'Global'}</span>
                </div>
                <p style="color:var(--text2); margin-bottom:16px;">${recipe.description}</p>
                ${recipe.confidence ? `<div class="alert info" style="margin-bottom:16px;">AI Confidence: <strong>${recipe.confidence}</strong></div>` : ''}
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px;">
                    <div>
                        <h4 style="margin-bottom:12px;">🧂 Ingredients</h4>
                        <ul style="list-style:none; padding:0;">
                            ${(recipe.ingredients || []).map(i => `<li style="padding:4px 0; border-bottom:1px solid var(--glass-border);">• ${i}</li>`).join('')}
                        </ul>
                    </div>
                    <div>
                        <h4 style="margin-bottom:12px;">📝 Steps</h4>
                        <ol style="padding-left:20px;">
                            ${(recipe.steps || []).map(s => `<li style="padding:4px 0;">${s}</li>`).join('')}
                        </ol>
                    </div>
                </div>
                ${recipe.nutrition ? `
                <div style="display:flex; gap:16px; margin-top:20px; padding-top:16px; border-top:1px solid var(--glass-border);">
                    <span class="badge">🔥 ${recipe.nutrition.calories} cal</span>
                    <span class="badge">🥩 ${recipe.nutrition.protein}</span>
                    <span class="badge">🍞 ${recipe.nutrition.carbs}</span>
                    <span class="badge">🧈 ${recipe.nutrition.fat}</span>
                </div>` : ''}
                <div style="margin-top:20px; display:flex; gap:12px;">
                    <button class="btn btn-primary" onclick="saveSnapRecipe()">💾 Save to My Recipes</button>
                    <button class="btn btn-secondary" onclick="resetSnap()">Try Another</button>
                </div>
            </div>`;
        window._lastSnappedRecipe = recipe;
        showToast(`Identified: ${recipe.title}! 🍽️`, 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '🔮 Reverse-Engineer Recipe'; }
}

async function saveSnapRecipe() {
    const recipe = window._lastSnappedRecipe;
    if (!recipe) return;
    try {
        const formData = new FormData();
        formData.append('title', recipe.title || '');
        formData.append('description', recipe.description || '');
        formData.append('category', recipe.category || 'Lunch');
        formData.append('cooking_time', recipe.cooking_time || '30 mins');
        formData.append('ingredients', JSON.stringify(Array.isArray(recipe.ingredients) ? recipe.ingredients : []));
        formData.append('steps', JSON.stringify(Array.isArray(recipe.steps) ? recipe.steps : []));
        if (recipe.nutrition) formData.append('nutrition', JSON.stringify(recipe.nutrition));
        if (recipe.tags) formData.append('tags', JSON.stringify(recipe.tags));

        const res = await fetch('/api/recipes', {
            method: 'POST',
            headers: { Authorization: `Bearer ${getToken()}` },
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');
        showToast('Recipe saved! 🎉', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

function resetSnap() {
    snapBase64 = null; snapMime = null;
    document.getElementById('snapDropZone').style.display = 'block';
    document.getElementById('snapPreviewBox').style.display = 'none';
    document.getElementById('snapResults').innerHTML = '';
    document.getElementById('snapFileInput').value = '';
}

// ─── Phase 14: Smart Scaling ────────────────────────────────────────────────
let _currentModalRecipe = null;

async function smartScaleRecipe(newServings) {
    if (!_currentModalRecipe) return;
    const scaleInfo = document.getElementById('scaleInfo');
    if (scaleInfo) scaleInfo.innerHTML = '<div class="spinner"></div> Scaling with AI...';
    try {
        const res = await apiFetch('/api/ai/smart-scale', {
            method: 'POST',
            body: JSON.stringify({ recipe: _currentModalRecipe, servings: parseInt(newServings) })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Scaling failed');
        const scaled = data.scaled;
        // Update the modal's ingredient and step lists
        const ingredientList = document.getElementById('modalIngredients');
        const stepList = document.getElementById('modalSteps');
        if (ingredientList) {
            ingredientList.innerHTML = scaled.ingredients.map(i => `<li>${i}</li>`).join('');
        }
        if (stepList) {
            stepList.innerHTML = scaled.steps.map((s, idx) => `<li><strong>Step ${idx + 1}:</strong> ${s}</li>`).join('');
        }
        if (scaleInfo) {
            scaleInfo.innerHTML = `<div class="alert info" style="margin-top:8px;">✨ ${scaled.tips || 'Scaled successfully!'}</div>`;
        }
        showToast(`Scaled to ${newServings} servings! 💪`, 'success');
    } catch (err) {
        if (scaleInfo) scaleInfo.innerHTML = `<div class="alert error">${err.message}</div>`;
    }
}

// ─── Voice Search & Filter (Trending) ──────────────────────────────────────
let searchRecognition = null;
let isVoiceSearching = false;

function toggleVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const btn = document.getElementById('voiceSearchBtn');
    const input = document.getElementById('recipeSearch');

    if (!SpeechRecognition) {
        showToast('Voice Search is not supported in your browser.', 'error');
        return;
    }

    if (isVoiceSearching) {
        isVoiceSearching = false;
        if (searchRecognition) searchRecognition.stop();
        btn.classList.remove('active');
        btn.style.color = '';
        return;
    }

    isVoiceSearching = true;
    btn.classList.add('active');
    btn.style.color = 'var(--primary)';
    input.placeholder = 'Listening...';

    searchRecognition = new SpeechRecognition();
    searchRecognition.continuous = false;
    searchRecognition.interimResults = false;
    searchRecognition.lang = 'en-US';

    searchRecognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        input.value = transcript;
        searchRecipes(transcript);
        showToast(`🎙️ Searched for: "${transcript}"`, 'info');
    };

    searchRecognition.onerror = (e) => {
        console.error('Voice search error:', e);
        showToast('Could not hear you. Please try again.', 'error');
    };

    searchRecognition.onend = () => {
        isVoiceSearching = false;
        btn.classList.remove('active');
        btn.style.color = '';
        input.placeholder = 'Search recipes, tags, ingredients…';
    };

    searchRecognition.start();
}

function searchRecipes(query) {
    if(!query) query = '';
    query = query.toLowerCase().trim();
    const grid = document.getElementById('trendingGrid');
    if (!grid) return;
    const cards = grid.querySelectorAll('.recipe-card');
    let hasVisible = false;

    cards.forEach(card => {
        const title = card.querySelector('h4')?.textContent.toLowerCase() || '';
        const tags = Array.from(card.querySelectorAll('.tag')).map(t => t.textContent.toLowerCase()).join(' ');
        
        if (title.includes(query) || tags.includes(query)) {
            card.style.display = 'flex';
            hasVisible = true;
        } else {
            card.style.display = 'none';
        }
    });

    const empty = grid.querySelector('.empty-state');
    if (empty) {
        empty.style.display = hasVisible ? 'none' : 'flex';
    }
}

// ─── Meal Planner Logic ────────────────────────────────────────────────────
async function autoGeneratePlan() {
    const input = document.getElementById('plannerIngredientsInput');
    const ingredientsString = input ? input.value.trim() : '';
    
    if (!ingredientsString) {
        showToast('Please enter some ingredients first (e.g. Chicken, rice, broccoli...)', 'error');
        if (input) input.focus();
        return;
    }

    try {
        const slots = document.querySelectorAll('.planner-slot');
        slots.forEach(s => s.innerHTML = '<div class="spinner" style="width:20px;height:20px;margin:auto;"></div>');

        const ingredients = ingredientsString.split(',').map(i => i.trim()).filter(i => i);
        
        // Fetch customized 7-day meal plan from AI backend
        const res = await apiFetch('/api/ai/meal-plan', {
            method: 'POST',
            body: JSON.stringify({ ingredients })
        });
        
        const recipes = await res.json();
        
        if (!res.ok) throw new Error(recipes.error || 'Failed to generate plan');
        if (!recipes || recipes.length < 21) throw new Error('AI could not generate a full 7-day plan. Please add more ingredients.');

        // Populate the 21 slots sequentially (they are ordered Mon-Sun: Breakfast, Lunch, Dinner in HTML)
        slots.forEach((slot, index) => {
            if (index < recipes.length) {
                const r = recipes[index];
                const label = slot.getAttribute('data-meal');
                slot.innerHTML = `
                    <span class="slot-label">${label}</span>
                    <span class="slot-content">${r.title}</span>
                    <span style="font-size:0.75rem; color:var(--text3); margin-top:4px;">${r.cooking_time || ''}</span>
                `;
                slot.classList.add('filled');
                slot.onclick = () => showRecipeModal(r);
            }
        });
        
        showToast('✨ Your AI ingredient-based meal plan is ready!', 'success');
    } catch (err) {
        console.error('Planner error:', err);
        showToast(err.message || 'Failed to generate AI meal plan.', 'error');
        clearMealPlan();
    }
}

function clearMealPlan() {
    const slots = document.querySelectorAll('.planner-slot');
    slots.forEach(slot => {
        const label = slot.getAttribute('data-meal');
        slot.innerHTML = `
            <span class="slot-label">${label}</span>
            <span class="planner-empty-hint">➕ Add Meal</span>
        `;
        slot.classList.remove('filled');
        slot.onclick = null; // Can implement manual add later
    });
    showToast('Weekly plan cleared.', 'info');
}

// Initial clear to set empty state hints
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(clearMealPlan, 500);
});

// ─── Phase 15: Pro Tier & Monetization ─────────────────────────────────────
function checkProStatus() {
    const user = getUser();
    return user?.subscription_tier === 'pro';
}

function mockGroceryOrder() {
    const isPro = checkProStatus();
    if (!isPro) {
        showToast('🔒 Upgrade to Pro to use 1-Click Grocery Ordering!', 'error');
        return;
    }
    // Simulate order
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;';
    overlay.innerHTML = '<div class="spinner"></div><p style="margin-top:16px;font-weight:600;color:white;">Placing your order...</p>';
    document.body.appendChild(overlay);
    setTimeout(() => {
        document.body.removeChild(overlay);
        showToast('🎉 Order placed! Estimated delivery: 35 minutes. (This is a demo)', 'success');
    }, 2500);
}

function applyExclusiveTheme(theme) {
    if (!checkProStatus()) {
        showToast('🔒 Exclusive themes are available for Pro members only!', 'error');
        return;
    }
    const themes = {
        'aurora': { primary: '#6ee7b7', secondary: '#3b82f6', bg1: '#0f172a', bg2: '#1e293b' },
        'sunset': { primary: '#f97316', secondary: '#ec4899', bg1: '#1a0a00', bg2: '#2d1a0a' },
        'midnight': { primary: '#8b5cf6', secondary: '#06b6d4', bg1: '#0a0a1a', bg2: '#1a1a2e' }
    };
    const t = themes[theme];
    if (!t) return;
    document.documentElement.style.setProperty('--primary', t.primary);
    document.documentElement.style.setProperty('--secondary', t.secondary);
    document.documentElement.style.setProperty('--bg1', t.bg1);
    document.documentElement.style.setProperty('--bg2', t.bg2);
    showToast(`✨ ${theme.charAt(0).toUpperCase() + theme.slice(1)} theme applied!`, 'success');
}

// ─── Phase 16: Culinary Concierge Voice Navigation ──────────────────────────────
let conciergeModeActive = false;
let conciergeRecognition = null;
let currentRecipeStepIndex = 0;

function toggleMessyHands() {
    const overlay = document.getElementById('voiceOverlay');
    const fab = document.getElementById('messyHandsFab');

    if (messyHandsActive) {
        messyHandsActive = false;
        overlay.style.display = 'none';
        fab.classList.remove('active');
        if (messyRecognition) messyRecognition.stop();
        showToast('Concierge mode off', 'info');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        showToast('Your browser does not support voice recognition. Try Chrome!', 'error');
        return;
    }

    messyHandsActive = true;
    overlay.style.display = 'flex';
    fab.classList.add('active');

    messyRecognition = new SpeechRecognition();
    messyRecognition.continuous = true;
    messyRecognition.interimResults = true;
    messyRecognition.lang = 'en-US';

    messyRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
        }
        document.getElementById('voiceTranscript').textContent = transcript;

        if (event.results[event.resultIndex].isFinal) {
            handleVoiceCommand(transcript.toLowerCase().trim());
        }
    };

    messyRecognition.onerror = () => {
        document.getElementById('voiceTranscript').textContent = 'Could not hear you. Try again...';
    };

    messyRecognition.onend = () => {
        if (messyHandsActive) messyRecognition.start(); // Keep listening
    };

    messyRecognition.start();
    showToast('🎙️ Concierge mode ON! Speak your commands.', 'success');
}

function handleVoiceCommand(cmd) {
    const transcript = document.getElementById('voiceTranscript');

    if (cmd.includes('next step')) {
        currentRecipeStepIndex++;
        const steps = document.querySelectorAll('#modalSteps li');
        if (steps.length > 0 && currentRecipeStepIndex < steps.length) {
            steps.forEach(s => s.style.background = 'none');
            steps[currentRecipeStepIndex].style.background = 'rgba(99, 102, 241, 0.2)';
            steps[currentRecipeStepIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            speakText(steps[currentRecipeStepIndex].textContent);
        } else {
            speakText('You have reached the last step!');
        }
        transcript.textContent = '✅ Next step';
    } else if (cmd.includes('previous step') || cmd.includes('go back')) {
        currentRecipeStepIndex = Math.max(0, currentRecipeStepIndex - 1);
        const steps = document.querySelectorAll('#modalSteps li');
        if (steps.length > 0) {
            steps.forEach(s => s.style.background = 'none');
            steps[currentRecipeStepIndex].style.background = 'rgba(99, 102, 241, 0.2)';
            steps[currentRecipeStepIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
            speakText(steps[currentRecipeStepIndex].textContent);
        }
        transcript.textContent = '✅ Previous step';
    } else if (cmd.includes('read ingredients')) {
        const items = document.querySelectorAll('#modalIngredients li');
        const text = Array.from(items).map(i => i.textContent).join(', ');
        speakText('You will need: ' + text);
        transcript.textContent = '✅ Reading ingredients';
    } else if (cmd.includes('start timer')) {
        const mins = cmd.match(/\d+/);
        if (mins) {
            speakText(`Starting a ${mins[0]} minute timer.`);
            setTimeout(() => {
                speakText('Timer is done!');
                showToast(`⏰ Timer: ${mins[0]} minutes is up!`, 'success');
            }, parseInt(mins[0]) * 60000);
            transcript.textContent = `✅ Timer set: ${mins[0]} min`;
        }
    } else if (cmd.includes('go to')) {
        const sections = Object.keys(sectionTitles);
        const match = sections.find(s => cmd.includes(s));
        if (match) {
            const navEl = document.querySelector(`[data-section="${match}"]`);
            if (navEl) showSection(match, navEl);
            speakText(`Navigating to ${sectionTitles[match]}`);
            transcript.textContent = `✅ Going to ${match}`;
        }
    } else if (cmd.includes('close') || cmd.includes('stop')) {
        toggleMessyHands();
    }
}

function speakText(text) {
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
    }
}

