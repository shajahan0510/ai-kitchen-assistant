/* ═══════════════════════════════════════════════════════════════
   chat.js — User-side Feedback Messaging logic (Instagram style)
   ═══════════════════════════════════════════════════════════════ */

let activeConversation = null;
let chatInterval = null;

async function initChat() {
    // Both admins and users can use this shared feedback logic on the dashboard
    // Though admins typically use admin.html for the full inbox experience.
    await loadFeedbackThread();
}

// ─── USER FLOW: Single Feedback Thread ──────────────────────────────────────
async function loadFeedbackThread() {
    try {
        const res = await apiFetch('/api/chat/feedback');
        const conv = await res.json();
        if (conv.error) throw new Error(conv.error);

        activeConversation = conv;

        // Populate Sidebar Snippet
        const dmList = document.getElementById('dmList');
        if (dmList) {
            dmList.innerHTML = `
                <div class="dm-thread-item active">
                    <div class="dm-avatar">🛡️</div>
                    <div class="dm-thread-info">
                        <div class="dm-thread-name">Admin Support</div>
                        <div class="dm-thread-snippet">${conv.last_message || 'Active support thread'}</div>
                    </div>
                </div>
            `;
        }

        // Setup Chat Header
        const activeName = document.getElementById('dmActiveUsername');
        if (activeName) activeName.textContent = 'Admin Support';

        // Load Messages
        await loadMessages();

        // Auto-refresh
        if (chatInterval) clearInterval(chatInterval);
        chatInterval = setInterval(loadMessages, 5000);

    } catch (err) {
        const contentEl = document.getElementById('dmChatContent');
        if (contentEl) {
            contentEl.innerHTML = `<div class="dm-empty-state"><h3>⚠️ Error</h3><p>${err.message}</p></div>`;
        }
    }
}

async function loadMessages() {
    if (!activeConversation) return;
    try {
        const res = await apiFetch(`/api/chat/messages/${activeConversation.id}`);
        const msgs = await res.json();

        const contentEl = document.getElementById('dmChatContent');
        const user = getUser();
        if (!contentEl) return;

        contentEl.innerHTML = msgs.map(m => {
            const isMine = m.sender_id === user.id;
            return `
                <div class="msg-bubble ${isMine ? 'msg-mine' : 'msg-theirs'}">
                    ${m.content}
                    <span class="msg-time">${new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
        }).join('');

        // Auto scroll to bottom
        contentEl.scrollTop = contentEl.scrollHeight;

    } catch (err) {
        console.error('Failed to load messages:', err);
    }
}

async function sendMessage(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('dmChatInput');
    if (!input) return;

    const content = input.value.trim();
    if (!content || !activeConversation) return;

    try {
        const res = await apiFetch('/api/chat/messages', {
            method: 'POST',
            body: JSON.stringify({
                conversation_id: activeConversation.id,
                content
            })
        });

        if (!res.ok) throw new Error('Send failed');

        input.value = '';
        await loadMessages();

        // Update snippet in sidebar
        const snippet = document.querySelector('.dm-thread-snippet');
        if (snippet) snippet.textContent = content;

    } catch (err) {
        if (typeof showToast === 'function') showToast(err.message, 'error');
        else alert(err.message);
    }
}

// Cleanup functions to remove old DM logic references
function searchChefs() { }
function startNewChat() { }
function acceptInvite() { }
function declineInvite() { }
