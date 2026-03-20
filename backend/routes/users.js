const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');

// ─── GET /api/users/:username ─────────────────────────────────────────────────
router.get('/:username', async (req, res) => {
    try {
        const username = req.params.username;

        // 1. Fetch user profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, username, bio, avatar_url, created_at')
            .eq('username', username)
            .single();

        if (profileError || !profile) {
            return res.status(404).json({ error: 'User not found' });
        }

        // 2. Fetch follower/following counts
        const { count: followerCount, error: followerError } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('following_id', profile.id);

        const { count: followingCount, error: followingError } = await supabase
            .from('follows')
            .select('*', { count: 'exact', head: true })
            .eq('follower_id', profile.id);

        // 3. Fetch user's recipes
        const { data: recipes, error: recipesError } = await supabase
            .from('recipes')
            .select('*, profiles(username, avatar_url)')
            .eq('author_id', profile.id)
            .order('created_at', { ascending: false });

        if (recipesError) throw recipesError;

        res.json({
            profile: {
                ...profile,
                followers: followerCount || 0,
                following: followingCount || 0
            },
            recipes: recipes || []
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
