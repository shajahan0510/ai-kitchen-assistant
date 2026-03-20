const axios = require('axios');

// ─── Groq Client Helper ───────────────────────────────────────────────────────
function getGroqKey() {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is missing in environment');
    return key;
}

async function groqChat(messages, opts = {}) {
    const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
            model: opts.model || 'llama-3.3-70b-versatile',
            messages,
            temperature: opts.temperature ?? 0.7,
            max_tokens: opts.max_tokens || 4096,
        },
        {
            headers: {
                'Authorization': `Bearer ${getGroqKey()}`,
                'Content-Type': 'application/json',
            },
        }
    );
    return response.data.choices[0].message.content;
}

// Helper to parse JSON from AI response (strips markdown code blocks)
function parseAiJson(text) {
    const clean = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(clean);
}

// ─── Recipe Suggestions (Groq) ────────────────────────────────────────────────
async function suggestRecipes(ingredients) {
    const prompt = `You are a professional AI Chef. Your specialty is crafting healthy, delicious recipes based on available ingredients. Given these ingredients: ${ingredients.join(', ')}

Return a JSON array of 4 distinct, creative recipe suggestions from different world cuisines (e.g. Italian, Thai, Mexican, Indian, Mediterranean). Each recipe object must have this EXACT structure:
{
  "title": "Recipe Name",
  "cuisine": "e.g. Italian, Thai, Mexican, Indian, etc.",
  "description": "Short appetizing description",
  "ingredients": ["amount + item", "amount + item"],
  "steps": ["Step 1", "Step 2", "Step 3"],
  "cooking_time": "e.g. 20 mins",
  "difficulty": "Easy",
  "servings": 2,
  "nutrition": {
    "calories": 300,
    "protein": "20g",
    "carbs": "35g",
    "fat": "10g"
  },
  "category": "Lunch",
  "tags": ["e.g. Vegan", "Low Carb", "Gluten-Free", "High Protein"]
}
Ensure the output is ONLY the JSON array, no markdown, no explanation.`;

    try {
        const text = await groqChat([{ role: 'user', content: prompt }]);
        const content = parseAiJson(text);
        return Array.isArray(content) ? content : (content.recipes || content.suggestions || []);
    } catch (err) {
        console.error('Groq Suggest API Error:', err.response?.data || err.message);
        throw new Error('AI was unable to generate recipes. Please try again.');
    }
}

// ─── Fridge/Image Scanner (Imagga) ───────────────────────────────────────────
async function scanFridgeImage(base64Image, mimeType) {
    try {
        const apiKey    = process.env.IMAGGA_API_KEY;
        const apiSecret = process.env.IMAGGA_API_SECRET;
        if (!apiKey || !apiSecret) throw new Error('IMAGGA_API_KEY or IMAGGA_API_SECRET missing');

        // Send image to Imagga for tag detection
        const formData = new URLSearchParams();
        formData.append('image_base64', base64Image);

        const tagsRes = await axios.post(
            'https://api.imagga.com/v2/tags',
            formData,
            {
                auth: { username: apiKey, password: apiSecret },
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            }
        );

        const tags = tagsRes.data?.result?.tags || [];

        // Filter to food-related tags with confidence > 15%
        const foodKeywords = ['food', 'vegetable', 'fruit', 'meat', 'dairy', 'bread', 'grain',
            'herb', 'spice', 'sauce', 'ingredient', 'produce', 'seafood', 'poultry', 'egg',
            'cheese', 'milk', 'butter', 'cream', 'oil', 'rice', 'pasta', 'bean', 'nut', 'seed'];

        const ingredients = tags
            .filter(t => t.confidence > 15)
            .map(t => t.tag.en)
            .filter(name => {
                const lower = name.toLowerCase();
                return foodKeywords.some(kw => lower.includes(kw)) || tags.length < 5;
            })
            .slice(0, 15);

        if (!ingredients.length) {
            // Fallback: just return top tags if no food-specific ones found
            return tags.slice(0, 10).map(t => t.tag.en);
        }

        return ingredients;
    } catch (err) {
        console.error('Imagga API Error:', err.response?.data || err.message);
        throw new Error('Image analysis failed. Please try again.');
    }
}

// ─── AI Chef Chatbot (Groq) ───────────────────────────────────────────────────
async function chatWithAssistant(history, userMessage, imageData = null) {
    let contextMessage = userMessage;
    if (imageData) {
        try {
            const tags = await scanFridgeImage(imageData.base64, imageData.mimeType);
            contextMessage = `[User attached an image containing: ${tags.join(', ')}] ${userMessage}`;
        } catch (e) {
            console.warn('Could not analyze image for chat context');
        }
    }

    const systemPrompt = `You are "AI Chef", a friendly and professional kitchen companion and nutrition coach.

Core capabilities:
1. **Recipe Guidance** — Suggest recipes, explain techniques, and help with flavor balancing.
2. **Ingredient Swaps** — Offer practical substitutions for common dietary needs.
3. **Nutrition & Macro Coaching** — Provide clear, evidence-based nutritional advice:
   • Help with weight management, muscle gain, or maintenance.
   • Provide sample daily macro splits.
   • Recommend recipes from their collection.
4. **Meal Planning** — Help organize weekly schedules that hit health targets.

Always be helpful, encouraging, and clear. Use bullet points and bold text for key info. Use relevant emojis.`;

    // Build message history for Groq (OpenAI format)
    const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-10).map(msg => ({
            role: (msg.role === 'bot' || msg.role === 'model' || msg.role === 'assistant') ? 'assistant' : 'user',
            content: msg.content,
        })),
        { role: 'user', content: contextMessage },
    ];

    try {
        return await groqChat(messages, { max_tokens: 1024 });
    } catch (err) {
        console.error('Groq Chat API Error:', err.response?.data || err.message);
        throw new Error('Chatbot connection lost.');
    }
}

