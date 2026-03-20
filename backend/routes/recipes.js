const express = require('express');
const { body } = require('express-validator');
const multer = require('multer');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { generalLimiter } = require('../middleware/rateLimiter');
const supabase = require('../config/supabase');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ─── GET /api/recipes ─────────────────────────────────────────────────────────
router.get('/', generalLimiter, async (req, res) => {
    try {
        const { category, search, author_id, sort = 'created_at', order = 'desc', limit = 12, page = 1 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let q = supabase
            .from('recipes')
            .select('*, profiles:author_id(username, avatar_url)', { count: 'exact' })
            .order(sort, { ascending: order === 'asc' })
            .range(offset, offset + parseInt(limit) - 1);

        if (category) q = q.eq('category', category);
        if (author_id) q = q.eq('author_id', author_id);
        if (search) {
            // Search in title, tags (JSONB array), and ingredients (JSONB array)
            // Note: Postgres JSONB search for partial matches often requires casting or specific operators.
            // For now, we'll search title and use the 'cs' (contains) operator which looks for exact string matches in the array.
            q = q.or(`title.ilike.%${search}%,tags.cs.{"${search}"},ingredients.cs.{"${search}"}`);
        }

        const { data, error, count } = await q;
        if (error) throw error;
        res.json({ recipes: data, total: count, page: parseInt(page), limit: parseInt(limit) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/recipes/trending ────────────────────────────────────────────────
router.get('/trending', generalLimiter, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('recipes')
            .select('*, profiles:author_id(username, avatar_url)')
            .order('is_featured', { ascending: false })
            .order('views', { ascending: false })
            .limit(10);
        if (error) throw error;
        // Boost featured recipes in the manual sort as well
        const sorted = data.sort((a, b) => {
            if (a.is_featured !== b.is_featured) return b.is_featured ? 1 : -1;
            return (b.views + b.likes * 3) - (a.views + a.likes * 3);
        });
        res.json({ recipes: sorted });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /api/recipes/:id ─────────────────────────────────────────────────────
router.get('/:id', generalLimiter, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('recipes')
            .select('*, profiles:author_id(username, avatar_url)')
            .eq('id', req.params.id)
            .single();
        if (error || !data) return res.status(404).json({ error: 'Recipe not found' });
        await supabase.from('recipes').update({ views: data.views + 1 }).eq('id', req.params.id);
        res.json({ recipe: { ...data, views: data.views + 1 } });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/recipes ────────────────────────────────────────────────────────
router.post('/', authenticate, upload.single('image'),
    [
        body('title').trim().isLength({ min: 3, max: 100 }).withMessage('Title must be 3–100 chars'),
        body('category').isIn(['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert']).withMessage('Invalid category'),
        body('cooking_time').notEmpty().withMessage('Cooking time required'),
    ],
    validate,
    async (req, res) => {
        try {
            const { title, description, ingredients, steps, category, cooking_time, cuisine, nutrition } = req.body;
            let image_url = null;

            if (req.file) {
                const filename = `recipes/${Date.now()}-${req.file.originalname}`;
                const { error: uploadError } = await supabase.storage
                    .from('recipe-images').upload(filename, req.file.buffer, { contentType: req.file.mimetype });
                if (!uploadError) {
                    const { data: urlData } = supabase.storage.from('recipe-images').getPublicUrl(filename);
                    image_url = urlData.publicUrl;
                }
            }

            const { data, error } = await supabase.from('recipes').insert({
                author_id: req.user.id, title, description,
                cuisine: cuisine || 'Global',
                ingredients: typeof ingredients === 'string' ? JSON.parse(ingredients) : ingredients,
                steps: typeof steps === 'string' ? JSON.parse(steps) : steps,
                category, cooking_time,
                tags: req.body.tags ? (typeof req.body.tags === 'string' ? JSON.parse(req.body.tags) : req.body.tags) : [],
                nutrition: nutrition ? (typeof nutrition === 'string' ? JSON.parse(nutrition) : nutrition) : null,
                image_url,
            }).select().single();

            if (error) throw error;
            res.status(201).json({ recipe: data });
        } catch (err) { res.status(500).json({ error: err.message }); }
    }
);

// ─── PUT /api/recipes/:id ─────────────────────────────────────────────────────
router.put('/:id', authenticate, async (req, res) => {
    try {
        const { data: recipe } = await supabase.from('recipes').select('author_id').eq('id', req.params.id).single();
        if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
        if (recipe.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
        const { title, description, ingredients, steps, category, cooking_time, nutrition } = req.body;
        const { data, error } = await supabase.from('recipes')
            .update({ title, description, ingredients, steps, category, cooking_time, nutrition })
            .eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json({ recipe: data });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/recipes/:id/remix ──────────────────────────────────────────────
router.post('/:id/remix', authenticate, async (req, res) => {
    try {
        const recipeId = req.params.id;
        const { data: original, error: fetchError } = await supabase
            .from('recipes')
            .select('*')
            .eq('id', recipeId)
            .single();

        if (fetchError || !original) return res.status(404).json({ error: 'Original recipe not found' });

        // Create the remixed recipe
        const newRecipe = {
            title: `Remix of ${original.title}`,
            description: original.description,
            ingredients: original.ingredients,
            steps: original.steps,
            image_url: original.image_url,
            category: original.category,
            cooking_time: original.cooking_time,
            nutrition: original.nutrition,
            author_id: req.user.id,
            original_recipe_id: original.id // The new column added in the DB migration
        };

        const { data, error: insertError } = await supabase
            .from('recipes')
            .insert(newRecipe)
            .select()
            .single();

        if (insertError) throw insertError;
        res.status(201).json({ message: 'Recipe remixed successfully!', recipe: data });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── DELETE /api/recipes/:id ──────────────────────────────────────────────────
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { data: recipe } = await supabase.from('recipes').select('author_id').eq('id', req.params.id).single();
        if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
        if (recipe.author_id !== req.user.id && req.user.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
        await supabase.from('recipes').delete().eq('id', req.params.id);
        res.json({ message: 'Recipe deleted' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── POST /api/recipes/:id/like ───────────────────────────────────────────────
router.post('/:id/like', authenticate, async (req, res) => {
    try {
        const { data: existing } = await supabase.from('recipe_likes')
            .select('*').eq('user_id', req.user.id).eq('recipe_id', req.params.id).single();
        if (existing) {
            await supabase.from('recipe_likes').delete().eq('user_id', req.user.id).eq('recipe_id', req.params.id);
            // Redundant: likes count updated by DB trigger on_recipe_like
            return res.json({ liked: false });
        }
        await supabase.from('recipe_likes').insert({ user_id: req.user.id, recipe_id: req.params.id });
        // Redundant: likes count updated by DB trigger on_recipe_like
        res.json({ liked: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
