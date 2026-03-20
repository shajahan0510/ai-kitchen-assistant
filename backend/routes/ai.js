const express = require('express');
const { body } = require('express-validator');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { aiLimiter } = require('../middleware/rateLimiter');
const { suggestRecipes, scanFridgeImage, chatWithAssistant } = require('../services/ai');
const supabase = require('../config/supabase');

const router = express.Router();

// All AI routes require authentication + rate limiting
router.use(authenticate, aiLimiter);

// ─── POST /api/ai/suggest ─────────────────────────────────────────────────────
router.post('/suggest',
    [body('ingredients').isArray({ min: 1 }).withMessage('Provide at least one ingredient')],
    validate,
    async (req, res) => {
        try {
            const suggestions = await suggestRecipes(req.body.ingredients);

            // Automatically save these to the central recipe table so they show up for everyone
            const savedRecipes = [];
            for (const r of suggestions) {
                const { data, error } = await supabase.from('recipes').insert({
                    author_id: req.user.id,
                    cuisine: r.cuisine || 'Global',
                    title: r.title,
                    description: r.description,
                    ingredients: r.ingredients,
                    steps: r.steps,
                    category: r.category,
                    tags: r.tags || [],
                    cooking_time: r.cooking_time,
                    nutrition: r.nutrition,
                    servings: r.servings || 2,
                    is_ai_draft: true
                }).select().single();

                if (!error && data) savedRecipes.push(data);
            }

            res.json({ recipes: savedRecipes.length > 0 ? savedRecipes : suggestions });
        } catch (err) {
            console.error('AI suggest error:', err);
            res.status(500).json({ error: 'AI service error. Please try again.' });
        }
    }
);

// ─── POST /api/ai/scan-fridge ─────────────────────────────────────────────────
router.post('/scan-fridge',
    [
        body('image').notEmpty().withMessage('Image data required'),
        body('mimeType').notEmpty().withMessage('MIME type required'),
    ],
    validate,
    async (req, res) => {
        try {
            const ingredients = await scanFridgeImage(req.body.image, req.body.mimeType);
            res.json({ ingredients });
        } catch (err) {
            console.error('Fridge scan error:', err);
            res.status(500).json({ error: 'Image analysis failed. Please try again.' });
        }
    }
);

// ─── POST /api/ai/chat ────────────────────────────────────────────────────────
router.post('/chat',
    [body('message').trim().notEmpty().withMessage('Message is required')],
    validate,
    async (req, res) => {
        try {
            const { message, history = [], image = null } = req.body;
            console.log(`[AI Chat] Request from ${req.user.id}: ${message.substring(0, 20)}...`);
            const reply = await chatWithAssistant(history, message, image);
            console.log(`[AI Chat] Reply: ${reply.substring(0, 20)}...`);
            res.json({ reply });
        } catch (err) {
            console.error('Chatbot error:', err);
            res.status(500).json({ error: 'Chatbot error. Please try again.' });
        }
    }
);

// ─── POST /api/ai/substitute ──────────────────────────────────────────────────
router.post('/substitute',
    [
        body('recipeTitle').trim().notEmpty(),
        body('ingredient').trim().notEmpty()
    ],
    validate,
    async (req, res) => {
        try {
            const { recipeTitle, ingredient } = req.body;
            const { suggestSubstitution } = require('../services/ai');
            const tips = await suggestSubstitution(recipeTitle, ingredient);
            res.json({ tips });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// ─── POST /api/ai/waste-not ──────────────────────────────────────────────────
router.post('/waste-not', async (req, res) => {
    try {
        const { suggestWasteNot } = require('../services/ai');
        // Fetch user's pantry items
        const { data: pantryItems, error } = await supabase
            .from('pantry')
            .select('*')
            .eq('user_id', req.user.id)
            .order('expiry_date', { ascending: true })
            .limit(10);

        if (error) throw error;
        if (!pantryItems || pantryItems.length === 0) {
            return res.status(404).json({ error: 'No pantry items to analyze.' });
        }

        const ideas = await suggestWasteNot(pantryItems);
        res.json({ ideas });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ─── POST /api/ai/image-to-recipe ────────────────────────────────────────────
router.post('/image-to-recipe',
    [
        body('image').notEmpty().withMessage('Image data required'),
        body('mimeType').notEmpty().withMessage('MIME type required'),
    ],
    validate,
    async (req, res) => {
        try {
            const { reverseEngineerFromImage } = require('../services/ai');
            const recipe = await reverseEngineerFromImage(req.body.image, req.body.mimeType);
            res.json({ recipe });
        } catch (err) {
            console.error('Image-to-recipe error:', err);
            res.status(500).json({ error: err.message || 'Could not reverse-engineer this image.' });
        }
    }
);

// ─── POST /api/ai/smart-scale ────────────────────────────────────────────────
router.post('/smart-scale',
    [
        body('recipe').isObject().withMessage('Recipe object required'),
        body('servings').isInt({ min: 1, max: 50 }).withMessage('Servings must be 1-50'),
    ],
    validate,
    async (req, res) => {
        try {
            const { smartScale } = require('../services/ai');
            const scaled = await smartScale(req.body.recipe, req.body.servings);
            res.json({ scaled });
        } catch (err) {
            console.error('Smart scale error:', err);
            res.status(500).json({ error: err.message || 'Could not scale this recipe.' });
        }
    }
);

module.exports = router;
