const supabase = require('../config/supabase');

/**
 * Verify Supabase JWT from Authorization header.
 * Attaches req.user = { id, email, role, username }
 */
const authenticate = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Missing or invalid Authorization header' });
        }

        const token = authHeader.split(' ')[1];
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) return res.status(401).json({ error: 'Invalid or expired token' });

        const { data: profile } = await supabase
            .from('profiles')
            .select('role, username')
            .eq('id', user.id)
            .single();

        req.user = {
            id: user.id,
            email: user.email,
            role: profile?.role || 'user',
            username: profile?.username,
        };
        next();
    } catch (err) {
        console.error('Auth middleware error:', err);
        res.status(500).json({ error: 'Authentication error' });
    }
};

module.exports = { authenticate };
