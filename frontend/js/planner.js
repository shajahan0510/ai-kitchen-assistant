/* ═══════════════════════════════════════════════════════════════
   planner.js — Calendar meal planner
   ═══════════════════════════════════════════════════════════════ */

let currentDate = new Date();
let allMealPlans = [];
let selectedPlanDate = null;
let availableRecipes = [];

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById('calMonthTitle').textContent =
        `${currentDate.toLocaleString('default', { month: 'long' })} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    for (let i = 0; i < firstDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'cal-cell other-month';
        grid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
        cell.className = `cal-cell${isToday ? ' today' : ''}`;
        cell.innerHTML = `<div class="cal-date">${day}</div>`;
        const dayMeals = allMealPlans.filter(p => p.planned_date === dateStr);
        dayMeals.forEach(plan => {
            const d = document.createElement('div');
            d.className = 'cal-meal';
            d.title = plan.recipes?.title || 'Recipe';
            d.textContent = `${getMealTypeEmoji(plan.meal_type)} ${plan.recipes?.title || 'Recipe'}`;
            cell.appendChild(d);
        });
        cell.addEventListener('click', () => {
            openPlanModalForDate(dateStr);
            updateNutritionSummary(dateStr);
        });
        grid.appendChild(cell);
    }
}

function getMealTypeEmoji(type) {
    return { Breakfast: '🌅', Lunch: '☀️', Dinner: '🌙', Snack: '🍎' }[type] || '🍽️';
}

function changeMonth(dir) {
    currentDate.setMonth(currentDate.getMonth() + dir);
    renderCalendar();
}

async function loadMealPlans() {
    try {
        const res = await apiFetch('/api/planner');
        const data = await res.json();
        allMealPlans = data.plans || [];
        renderCalendar();
        loadUpcomingMeals();
        updateNutritionSummary(); // Update for today by default
    } catch (_) { }
}

function updateNutritionSummary(dateStr) {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = dateStr || today;
    const dayMeals = allMealPlans.filter(p => p.planned_date === targetDate);
    const summaryEl = document.getElementById('plannerNutritionSummary');
    const contentEl = document.getElementById('dayNutritionContent');

    if (!dayMeals.length) {
        summaryEl.style.display = 'none';
        return;
    }

    let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    dayMeals.forEach(p => {
        const n = p.recipes?.nutrition || {};
        totals.calories += parseInt(n.calories) || 0;
        totals.protein += parseInt(n.protein) || 0;
        totals.carbs += parseInt(n.carbs) || 0;
        totals.fat += parseInt(n.fat) || 0;
    });

    summaryEl.style.display = 'block';
    contentEl.innerHTML = `
        <div class="nut-val"><span>🔥 ${totals.calories}</span><label>Kcal</label></div>
        <div class="nut-val"><span>🥩 ${totals.protein}g</span><label>Protein</label></div>
        <div class="nut-val"><span>🍞 ${totals.carbs}g</span><label>Carbs</label></div>
        <div class="nut-val"><span>🥑 ${totals.fat}g</span><label>Fat</label></div>
    `;
    summaryEl.querySelector('.upcoming-title').textContent = `📈 Nutrition: ${formatDate(targetDate)}`;
}

async function loadUpcomingMeals() {
    // ... existing loadUpcomingMeals logic ...
    const container = document.getElementById('upcomingMeals');
    const today = new Date().toISOString().split('T')[0];
    const upcoming = allMealPlans
        .filter(p => p.planned_date >= today)
        .sort((a, b) => a.planned_date.localeCompare(b.planned_date))
        .slice(0, 7);

    if (!upcoming.length) {
        container.innerHTML = '<p style="color:var(--text3);font-size:0.85rem;text-align:center;padding:20px;">No upcoming meals planned.</p>';
        return;
    }
    container.innerHTML = upcoming.map(plan => `
    <div class="plan-item">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <div class="plan-item-date">${formatDate(plan.planned_date)}</div>
          <div class="plan-item-title">${plan.recipes?.title || 'Unknown Recipe'}</div>
          <div class="plan-item-type">${getMealTypeEmoji(plan.meal_type)} ${plan.meal_type}</div>
        </div>
        <button class="btn btn-danger btn-sm" onclick="deletePlan('${plan.id}')">✕</button>
      </div>
    </div>`).join('');
}

function formatDate(dateStr) {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('default', { weekday: 'short', month: 'short', day: 'numeric' });
}

async function openPlanModalForDate(dateStr) {
    selectedPlanDate = dateStr;
    document.getElementById('planDateLabel').textContent = `Planning for: ${formatDate(dateStr)}`;
    document.getElementById('planModal').style.display = 'flex';
    if (!availableRecipes.length) {
        const res = await apiFetch('/api/recipes?limit=100&sort=title&order=asc');
        const data = await res.json();
        availableRecipes = data.recipes || [];
    }
    const sel = document.getElementById('planRecipeSelect');
    sel.innerHTML = availableRecipes.map(r => `<option value="${r.id}">${r.title}</option>`).join('');
    if (window._preselectedRecipeId) { sel.value = window._preselectedRecipeId; window._preselectedRecipeId = null; }
}

function closePlanModal() { document.getElementById('planModal').style.display = 'none'; selectedPlanDate = null; }

async function savePlan() {
    if (!selectedPlanDate) return;
    const recipeId = document.getElementById('planRecipeSelect').value;
    const mealType = document.getElementById('planMealType').value;
    const notes = document.getElementById('planNotes').value;
    try {
        const res = await apiFetch('/api/planner', {
            method: 'POST',
            body: JSON.stringify({ recipe_id: recipeId, planned_date: selectedPlanDate, meal_type: mealType, notes }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save');
        allMealPlans.push(data.plan);
        renderCalendar();
        loadUpcomingMeals();
        updateNutritionSummary(selectedPlanDate);
        closePlanModal();
        showToast('Meal plan saved! 📅', 'success');
    } catch (err) { showToast(err.message, 'error'); }
}

async function deletePlan(planId) {
    try {
        const res = await apiFetch(`/api/planner/${planId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Delete failed');
        allMealPlans = allMealPlans.filter(p => p.id !== planId);
        renderCalendar();
        loadUpcomingMeals();
        showToast('Meal plan removed', 'info');
    } catch (err) { showToast(err.message, 'error'); }
}
