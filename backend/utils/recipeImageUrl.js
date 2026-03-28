const axios = require('axios');
const { getHeuristicRecipeImageUrl, ingredientsToText } = require('./recipeImageHeuristic');

/** Words too generic to use for matching stock-photo metadata */
const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'cup', 'cups', 'tbsp', 'tsp', 'oz', 'min', 'mins', 'chopped', 'diced',
    'fresh', 'large', 'small', 'medium', 'optional', 'pinch', 'salt', 'pepper', 'oil', 'water', 'to', 'of',
    'a', 'an', 'slice', 'sliced', 'grams', 'g', 'ml', 'clove', 'cloves', 'can', 'whole', 'dry', 'light',
    'dark', 'about', 'each', 'into', 'mix', 'mixture', 'blend', 'tablespoon', 'teaspoon', 'quantity',
    'amount', 'recipe', 'style', 'homemade', 'organic', 'serving', 'servings',
]);

function getRecipeMatchTokens(recipe) {
    const raw = [
        recipe.title,
        recipe.cuisine,
        recipe.category,
        ingredientsToText(recipe.ingredients),
        Array.isArray(recipe.tags) ? recipe.tags.join(' ') : '',
        recipe.image_query || '',
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    const words = raw.split(/[^a-z0-9]+/i).filter((w) => w.length > 2 && !STOPWORDS.has(w));
    return [...new Set(words)];
}

function scoreImageTextAgainstRecipe(blob, tokens) {
    if (!blob || !tokens.length) return 0;
    const text = blob.toLowerCase();
    let score = 0;
    for (const w of tokens) {
        if (text.includes(w)) score += 2;
    }
    return score;
}

function unsplashPhotoToText(photo) {
    if (!photo) return '';
    const tagTitles = Array.isArray(photo.tags) ? photo.tags.map((x) => x.title || x).join(' ') : '';
    return `${photo.alt_description || ''} ${photo.description || ''} ${tagTitles}`;
}

function pickBestUnsplashUrl(results, recipe) {
    const tokens = getRecipeMatchTokens(recipe);
    if (!results?.length || !tokens.length) return null;
    let bestUrl = null;
    let bestScore = 0;
    for (const photo of results) {
        const blob = unsplashPhotoToText(photo);
        const score = scoreImageTextAgainstRecipe(blob, tokens);
        if (score > bestScore) {
            bestScore = score;
            bestUrl = photo.urls?.regular || photo.urls?.small || null;
        }
    }
    if (bestScore <= 0) return null;
    return bestUrl;
}

function pickBestPexelsUrl(photos, recipe) {
    const tokens = getRecipeMatchTokens(recipe);
    if (!photos?.length || !tokens.length) return null;
    let bestUrl = null;
    let bestScore = 0;
    for (const photo of photos) {
        const score = scoreImageTextAgainstRecipe(photo.alt || '', tokens);
        if (score > bestScore) {
            bestScore = score;
            bestUrl = photo.src?.large || photo.src?.medium || null;
        }
    }
    if (bestScore <= 0) return null;
    return bestUrl;
}

/**
 * Build a search string: prefer LLM image_query, else title + cuisine + ingredient snippet.
 */
function buildSearchQuery(recipe) {
    const iq = (recipe.image_query || '').trim();
    const title = (recipe.title || '').trim();
    const cuisine = (recipe.cuisine || '').trim();
    const ing = ingredientsToText(recipe.ingredients).replace(/\s+/g, ' ').trim().slice(0, 120);

    if (iq) {
        return `${iq} ${cuisine}`.replace(/\s+/g, ' ').trim().slice(0, 200);
    }
    const fallback = [title, cuisine, ing, 'food meal'].filter(Boolean).join(' ');
    return fallback.replace(/\s+/g, ' ').trim().slice(0, 200) || 'food plated';
}

/**
 * Resolve a cover image URL: Unsplash search (best match), Pexels (best match), then heuristic pools.
 * If stock APIs return no keyword-aligned result, falls back to heuristics instead of a random first hit.
 */
async function resolveRecipeImageUrl(recipe) {
    const query = buildSearchQuery(recipe);

    const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
    if (unsplashKey) {
        try {
            const { data } = await axios.get('https://api.unsplash.com/search/photos', {
                params: { query, per_page: 15, orientation: 'landscape', content_filter: 'high' },
                headers: { Authorization: `Client-ID ${unsplashKey}` },
                timeout: 12000,
            });
            let url = pickBestUnsplashUrl(data?.results, recipe);
            if (url) return url;

            const q2 = [recipe.title, recipe.cuisine, 'food'].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim().slice(0, 120);
            if (q2 && q2 !== query) {
                const { data: data2 } = await axios.get('https://api.unsplash.com/search/photos', {
                    params: { query: q2, per_page: 15, orientation: 'landscape', content_filter: 'high' },
                    headers: { Authorization: `Client-ID ${unsplashKey}` },
                    timeout: 12000,
                });
                url = pickBestUnsplashUrl(data2?.results, recipe);
                if (url) return url;
            }
        } catch (e) {
            console.warn('[recipeImageUrl] Unsplash search failed:', e.message);
        }
    }

    const pexelsKey = process.env.PEXELS_API_KEY;
    if (pexelsKey) {
        try {
            const { data } = await axios.get('https://api.pexels.com/v1/search', {
                params: { query, per_page: 15, orientation: 'landscape' },
                headers: { Authorization: pexelsKey },
                timeout: 12000,
            });
            const url = pickBestPexelsUrl(data?.photos, recipe);
            if (url) return url;
        } catch (e) {
            console.warn('[recipeImageUrl] Pexels search failed:', e.message);
        }
    }

    return getHeuristicRecipeImageUrl(recipe);
}

module.exports = { resolveRecipeImageUrl, buildSearchQuery };
