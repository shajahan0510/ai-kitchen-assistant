const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { adminOnly } = require('../middleware/adminAuth');
const { validate } = require('../middleware/validate');
const supabase = require('../config/supabase');

const router = express.Router();
router.use(authenticate, adminOnly);

const logAction = (adminId, action, targetId) =>
    supabase.from('audit_logs').insert({ admin_id: adminId, action, target_id: String(targetId) });

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { data, error, count } = await supabase
            .from('profiles').select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);
        if (error) throw error;
        res.json({ users: data, total: count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/admin/users ────────────────────────────────────────────────────
router.post('/users',
    [
        body('email').isEmail().normalizeEmail(),
        body('password').isLength({ min: 8 }),
        body('username').trim().isLength({ min: 2, max: 30 }),
        body('role').isIn(['user', 'admin']).withMessage('Role must be user or admin'),
    ],
    validate,
    async (req, res) => {
        try {
            const { email, password, username, role } = req.body;
            const { data, error } = await supabase.auth.admin.createUser({
                email, password, email_confirm: true, user_metadata: { username, role },
            });
            if (error) return res.status(400).json({ error: error.message });
            // Profile creation is handled by the DB trigger
            await logAction(req.user.id, 'CREATE_USER', data.user.id);
            res.status(201).json({ user: { id: data.user.id, email, username, role } });
        } catch (err) { res.status(500).json({ error: err.message }); }
    }
);

// ─── DELETE /api/admin/users/:id ──────────────────────────────────────────────
router.delete('/users/:id', async (req, res) => {
    try {
        if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
        await supabase.auth.admin.deleteUser(req.params.id);
        await supabase.from('profiles').delete().eq('id', req.params.id);
        await logAction(req.user.id, 'DELETE_USER', req.params.id);
        res.json({ message: 'User deleted successfully' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/admin/recipes ───────────────────────────────────────────────────
router.get('/recipes', async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        const { data, error, count } = await supabase
            .from('recipes')
            .select('*, profiles:author_id(username)', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(offset, offset + parseInt(limit) - 1);
        if (error) throw error;
        res.json({ recipes: data, total: count });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── DELETE /api/admin/recipes/:id ────────────────────────────────────────────
router.delete('/recipes/:id', async (req, res) => {
    try {
        await supabase.from('recipes').delete().eq('id', req.params.id);
        await logAction(req.user.id, 'DELETE_RECIPE', req.params.id);
        res.json({ message: 'Recipe deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/admin/analytics ─────────────────────────────────────────────────
router.get('/analytics', async (req, res) => {
    try {
        const [usersRes, recipesRes, plansRes, topRecipesRes] = await Promise.all([
            supabase.from('profiles').select('id, role, created_at', { count: 'exact' }),
            supabase.from('recipes').select('id, views, likes, created_at', { count: 'exact' }),
            supabase.from('meal_plans').select('id', { count: 'exact' }),
            supabase.from('recipes').select('id, title, views, likes, profiles:author_id(username)').order('views', { ascending: false }).limit(5),
        ]);
        const totalViews = (recipesRes.data || []).reduce((s, r) => s + (r.views || 0), 0);
        const totalLikes = (recipesRes.data || []).reduce((s, r) => s + (r.likes || 0), 0);
        const adminCount = (usersRes.data || []).filter((u) => u.role === 'admin').length;
        res.json({
            users: { total: usersRes.count, admins: adminCount },
            recipes: { total: recipesRes.count, total_views: totalViews, total_likes: totalLikes },
            meal_plans: { total: plansRes.count },
            top_recipes: topRecipesRes.data || [],
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/admin/logs ──────────────────────────────────────────────────────
router.get('/logs', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*, profiles:admin_id(username)')
            .order('created_at', { ascending: false })
            .limit(100);
        if (error) throw error;
        res.json({ logs: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── PUT /api/admin/recipes/:id/feature ──────────────────────────────────────
router.put('/recipes/:id/feature', async (req, res) => {
    try {
        const { is_featured } = req.body;
        const { data, error } = await supabase.from('recipes').update({ is_featured }).eq('id', req.params.id).select().single();
        if (error) throw error;
        await logAction(req.user.id, is_featured ? 'FEATURE_RECIPE' : 'UNFEATURE_RECIPE', req.params.id);
        res.json({ recipe: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
