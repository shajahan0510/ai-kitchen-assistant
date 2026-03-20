const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const axios = require('axios');

async function testConnection() {
    console.log('--- Groq & Imagga Connection Diagnostic ---');
    console.log('CWD:', process.cwd());
    console.log('GROQ_API_KEY present:', !!process.env.GROQ_API_KEY);
    console.log('IMAGGA_API_KEY present:', !!process.env.IMAGGA_API_KEY);

    if (!process.env.GROQ_API_KEY) {
        console.error('Error: GROQ_API_KEY is missing');
        return;
    }

    try {
        console.log('Sending test prompt to Groq...');
        const res = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'Say "Connected"' }],
                max_tokens: 10,
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        console.log('Response:', res.data.choices[0].message.content);
        console.log('--- TEST PASSED ---');
    } catch (err) {
        console.error('--- TEST FAILED ---');
        console.error('Error Message:', err.response?.data || err.message);
    }
}

testConnection().catch(err => {
    console.error('Fatal Uncaught Error:', err);
});
