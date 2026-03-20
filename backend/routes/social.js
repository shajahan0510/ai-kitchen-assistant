const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');

// ─── Follow a user ───────────────────────────────────────────────────────────
router.post('/follow/:followingId', authenticate, async (req, res) => {
    try {
        const followerId = req.user.id;
        const followingId = req.params.followingId;

        if (followerId === followingId) {
            return res.status(400).json({ error: 'You cannot follow yourself.' });
        }

        const { data, error } = await supabase
            .from('follows')
            .insert({ follower_id: followerId, following_id: followingId })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') { // Unique constraint violation
                return res.status(400).json({ error: 'You are already following this user.' });
            }
            throw error;
        }

        res.status(201).json({ message: 'Successfully followed user.', follow: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Unfollow a user ──────────────────────────────────────────────────────────
router.delete('/unfollow/:followingId', authenticate, async (req, res) => {
    try {
        const followerId = req.user.id;
        const followingId = req.params.followingId;

        const { error } = await supabase
            .from('follows')
            .delete()
            .match({ follower_id: followerId, following_id: followingId });

        if (error) throw error;

        res.json({ message: 'Successfully unfollowed user.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Get followers of a user ──────────────────────────────────────────────────
router.get('/followers/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { data, error } = await supabase
            .from('follows')
            .select('created_at, follower:profiles!follower_id(id, username, avatar_url, bio)')
            .eq('following_id', userId);

        if (error) throw error;

        // Clean up the nested response
        const followers = data.map(d => ({ ...d.follower, followed_at: d.created_at }));
        res.json({ followers });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Get users that a user is following ───────────────────────────────────────
router.get('/following/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const { data, error } = await supabase
            .from('follows')
            .select('created_at, following:profiles!following_id(id, username, avatar_url, bio)')
            .eq('follower_id', userId);

        if (error) throw error;

        // Clean up the nested response
        const following = data.map(d => ({ ...d.following, followed_at: d.created_at }));
        res.json({ following });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Get community feed ───────────────────────────────────────────────────────
router.get('/feed', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('posts')
            .select(`
                *,
                author:profiles!author_id(id, username, avatar_url),
                recipe:recipes!recipe_id(id, title)
            `)
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        // Attach liked_by_me if a valid auth token is provided (optional auth)
        let likedPostIds = new Set();
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.split(' ')[1];
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) {
                const postIds = (data || []).map(p => p.id);
                if (postIds.length > 0) {
                    const { data: likes } = await supabase
                        .from('post_likes')
                        .select('post_id')
                        .eq('user_id', user.id)
                        .in('post_id', postIds);
                    if (likes) likes.forEach(l => likedPostIds.add(l.post_id));
                }
            }
        }

        const enriched = (data || []).map(post => ({
            ...post,
            liked_by_me: likedPostIds.has(post.id)
        }));

        res.json(enriched);
    } catch (err) {
        console.error('[Feed] Error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ─── Post a new share ────────────────────────────────────────────────────────
router.post('/posts', authenticate, async (req, res) => {
    try {
        const { recipe_id, image_url, caption } = req.body;
        const { data, error } = await supabase
            .from('posts')
            .insert({
                author_id: req.user.id,
                recipe_id,
                image_url,
                caption
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── Toggle like on a post ───────────────────────────────────────────────────
router.post('/posts/:postId/like', authenticate, async (req, res) => {
    try {
        const userId = req.user.id;
        const postId = req.params.postId;

        // Check if already liked
        const { data: existing } = await supabase
            .from('post_likes')
            .select('*')
            .match({ user_id: userId, post_id: postId })
            .single();

        if (existing) {
            // Unlike
            const { error } = await supabase
                .from('post_likes')
                .delete()
                .match({ user_id: userId, post_id: postId });
            if (error) throw error;
            return res.json({ liked: false });
        } else {
            // Like
            const { error } = await supabase
                .from('post_likes')
                .insert({ user_id: userId, post_id: postId });
            if (error) throw error;
            return res.json({ liked: true });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
