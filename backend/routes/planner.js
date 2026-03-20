const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const supabase = require('../config/supabase');

const router = express.Router();
router.use(authenticate);

// ─── GET /api/planner ─────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('meal_plans')
            .select('*, recipes(id, title, image_url, cooking_time, category)')
            .eq('user_id', req.user.id)
            .order('planned_date', { ascending: true });
        if (error) throw error;
        res.json({ plans: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/planner ────────────────────────────────────────────────────────
router.post('/',
    [
        body('recipe_id').notEmpty().withMessage('Recipe ID required'),
        body('planned_date').isISO8601().withMessage('Valid date required (YYYY-MM-DD)'),
        body('meal_type').optional().isIn(['Breakfast', 'Lunch', 'Dinner', 'Snack']).withMessage('Invalid meal type'),
    ],
    validate,
    async (req, res) => {
        try {
            const { recipe_id, planned_date, meal_type = 'Dinner', notes } = req.body;
            const { data, error } = await supabase.from('meal_plans')
                .insert({ user_id: req.user.id, recipe_id, planned_date, meal_type, notes })
                .select('*, recipes(id, title, image_url, cooking_time)').single();
            if (error) throw error;
            res.status(201).json({ plan: data });
        } catch (err) { res.status(500).json({ error: err.message }); }
    }
);

// ─── PUT /api/planner/:id ─────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const { data: existing } = await supabase.from('meal_plans').select('user_id').eq('id', req.params.id).single();
        if (!existing || existing.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
        const { recipe_id, planned_date, meal_type, notes } = req.body;
        const { data, error } = await supabase.from('meal_plans')
            .update({ recipe_id, planned_date, meal_type, notes })
            .eq('id', req.params.id)
            .select('*, recipes(id, title, image_url, cooking_time)').single();
        if (error) throw error;
        res.json({ plan: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /api/planner/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const { data: existing } = await supabase.from('meal_plans').select('user_id').eq('id', req.params.id).single();
        if (!existing || existing.user_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
        await supabase.from('meal_plans').delete().eq('id', req.params.id);
        res.json({ message: 'Meal plan removed' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
