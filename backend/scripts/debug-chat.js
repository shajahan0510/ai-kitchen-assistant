require('dotenv').config();
const { chatWithAssistant } = require('../services/ai');

async function testChat() {
    console.log('--- Chat Debug Test ---');
    const history = [
        { role: 'user', content: 'Hi, I have chicken.' },
        { role: 'model', content: 'Hello! I can help with that. What would you like to make?' }
    ];
    const message = 'Something spicy please.';

    try {
        console.log('Testing with history roles: user, model');
        const reply = await chatWithAssistant(history, message);
        console.log('✅ Reply:', reply);
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

testChat();
