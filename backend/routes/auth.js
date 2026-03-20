const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { authLimiter } = require('../middleware/rateLimiter');
const { validate } = require('../middleware/validate');
const { authenticate } = require('../middleware/auth');
const supabase = require('../config/supabase');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ─── POST /api/auth/signup ───────────────────────────────────────────────────
router.post('/signup', authLimiter,
    [
        body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
        body('password')
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
            .matches(/(?=.*[A-Z])(?=.*[0-9])/).withMessage('Password must contain an uppercase letter and a number'),
        body('username').trim().isLength({ min: 2, max: 30 }).withMessage('Username must be 2–30 characters'),
    ],
    validate,
    async (req, res) => {
        const { email, password, username } = req.body;
        const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).single();
        if (existing) return res.status(409).json({ error: 'Username already taken' });

        const { data, error } = await supabase.auth.admin.createUser({
            email, password, email_confirm: true, user_metadata: { username },
        });
        if (error) return res.status(400).json({ error: error.message });

        // Profile creation is handled by the on_auth_user_created DB trigger in schema.sql
        res.status(201).json({ message: 'Account created successfully', userId: data.user.id });
    }
);

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', authLimiter,
    [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
    validate,
    async (req, res) => {
        const { email, password } = req.body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return res.status(401).json({ error: 'Invalid email or password' });

        const { data: profile } = await supabase.from('profiles').select('username, role, avatar_url').eq('id', data.user.id).single();
        res.json({
            token: data.session.access_token,
            user: { id: data.user.id, email: data.user.email, username: profile?.username, role: profile?.role, avatar_url: profile?.avatar_url },
        });
    }
);

// ─── POST /api/auth/admin-login ──────────────────────────────────────────────
router.post('/admin-login', authLimiter,
    [body('email').isEmail().normalizeEmail(), body('password').notEmpty()],
    validate,
    async (req, res) => {
        const { email, password } = req.body;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return res.status(401).json({ error: 'Invalid credentials' });

        const { data: profile } = await supabase.from('profiles').select('role, username').eq('id', data.user.id).single();
        if (profile?.role !== 'admin') return res.status(403).json({ error: 'Access denied. Admin only.' });

        await supabase.from('audit_logs').insert({ admin_id: data.user.id, action: 'ADMIN_LOGIN', target_id: data.user.id });
        res.json({
            token: data.session.access_token,
            user: { id: data.user.id, email: data.user.email, username: profile.username, role: 'admin' },
        });
    }
);

// ─── POST /api/auth/logout ───────────────────────────────────────────────────
router.post('/logout', authenticate, async (req, res) => {
    try {
        // Invalidate the user's active session server-side
        await supabase.auth.admin.signOut(req.headers.authorization.split(' ')[1]).catch(() => {
            // Fallback: if signOut not available, best-effort is to return success
            // Client will always clear its own token regardless
        });
    } catch (_) { /* best-effort */ }
    res.json({ message: 'Logged out successfully' });
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
    const { data: profile } = await supabase.from('profiles').select('*').eq('id', req.user.id).single();
    res.json({ user: { ...req.user, ...profile } });
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────
router.put('/profile', authenticate,
    [
        body('username').optional().trim().isLength({ min: 2, max: 30 }).withMessage('Username must be 2–30 characters'),
        body('bio').optional().trim().isLength({ max: 200 }).withMessage('Bio too long'),
    ],
    validate,
    async (req, res) => {
        try {
            const { username, avatar_url, bio, preferences } = req.body;

            // Check username uniqueness if changing
            if (username && username !== req.user.username) {
                const { data: existing } = await supabase.from('profiles').select('id').eq('username', username).single();
                if (existing) return res.status(409).json({ error: 'Username already taken' });
            }

            const { data, error } = await supabase.from('profiles')
                .update({ username, avatar_url, bio, preferences })
                .eq('id', req.user.id)
                .select().single();

            if (error) throw error;
            res.json({ message: 'Profile updated', user: { ...req.user, ...data } });
        } catch (err) { res.status(500).json({ error: err.message }); }
    }
);

// ─── GET /api/auth/search ────────────────────────────────────────────────────
router.get('/search', authenticate, async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(q);
        let query = supabase.from('profiles').select('id, username, avatar_url');

        if (isUuid) {
            query = query.eq('id', q);
        } else {
            query = query.ilike('username', `%${q}%`);
        }

        const { data, error } = await query.limit(5);

        if (error) throw error;
        res.json(data.filter(u => u.id !== req.user.id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/auth/profile-picture ──────────────────────────────────────────
router.post('/profile-picture', authenticate, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        const userId = req.user.id;
        const fileExt = req.file.mimetype.split('/')[1];
        const fileName = `${userId}-${Date.now()}.${fileExt}`;

        // Ensure 'avatars' bucket exists
        const { data: buckets } = await supabase.storage.listBuckets();
        if (!buckets.find(b => b.name === 'avatars')) {
            await supabase.storage.createBucket('avatars', { public: true });
        }

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        // Update Profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', userId)
            .select()
            .single();

        if (profileError) throw profileError;

        res.json({ message: 'Avatar updated', avatar_url: publicUrl, user: { ...req.user, ...profile } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