// ─── Ingredient Substitution (Groq) ──────────────────────────────────────────
async function suggestSubstitution(recipeTitle, ingredient) {
    const prompt = `A user is preparing "${recipeTitle}" but needs a replacement for "${ingredient}". 
    Suggest 3 practical and tasty substitutes. Explain briefly why each works.`;

    try {
        return await groqChat([{ role: 'user', content: prompt }], { max_tokens: 512 });
    } catch (err) {
        console.error('Groq Substitution Error:', err.response?.data || err.message);
        throw new Error('AI could not provide a substitution at this time.');
    }
}

// ─── Zero-Waste Pantry Intelligence (Groq) ────────────────────────────────────
async function suggestWasteNot(pantryItems) {
    const items = pantryItems.map(p => `${p.item_name} (Expires: ${p.expiry_date || 'N/A'})`).join(', ');
    const prompt = `You are a zero-waste cooking expert. Given these pantry items (some expiring soon): ${items}
    
    Return 2 extremely creative recipe ideas that prioritize using the items closest to their expiry. 
    Format as a JSON object with keys: "idea1" and "idea2", each having "title", "reasoning", and "quick_steps".
    Return ONLY a JSON object, no markdown.`;

    try {
        const text = await groqChat([{ role: 'user', content: prompt }]);
        const content = parseAiJson(text);
        return [content.idea1, content.idea2];
    } catch (err) {
        console.error('Groq WasteNot Error:', err.response?.data || err.message);
        throw new Error('AI was unable to generate zero-waste ideas.');
    }
}

// ─── Reverse-Engineer Image to Recipe (Imagga + Groq) ────────────────────────
async function reverseEngineerFromImage(base64Image, mimeType) {
    // Step 1: Get image tags via Imagga
    const tags = await scanFridgeImage(base64Image, mimeType);

    // Step 2: Ask Groq to reverse-engineer a full recipe from the visual tags
    const prompt = `You are a world-class chef who can identify dishes from their visual description.
An image analysis identified these elements: ${tags.join(', ')}

Based on these visual clues, reverse-engineer the most likely dish and provide a COMPLETE recipe.
Return a JSON object with this EXACT structure:
{
  "title": "Dish Name",
  "cuisine": "e.g. Italian, Thai",
  "description": "Appetizing description of the dish",
  "ingredients": ["amount + item", "amount + item"],
  "steps": ["Step 1", "Step 2", "Step 3"],
  "cooking_time": "e.g. 30 mins",
  "difficulty": "Easy/Medium/Hard",
  "servings": 2,
  "nutrition": { "calories": 400, "protein": "25g", "carbs": "40g", "fat": "15g" },
  "category": "Lunch",
  "tags": ["tag1", "tag2"],
  "confidence": "High/Medium/Low"
}
Return ONLY the JSON object, no markdown.`;

    try {
        const text = await groqChat([{ role: 'user', content: prompt }]);
        return parseAiJson(text);
    } catch (err) {
        console.error('Groq ReverseEngineer Error:', err.response?.data || err.message);
        throw new Error('AI could not reverse-engineer the recipe from this image.');
    }
}

// ─── Smart Recipe Scaling (Groq) ─────────────────────────────────────────────
async function smartScale(recipe, newServings) {
    const prompt = `You are a culinary scientist. A user wants to scale the following recipe from ${recipe.servings || 2} servings to ${newServings} servings.

Recipe: "${recipe.title}"
Original ingredients: ${JSON.stringify(recipe.ingredients)}
Original steps: ${JSON.stringify(recipe.steps)}

IMPORTANT: Do NOT just multiply everything linearly. Apply professional chef knowledge:
- Spices, salt, and seasonings should scale sub-linearly (scale by ~70-80% of the ratio)
- Leavening agents (baking powder/soda) scale sub-linearly
- Cooking times may change for larger batches
- Liquid ratios may need adjustment
- Some steps may need modification (e.g., "use a larger pan")

Return a JSON object:
{
  "ingredients": ["scaled amount + item", ...],
  "steps": ["adjusted step 1", ...],
  "cooking_time": "adjusted time",
  "tips": "Any important notes for scaling this recipe"
}
Return ONLY the JSON object, no markdown.`;

    try {
        const text = await groqChat([{ role: 'user', content: prompt }]);
        return parseAiJson(text);
    } catch (err) {
        console.error('Groq SmartScale Error:', err.response?.data || err.message);
        throw new Error('AI could not scale this recipe.');
    }
}

module.exports = { suggestRecipes, scanFridgeImage, chatWithAssistant, suggestSubstitution, suggestWasteNot, reverseEngineerFromImage, smartScale };
