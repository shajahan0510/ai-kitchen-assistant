/* ═══════════════════════════════════════════════════════════════
   grocery.js — Grocery list with Budget Tracker
   ═══════════════════════════════════════════════════════════════ */

let groceryItems = [];

async function loadGroceryList() {
    try {
        const res = await apiFetch('/api/grocery');
        const data = await res.json();
        groceryItems = data.list?.items || [];
        renderGroceryList();
        updateBudgetBar();
    } catch (_) { }
}

function renderGroceryList() {
    const container = document.getElementById('groceryListContainer');
    if (!groceryItems.length) {
        container.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><p>No items yet. Generate from your meal plan or add manually.</p></div>';
        updateBudgetBar();
        return;
    }
    const checkedCount = groceryItems.filter(i => i.checked).length;
    container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:8px 14px;background:var(--bg2);border-radius:10px;">
      <span style="font-size:0.85rem;color:var(--text2);">✅ ${checkedCount} / ${groceryItems.length} items checked</span>
      <button class="btn btn-secondary btn-sm" onclick="clearCheckedItems()">Clear Checked</button>
    </div>
    ${groceryItems.map((item, i) => `
      <div class="grocery-item ${item.checked ? 'checked' : ''}" id="grocery-${i}">
        <input type="checkbox" class="grocery-check" ${item.checked ? 'checked' : ''} onchange="toggleGroceryItem(${i})" />
        <div style="flex:1;">
          <div class="grocery-name">${item.name}</div>
          ${item.from_recipe ? `<div class="grocery-source">From: ${item.from_recipe}</div>` : ''}
        </div>
        ${item.price ? `<span class="grocery-price-tag">$${parseFloat(item.price).toFixed(2)}</span>` : ''}
        <button class="grocery-del" onclick="removeGroceryItem(${i})" title="Remove">✕</button>
      </div>`).join('')}`;
    if (document.getElementById('statGrocery')) document.getElementById('statGrocery').textContent = groceryItems.length;
    updateBudgetBar();
}

function toggleGroceryItem(i) { groceryItems[i].checked = !groceryItems[i].checked; renderGroceryList(); }
function removeGroceryItem(i) { groceryItems.splice(i, 1); renderGroceryList(); }
function clearCheckedItems() { groceryItems = groceryItems.filter(i => !i.checked); renderGroceryList(); }

function addGroceryItem() {
    const input = document.getElementById('groceryAddInput');
    const priceInput = document.getElementById('groceryItemPrice');
    const name = input.value.trim();
    if (!name) return;
    if (groceryItems.some(i => i.name.toLowerCase() === name.toLowerCase())) { showToast('Already in list', 'info'); input.value = ''; return; }
    const price = priceInput ? parseFloat(priceInput.value) || 0 : 0;
    groceryItems.push({ name, checked: false, price: price > 0 ? price : null });
    renderGroceryList();
    input.value = '';
    if (priceInput) priceInput.value = '';
}

async function saveGroceryList() {
    try {
        const res = await apiFetch('/api/grocery', { method: 'POST', body: JSON.stringify({ items: groceryItems }) });
        if (!res.ok) throw new Error('Save failed');
        showToast('Grocery list saved! 💾', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

async function generateGroceryList() {
    const btn = document.getElementById('generateGroceryBtn');
    btn.disabled = true; btn.textContent = '⏳ Generating...';
    try {
        const res = await apiFetch('/api/grocery/generate', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Generate failed');
        groceryItems = data.list?.items || [];
        renderGroceryList();
        showToast(data.message || 'Grocery list generated!', 'success');
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = '⚡ Generate from Meal Plan'; }
}

// ─── Budget Tracker ───────────────────────────────────────────────────────────
function updateBudgetBar() {
    const limitInput = document.getElementById('budgetLimit');
    const barEl = document.getElementById('budgetBar');
    const spentEl = document.getElementById('budgetSpent');
    const remainingEl = document.getElementById('budgetRemaining');
    if (!limitInput || !barEl) return;

    const limit = parseFloat(limitInput.value) || 0;
    const spent = groceryItems.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);

    spentEl.textContent = `$${spent.toFixed(2)} spent`;

    if (!limit) {
        remainingEl.textContent = 'Set a budget above';
        barEl.style.width = '0%';
        barEl.className = 'budget-bar-fill';
        return;
    }

    const pct = Math.min((spent / limit) * 100, 100);
    barEl.style.width = pct + '%';
    const remaining = limit - spent;
    remainingEl.textContent = remaining >= 0
        ? `$${remaining.toFixed(2)} remaining`
        : `⚠️ $${Math.abs(remaining).toFixed(2)} over budget!`;

    barEl.className = 'budget-bar-fill' + (pct >= 100 ? ' over' : pct >= 75 ? ' warning' : '');
}
