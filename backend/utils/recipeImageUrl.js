const axios = require('axios');
const { getHeuristicRecipeImageUrl } = require('./recipeImageHeuristic');

function buildSearchQuery(recipe) {
    const q = (recipe.image_query || '').trim();
    if (q) return q.slice(0, 120);
    const parts = [recipe.title, recipe.cuisine, recipe.category].filter(Boolean);
    return parts.join(' ').trim().slice(0, 120) || 'food dish';
}

/**
 * Resolve a cover image URL: Unsplash search, then Pexels, then heuristic pools.
 * @param {object} recipe - may include image_query from LLM
 * @returns {Promise<string>}
 */
async function resolveRecipeImageUrl(recipe) {
    const query = buildSearchQuery(recipe);

    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (unsplashKey) {
        try {
            const { data } = await axios.get('https://api.unsplash.com/search/photos', {
                params: { query, per_page: 8, orientation: 'landscape', content_filter: 'high' },
                headers: { Authorization: `Client-ID ${unsplashKey}` },
                timeout: 8000,
            });
            const first = data?.results?.[0];
            const url = first?.urls?.regular || first?.urls?.small;
            if (url) return url;
        } catch (e) {
            console.warn('[recipeImageUrl] Unsplash search failed:', e.message);
        }
    }

    const pexelsKey = process.env.PEXELS_API_KEY;
    if (pexelsKey) {
        try {
            const { data } = await axios.get('https://api.pexels.com/v1/search', {
                params: { query, per_page: 5, orientation: 'landscape' },
                headers: { Authorization: pexelsKey },
                timeout: 8000,
            });
            const first = data?.photos?.[0];
            const url = first?.src?.large || first?.src?.medium;
            if (url) return url;
        } catch (e) {
            console.warn('[recipeImageUrl] Pexels search failed:', e.message);
        }
    }

    return getHeuristicRecipeImageUrl(recipe);
}

module.exports = { resolveRecipeImageUrl, buildSearchQuery };
