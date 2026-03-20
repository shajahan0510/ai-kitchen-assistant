const express = require('express');
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');

const router = express.Router();
router.use(authenticate);

// ─── GET /api/grocery ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('grocery_lists')
            .select('*')
            .eq('user_id', req.user.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .single();
        if (error && error.code !== 'PGRST116') throw error;
        res.json({ list: data || { items: [] } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/grocery ────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ error: 'Items must be an array' });

        const { data: existing } = await supabase.from('grocery_lists').select('id').eq('user_id', req.user.id).limit(1).single();
        let data, error;
        if (existing) {
            ({ data, error } = await supabase.from('grocery_lists')
                .update({ items, updated_at: new Date().toISOString() })
                .eq('id', existing.id).select().single());
        } else {
            ({ data, error } = await supabase.from('grocery_lists')
                .insert({ user_id: req.user.id, items, generated_from_plan: false })
                .select().single());
        }
        if (error) throw error;
        res.json({ list: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/grocery/generate ───────────────────────────────────────────────
router.post('/generate', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const { data: plans, error } = await supabase
            .from('meal_plans')
            .select('planned_date, meal_type, recipes(title, ingredients)')
            .eq('user_id', req.user.id)
            .gte('planned_date', today)
            .order('planned_date', { ascending: true });
        if (error) throw error;

        const ingredientMap = new Map();
        plans.forEach((plan) => {
            if (plan.recipes?.ingredients) {
                const ings = Array.isArray(plan.recipes.ingredients)
                    ? plan.recipes.ingredients
                    : JSON.parse(plan.recipes.ingredients);
                ings.forEach((ing) => {
                    const key = ing.toLowerCase().trim();
                    if (!ingredientMap.has(key)) {
                        ingredientMap.set(key, { name: ing, checked: false, from_recipe: plan.recipes.title });
                    }
                });
            }
        });

        const items = Array.from(ingredientMap.values());
        const { data: existing } = await supabase.from('grocery_lists').select('id').eq('user_id', req.user.id).limit(1).single();
        let result, err;
        if (existing) {
            ({ data: result, error: err } = await supabase.from('grocery_lists')
                .update({ items, generated_from_plan: true, updated_at: new Date().toISOString() })
                .eq('id', existing.id).select().single());
        } else {
            ({ data: result, error: err } = await supabase.from('grocery_lists')
                .insert({ user_id: req.user.id, items, generated_from_plan: true })
                .select().single());
        }
        if (err) throw err;
        res.json({ list: result, message: `Generated ${items.length} items from ${plans.length} meal plans` });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
