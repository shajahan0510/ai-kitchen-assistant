// pantry.js logic is now called explicitly by dashboard.js

async function loadPantryList() {
    const listContainer = document.getElementById('pantryList');
    if (!listContainer) return;

    try {
        const res = await apiFetch('/api/pantry');
        const items = await res.json();

        if (!Array.isArray(items)) {
            const errorMsg = items.error || 'Failed to load pantry';
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <p>${errorMsg}</p>
                    <button class="btn btn-ghost btn-sm" onclick="loadPantryList()">🔄 Retry</button>
                </div>`;
            return;
        }

        if (items.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🥫</div>
                    <p>Your pantry is empty. Add items to stay organized!</p>
                </div>`;
            return;
        }

        listContainer.innerHTML = items.map(item => {
            const isExpiring = item.expiry_date && new Date(item.expiry_date) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
            return `
                <div class="pantry-item-card glass ${isExpiring ? 'expiring' : ''} section-fade-in">
                    <div class="pantry-item-name">${item.item_name}</div>
                    <div class="pantry-expiry">${item.expiry_date ? 'Expires: ' + item.expiry_date : 'No expiry'}</div>
                    <div class="pantry-actions">
                         <button class="btn btn-ghost btn-sm" onclick="removePantryItem('${item.id}')">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');

        // Check for urgent items
        const expiringItems = items.filter(i => i.expiry_date && new Date(i.expiry_date) < new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
        const wasteAlert = document.getElementById('wasteNotAlert');
        if (wasteAlert) {
            if (expiringItems.length > 0) {
                wasteAlert.style.display = 'block';
                document.getElementById('wasteNotContent').innerHTML = 'You have ' + expiringItems.length + ' items expiring soon! Let\'s cook something with them.';
            } else {
                wasteAlert.style.display = 'none';
            }
        }

    } catch (err) {
        console.error('Pantry load error:', err);
        listContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <p>Connection error. Please check your internet.</p>
                <button class="btn btn-ghost btn-sm" onclick="loadPantryList()">🔄 Retry</button>
            </div>`;
    }
}

async function addPantryItem() {
    const name = document.getElementById('pantryItemName').value;
    const expiry = document.getElementById('pantryExpiry').value;

    if (!name) return alert('Item name is required');

    try {
        const res = await apiFetch('/api/pantry', {
            method: 'POST',
            body: JSON.stringify({ item_name: name, expiry_date: expiry })
        });
        if (res.ok) {
            document.getElementById('pantryItemName').value = '';
            document.getElementById('pantryExpiry').value = '';
            loadPantryList();
        }
    } catch (err) {
        console.error('Add item error:', err);
    }
}

async function removePantryItem(id) {
    if (!confirm('Remove this item?')) return;
    try {
        await apiFetch('/api/pantry/' + id, { method: 'DELETE' });
        loadPantryList();
    } catch (err) {
        console.error('Remove item error:', err);
    }
}

async function getZeroWasteIdeas() {
    const content = document.getElementById('wasteNotContent');
    content.innerHTML = '<div class="spinner"></div> Thinking...';
    try {
        const res = await apiFetch('/api/ai/waste-not', { method: 'POST' });
        const { ideas } = await res.json();

        content.innerHTML = ideas.map(idea => `
            <div class="waste-idea glass">
                <strong>${idea.title}</strong>
                <p>${idea.reasoning}</p>
                <div class="waste-steps">📋 <strong>Steps:</strong> ${idea.quick_steps}</div>
            </div>
            `).join('');
    } catch (err) {
        content.innerHTML = 'AI is busy. Try again later!';
    }
}
