/**
 * Stable keyword + Unsplash-ID pools for recipe cover images (AI suggest + fallback).
 * Keep in sync with frontend/js/recipeImageHeuristic.js
 */

function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0);
}

function pickStable(arr, seedStr) {
    if (!arr?.length) return '';
    const idx = hashString(seedStr || '') % arr.length;
    return arr[idx];
}

function ingredientsToText(ingredients) {
    if (!ingredients) return '';
    if (Array.isArray(ingredients)) return ingredients.join(' ');
    if (typeof ingredients === 'string') {
        try {
            const parsed = JSON.parse(ingredients);
            if (Array.isArray(parsed)) return parsed.join(' ');
        } catch {
            return ingredients;
        }
    }
    return String(ingredients);
}

function normalizeRecipeText(r) {
    const tags = Array.isArray(r?.tags) ? r.tags.join(' ') : '';
    const ing = ingredientsToText(r?.ingredients);
    const desc = (r?.description && String(r.description).slice(0, 200)) || '';
    return `${r?.title || ''} ${r?.category || ''} ${r?.cuisine || ''} ${tags} ${ing} ${desc}`.toLowerCase();
}

/** @param {object} r recipe-like object */
function getHeuristicRecipeImageUrl(r) {
    const t = normalizeRecipeText(r);
    const seed = r?.title || t;

    const pools = {
        mexican: [
            'https://images.unsplash.com/photo-1565299585323-38194c0a7e58?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?auto=format&fit=crop&w=1400&q=80',
        ],
        pizza: [
            'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=1400&q=80',
        ],
        burger: [
            'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1571091712768-4028674b0a34?auto=format&fit=crop&w=1400&q=80',
        ],
        sandwich: [
            'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1509722747041-616f39b57569?auto=format&fit=crop&w=1400&q=80',
        ],
        sushi: [
            'https://images.unsplash.com/photo-1579584425555-c3ce17fd4351?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1611143669185-af23c1f0b2d0?auto=format&fit=crop&w=1400&q=80',
        ],
        ramen: [
            'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1618841557871-b4684ff849c8?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1591814468924-caf88d123234?auto=format&fit=crop&w=1400&q=80',
        ],
        stirfry: [
            'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=1400&q=80',
        ],
        dumpling: [
            'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1585032226651-04b83d314c29?auto=format&fit=crop&w=1400&q=80',
        ],
        kebab: [
            'https://images.unsplash.com/photo-1529042410759-befb1204b468?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?auto=format&fit=crop&w=1400&q=80',
        ],
        falafel: [
            'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1529006557810-274b9b2fc783?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=1400&q=80',
        ],
        beef: [
            'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=1400&q=80',
        ],
        pork: [
            'https://images.unsplash.com/photo-1432139559390-58593dae5771?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=1400&q=80',
        ],
        lamb: [
            'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1603360946369-dc9a625a0b4c?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1558030006-450675393462?auto=format&fit=crop&w=1400&q=80',
        ],
        tofu: [
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1400&q=80',
        ],
        pie: [
            'https://images.unsplash.com/photo-1535920527002-b35e96722eb9?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1400&q=80',
        ],
        muffin: [
            'https://images.unsplash.com/photo-1607958996333-41aef7caef39?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1601004890684-d8cbf643f5f2?auto=format&fit=crop&w=1400&q=80',
        ],
        breakfast: [
            'https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=1400&q=80',
        ],
        salad: [
            'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=1400&q=80',
        ],
        pasta: [
            'https://images.unsplash.com/photo-1521389508051-d7ffb5dc8d8f?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1523986371872-9d3ba2e2f5f6?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1473093226795-af9932fe5856?auto=format&fit=crop&w=1400&q=80',
        ],
        soup: [
            'https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1604909052743-94e838986d24?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1616501268209-9d4e0c2de2ac?auto=format&fit=crop&w=1400&q=80',
        ],
        pho: [
            'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=1400&q=80',
        ],
        curry: [
            'https://images.unsplash.com/photo-1604908176997-125f25cc500f?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=1400&q=80',
        ],
        rice: [
            'https://images.unsplash.com/photo-1604908554162-5b7aee5d7ef3?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1603133872878-684f208fb84b?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=1400&q=80',
        ],
        chicken: [
            'https://images.unsplash.com/photo-1604908177522-402c7ad5d2f1?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=1400&q=80',
        ],
        seafood: [
            'https://images.unsplash.com/photo-1553621042-f6e147245754?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1532634896-26909d0d4b31?auto=format&fit=crop&w=1400&q=80',
        ],
        dessert: [
            'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1511381939415-c1c1b45a6d1a?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=1400&q=80',
        ],
        generic: [
            'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80',
            'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1400&q=80',
        ],
    };

    // Specific dish types first, then proteins, then category fallbacks
    const matchers = [
        { keys: ['taco', 'burrito', 'enchilada', 'quesadilla', 'fajita', 'nacho', 'carnitas', 'carnita'], pool: 'mexican' },
        { keys: ['pizza', 'calzone', 'margherita'], pool: 'pizza' },
        { keys: ['burger', 'sliders'], pool: 'burger' },
        { keys: ['sandwich', 'panini', 'hoagie', 'grilled cheese', 'wrap'], pool: 'sandwich' },
        { keys: ['sushi', 'sashimi', 'maki', 'nigiri', 'poke bowl'], pool: 'sushi' },
        { keys: ['ramen'], pool: 'ramen' },
        { keys: ['pho bowl', 'vietnamese pho', 'beef pho'], pool: 'pho' },
        { keys: ['stir fry', 'stir-fry', 'wok'], pool: 'stirfry' },
        { keys: ['dumpling', 'gyoza', 'wonton', 'potsticker'], pool: 'dumpling' },
        { keys: ['kebab', 'shawarma', 'skewer'], pool: 'kebab' },
        { keys: ['falafel', 'hummus', 'mezze'], pool: 'falafel' },
        { keys: ['pie ', 'quiche', 'pot pie'], pool: 'pie' },
        { keys: ['muffin', 'scone', 'croissant'], pool: 'muffin' },
        { keys: ['pancake', 'waffle', 'omelet', 'omelette', 'oat', 'smoothie', 'granola'], pool: 'breakfast' },
        { keys: ['salad', 'greens', 'caesar'], pool: 'salad' },
        { keys: ['pasta', 'spaghetti', 'noodle', 'lasagna', 'alfredo', 'carbonara', 'penne', 'rigatoni'], pool: 'pasta' },
        { keys: ['soup', 'stew', 'broth', 'chowder', 'bisque', 'gazpacho'], pool: 'soup' },
        { keys: ['curry', 'masala', 'tikka', 'korma', 'vindaloo', 'dal ', 'dahl'], pool: 'curry' },
        { keys: ['biryani', 'risotto', 'fried rice', 'paella', 'jambalaya'], pool: 'rice' },
        { keys: ['steak', 'beef ', 'brisket', 'ribs'], pool: 'beef' },
        { keys: ['pork', 'bacon', 'ham ', 'sausage', 'chorizo'], pool: 'pork' },
        { keys: ['lamb', 'mutton'], pool: 'lamb' },
        { keys: ['tofu', 'tempeh', 'seitan'], pool: 'tofu' },
        { keys: ['chicken', 'turkey', 'duck '], pool: 'chicken' },
        { keys: ['fish', 'salmon', 'tuna', 'cod', 'shrimp', 'prawn', 'prawns', 'seafood', 'lobster', 'crab', 'mussel', 'scallop'], pool: 'seafood' },
        { keys: ['cake', 'cookie', 'brownie', 'dessert', 'sweet', 'chocolate', 'tiramisu', 'pudding', 'ice cream'], pool: 'dessert' },
    ];

    for (const m of matchers) {
        if (m.keys.some((k) => t.includes(k))) return pickStable(pools[m.pool], seed);
    }

    const cuisine = (r?.cuisine || '').toLowerCase();
    if (cuisine.includes('mexican') || cuisine.includes('tex-mex') || cuisine.includes('tex mex')) return pickStable(pools.mexican, seed);
    if (cuisine.includes('italian')) return pickStable(pools.pasta, seed);
    if (cuisine.includes('thai') || cuisine.includes('indian') || cuisine.includes('vietnamese') || cuisine.includes('malaysian')) return pickStable(pools.curry, seed);
    if (cuisine.includes('japanese')) return pickStable(pools.ramen, seed);
    if (cuisine.includes('korean') || cuisine.includes('chinese')) return pickStable(pools.stirfry, seed);
    if (cuisine.includes('greek') || cuisine.includes('mediterranean') || cuisine.includes('lebanese') || cuisine.includes('middle eastern')) return pickStable(pools.salad, seed);
    if (cuisine.includes('american') || cuisine.includes('bbq') || cuisine.includes('southern')) return pickStable(pools.burger, seed);
    if (cuisine.includes('french')) return pickStable(pools.generic, seed);

    const cat = (r?.category || '').toLowerCase();
    if (cat.includes('dessert')) return pickStable(pools.dessert, seed);
    if (cat.includes('breakfast')) return pickStable(pools.breakfast, seed);
    if (cat.includes('lunch')) return pickStable(pools.salad, seed);
    if (cat.includes('dinner')) return pickStable(pools.generic, seed);
    return pickStable(pools.generic, seed);
}

module.exports = {
    hashString,
    pickStable,
    normalizeRecipeText,
    getHeuristicRecipeImageUrl,
    ingredientsToText,
};
