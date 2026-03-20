/* ═══════════════════════════════════════════════════════════════
   nutrition.js — Personal Nutrition Dashboard
   Tracks daily macros from meal plans and shows progress bars
   ═══════════════════════════════════════════════════════════════ */

const NUTRITION_GOALS_KEY = 'ka_nutrition_goals';

function getNutritionGoals() {
    try { return JSON.parse(localStorage.getItem(NUTRITION_GOALS_KEY)) || {}; } catch { return {}; }
}

function saveNutritionGoals(goals) {
    localStorage.setItem(NUTRITION_GOALS_KEY, JSON.stringify(goals));
}

function recalcNutrition() {
    const goals = {
        calories: parseFloat(document.getElementById('goalCalories')?.value) || 2000,
        protein: parseFloat(document.getElementById('goalProtein')?.value) || 150,
        carbs: parseFloat(document.getElementById('goalCarbs')?.value) || 250,
        fat: parseFloat(document.getElementById('goalFat')?.value) || 65,
    };
    saveNutritionGoals(goals);
    loadNutritionDashboard();
}

async function loadNutritionDashboard() {
    // Pre-fill goals from localStorage
    const goals = getNutritionGoals();
    if (goals.calories) document.getElementById('goalCalories').value = goals.calories;
    if (goals.protein) document.getElementById('goalProtein').value = goals.protein;
    if (goals.carbs) document.getElementById('goalCarbs').value = goals.carbs;
    if (goals.fat) document.getElementById('goalFat').value = goals.fat;

    try {
        const res = await apiFetch('/api/planner');
        const data = await res.json();
        const plans = data.plans || [];

        // Filter to today
        const today = new Date().toISOString().split('T')[0];
        const todayPlans = plans.filter(p => p.planned_date === today);

        // Aggregate nutrition from recipe data embedded in plan
        const todayNutrition = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        todayPlans.forEach(plan => {
            const nut = plan.recipes?.nutrition || plan.nutrition || {};
            todayNutrition.calories += parseFloat(nut.calories) || 0;
            todayNutrition.protein += parseFloat(nut.protein) || 0;
            todayNutrition.carbs += parseFloat(nut.carbs) || 0;
            todayNutrition.fat += parseFloat(nut.fat) || 0;
        });

        renderNutritionBars(todayNutrition, goals);
        renderWeeklyChart(plans, goals);

    } catch (err) {
        document.getElementById('nutritionProgressBars').innerHTML =
            `<div class="alert error">Failed to load nutrition data.</div>`;
    }
}

function renderNutritionBars(actual, goals) {
    const container = document.getElementById('nutritionProgressBars');
    if (!container) return;

    const macros = [
        { key: 'calories', label: '🔥 Calories', unit: 'kcal', color: '#f97316' },
        { key: 'protein', label: '🥩 Protein', unit: 'g', color: '#7c6ff7' },
        { key: 'carbs', label: '🍞 Carbs', unit: 'g', color: '#22c55e' },
        { key: 'fat', label: '🧀 Fat', unit: 'g', color: '#eab308' },
    ];

    container.innerHTML = macros.map(({ key, label, unit, color }) => {
        const goal = goals[key] || 0;
        const value = actual[key] || 0;
        const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0;
        const status = pct >= 100 ? 'over-goal' : pct >= 80 ? 'near-goal' : '';
        return `
        <div class="nutrition-bar-row ${status}">
            <div class="nutrition-bar-label">
                <span>${label}</span>
                <span class="nutrition-bar-values">${Math.round(value)} / ${goal} ${unit}</span>
            </div>
            <div class="nutrition-bar-track">
                <div class="nutrition-bar-fill" style="width:${pct}%;background:${color};"></div>
            </div>
        </div>`;
    }).join('');
}

function renderWeeklyChart(plans, goals) {
    const container = document.getElementById('weeklyNutritionChart');
    if (!container) return;

    // Get last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push(d.toISOString().split('T')[0]);
    }

    const weekData = days.map(day => {
        const dayPlans = plans.filter(p => p.planned_date === day);
        const calories = dayPlans.reduce((sum, p) => {
            const nut = p.recipes?.nutrition || p.nutrition || {};
            return sum + (parseFloat(nut.calories) || 0);
        }, 0);
        return { day, calories };
    });

    const maxCal = Math.max(...weekData.map(d => d.calories), goals.calories || 2000);

    container.innerHTML = `
    <div class="weekly-bars">
        ${weekData.map(({ day, calories }) => {
        const pct = maxCal > 0 ? (calories / maxCal) * 100 : 0;
        const label = new Date(day + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' });
        const isToday = day === new Date().toISOString().split('T')[0];
        return `
            <div class="weekly-bar-col">
                <div class="weekly-bar-value">${calories > 0 ? Math.round(calories) : ''}</div>
                <div class="weekly-bar-track">
                    <div class="weekly-bar-fill ${isToday ? 'today' : ''}" style="height:${pct}%;"></div>
                </div>
                <div class="weekly-bar-label ${isToday ? 'today' : ''}">${label}</div>
            </div>`;
    }).join('')}
    </div>
    <div class="weekly-goal-line-label">Goal: ${goals.calories || 2000} kcal/day</div>`;
}
