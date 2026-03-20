const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { body } = require('express-validator');
const { validate } = require('../middleware/validate');

// ─── GET /api/chat/feedback ──────────────────────────────────────────────────
// Get or create the unique feedback conversation between current user and admin
router.get('/feedback', authenticate, async (req, res) => {
    try {
        // 1. Find an admin user
        const { data: adminUser, error: adminErr } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin')
            .limit(1)
            .single();

        if (adminErr || !adminUser) {
            return res.status(404).json({ error: "No administrator available to receive feedback." });
        }

        // 2. Check if a conversation already exists
        const { data: existing } = await supabase.rpc('get_conversation_between', {
            uid1: req.user.id,
            uid2: adminUser.id
        });

        if (existing && existing.length > 0) {
            return res.json(existing[0]);
        }

        // 3. Create new feedback conversation
        const { data: conv, error: convErr } = await supabase
            .from('conversations')
            .insert({ last_message: 'Started feedback thread' })
            .select()
            .single();

        if (convErr) throw convErr;

        // 4. Add user and admin as members
        const { error: memErr } = await supabase
            .from('conversation_members')
            .insert([
                { conversation_id: conv.id, user_id: req.user.id, status: 'accepted' },
                { conversation_id: conv.id, user_id: adminUser.id, status: 'accepted' }
            ]);

        if (memErr) throw memErr;

        res.status(201).json(conv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/chat/messages/:id ──────────────────────────────────────────────
router.get('/messages/:id', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('conversation_id', req.params.id)
            .order('created_at', { ascending: true });

        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/chat/messages ──────────────────────────────────────────────────
router.post('/messages', authenticate, [
    body('conversation_id').isUUID(),
    body('content').trim().notEmpty()
], validate, async (req, res) => {
    const { conversation_id, content } = req.body;
    try {
        const { data, error } = await supabase
            .from('messages')
            .insert({ conversation_id, sender_id: req.user.id, content })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── GET /api/chat/admin/inbox (ADMIN ONLY) ──────────────────────────────────
router.get('/admin/inbox', authenticate, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Unauthorized" });

    try {
        const { data, error } = await supabase
            .from('conversations')
            .select(`
                *,
                members:conversation_members (
                    user:user_id (id, username, avatar_url)
                )
            `)
            .order('last_message_at', { ascending: false });

        if (error) throw error;

        // Process threads to find the non-admin participant
        const threads = (data || []).map(c => {
            if (!c.members || c.members.length === 0) return { ...c, user: null };

            // Look for the member who is NOT an admin in the profiles table logic
            // Or just the one that isn't the current requester if possible
            let userMember = c.members.find(m => m.user && m.user.id !== req.user.id);

            // Fallback: if we are an admin and the only other person in the chat is another admin...
            // It should ideally shows the person who is NOT the current admin.
            if (!userMember && c.members.length > 0) {
                userMember = c.members[0]; // Just pick anyone if we can't find a direct match
            }

            return {
                ...c,
                user: userMember && userMember.user ? userMember.user : { username: 'Unknown User', id: 'unknown' }
            };
        }).filter(t => t.user);

        res.json(threads);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
