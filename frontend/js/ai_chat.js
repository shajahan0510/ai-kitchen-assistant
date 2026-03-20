/* ═══════════════════════════════════════════════════════════════
   ai_chat.js — Dedicated logic for the Chef AI Assistant
   ═══════════════════════════════════════════════════════════════ */

let aiChatHistory = [];

async function initAIChat() {
    const chatContent = document.getElementById('aiChatContent');
    if (!chatContent) return;

    // Initial greeting if empty
    if (chatContent.innerHTML === '') {
        addAIChatMessage('bot', "Hello! I'm your Kitchen AI Assistant. How can I help you today? You can ask me for recipes, substitutions, or cooking tips!");
    }
}

async function sendAIChat(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('aiChatInput');
    const content = input.value.trim();
    if (!content) return;

    // UI: Add user message
    addAIChatMessage('user', content);
    input.value = '';

    // Show typing indicator
    const typingId = 'typing-' + Date.now();
    addTypingIndicator(typingId);

    try {
        const res = await apiFetch('/api/ai/chat', {
            method: 'POST',
            body: JSON.stringify({
                message: content,
                history: aiChatHistory
            })
        });

        const data = await res.json();
        removeTypingIndicator(typingId);

        if (data.reply) {
            addAIChatMessage('bot', data.reply);
            aiChatHistory.push({ role: 'user', content });
            aiChatHistory.push({ role: 'assistant', content: data.reply });

            // Limit history
            if (aiChatHistory.length > 20) aiChatHistory = aiChatHistory.slice(-20);
        } else {
            throw new Error(data.error || 'AI failed to respond');
        }

    } catch (err) {
        removeTypingIndicator(typingId);
        addAIChatMessage('bot', "⚠️ Sorry, I'm having trouble connecting right now. Please try again.");
    }
}

function addAIChatMessage(role, text) {
    const container = document.getElementById('aiChatContent');
    if (!container) return;

    const div = document.createElement('div');
    div.className = `msg-bubble ${role === 'user' ? 'msg-mine' : 'msg-theirs'}`;
    div.innerHTML = `
        ${role === 'bot' ? '<div style="font-size:0.7rem; font-weight:700; margin-bottom:4px; opacity:0.6;">Chef Assistant</div>' : ''}
        ${text.replace(/\n/g, '<br>')}
        <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addTypingIndicator(id) {
    const container = document.getElementById('aiChatContent');
    const div = document.createElement('div');
    div.id = id;
    div.className = 'msg-bubble msg-theirs';
    div.style.opacity = '0.6';
    div.innerHTML = '<span class="typing-dots">Chef is thinking...</span>';
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}
