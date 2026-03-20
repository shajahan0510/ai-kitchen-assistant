/* ═══════════════════════════════════════════════════════════════
   chatbot.js  — AI Chef Chatbot with text + image support
   ═══════════════════════════════════════════════════════════════ */

let chatHistory = [];
let chatImageData = null;

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const message = input.value.trim();
    if (!message && !chatImageData) return;

    const sendBtn = document.getElementById('chatSendBtn');
    sendBtn.disabled = true;
    input.value = '';

    appendChatMessage('user', message, chatImageData?.preview);

    const imagePayload = chatImageData ? { base64: chatImageData.base64, mimeType: chatImageData.mimeType } : null;
    chatImageData = null;
    document.getElementById('chatImagePreviewContainer').innerHTML = '';

    const typingId = 'typing_' + Date.now();
    appendTypingIndicator(typingId);

    try {
        const res = await apiFetch('/api/ai/chat', {
            method: 'POST',
            body: JSON.stringify({ message, history: chatHistory.slice(-10), image: imagePayload }),
        });
        const data = await res.json();
        removeTypingIndicator(typingId);
        if (!res.ok) throw new Error(data.error || 'Chatbot error');
        appendChatMessage('bot', data.reply);
        chatHistory.push({ role: 'user', content: message });
        chatHistory.push({ role: 'model', content: data.reply });
    } catch (err) {
        removeTypingIndicator(typingId);
        appendChatMessage('bot', `❌ ${err.message}`);
    } finally {
        sendBtn.disabled = false;
    }
}

function handleChatKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
}

function appendChatMessage(role, text, imagePreview = null) {
    const container = document.getElementById('chatMessages');
    const isUser = role === 'user';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = `chat-msg ${isUser ? 'user' : 'bot'}`;
    div.innerHTML = `
    <div class="msg-avatar">${isUser ? '👤' : '🍳'}</div>
    <div class="chat-msg-content">
      <div class="msg-bubble">
        ${imagePreview ? `<img src="${imagePreview}" alt="Attached image" />` : ''}
        ${formatChatText(text)}
      </div>
      <div class="msg-time">${time}</div>
    </div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function formatChatText(text) {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n•\s/g, '<br>• ')
        .replace(/\n- /g, '<br>• ')
        .replace(/\n/g, '<br>');
}

function appendTypingIndicator(id) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = 'chat-msg bot'; div.id = id;
    div.innerHTML = `<div class="msg-avatar">🍳</div>
    <div class="msg-bubble"><div class="typing-indicator">
      <div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div>
    </div></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function removeTypingIndicator(id) { document.getElementById(id)?.remove(); }

function handleChatImage(input) {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        chatImageData = { base64: dataUrl.split(',')[1], mimeType: file.type, preview: dataUrl };
        document.getElementById('chatImagePreviewContainer').innerHTML = `
      <div class="chat-image-preview">
        <img src="${dataUrl}" alt="Attached" />
        <button class="remove-preview" onclick="removeChatImage()">✕</button>
      </div>`;
    };
    reader.readAsDataURL(file);
    input.value = '';
}

function removeChatImage() {
    chatImageData = null;
    document.getElementById('chatImagePreviewContainer').innerHTML = '';
}
