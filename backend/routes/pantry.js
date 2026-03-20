const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

// ─── GET /api/pantry ─────────────────────────────────────────────────────────
// Fetch user's pantry items
router.get('/', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('pantry')
            .select('*')
            .eq('user_id', req.user.id)
            .order('expiry_date', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/pantry ────────────────────────────────────────────────────────
// Add item to pantry
router.post('/', authenticate, [
    body('item_name').trim().notEmpty(),
    body('quantity').optional().trim(),
    body('expiry_date').optional().isDate()
], validate, async (req, res) => {
    try {
        const { item_name, quantity, expiry_date, is_staple } = req.body;
        const { data, error } = await supabase
            .from('pantry')
            .insert({
                user_id: req.user.id,
                item_name,
                quantity,
                expiry_date,
                is_staple
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/pantry/:id ──────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { error } = await supabase
            .from('pantry')
            .delete()
            .eq('id', req.params.id)
            .eq('user_id', req.user.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
