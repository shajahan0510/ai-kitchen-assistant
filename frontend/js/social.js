// social.js logic is now called explicitly by dashboard.js

async function loadSocialFeed() {
    const feedContainer = document.getElementById('socialFeed');
    if (!feedContainer) return;

    try {
        const response = await apiFetch('/api/social/feed');
        const posts = await response.json();

        // Robustness: Handle non-array or error responses
        if (!Array.isArray(posts)) {
            const errorMsg = posts.error || 'Failed to load community feed';
            feedContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <p>${errorMsg}</p>
                    <button class="btn btn-ghost btn-sm" onclick="loadSocialFeed()">🔄 Retry</button>
                </div>`;
            return;
        }

        if (posts.length === 0) {
            feedContainer.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🌟</div>
                    <p>No posts yet. Be the first to share your creation!</p>
                </div>`;
            return;
        }

        feedContainer.innerHTML = posts.map(post => `
            <div class="social-post-card glass section-fade-in">
                <div class="post-image-box">
                    <img src="${post.image_url}" alt="Cooked dish" loading="lazy">
                </div>
                <div class="post-content">
                    <div class="post-header">
                        <img src="${post.author?.avatar_url || 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + post.author_id}" class="post-avatar">
                        <span class="post-author">${post.author?.username || 'Chef'}</span>
                    </div>
                    <p class="post-caption">${post.caption || ''}</p>
                    <div class="post-actions">
                        <button class="btn-heart ${post.liked_by_me ? 'active' : ''}" onclick="toggleLike('${post.id}', this)">
                            ❤️ <span class="like-count">${post.likes_count || 0}</span>
                        </button>
                        ${post.recipe ? `<span class="badge badge-sm">${post.recipe.title}</span>` : ''}
                    </div>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('Feed load error:', err);
        feedContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">❌</div>
                <p>Connection error. Please check your internet.</p>
                <button class="btn btn-ghost btn-sm" onclick="loadSocialFeed()">🔄 Retry</button>
            </div>`;
    }
}

async function toggleLike(postId, btn) {
    try {
        const res = await apiFetch('/api/social/posts/' + postId + '/like', { method: 'POST' });
        const { liked } = await res.json();
        const countSpan = btn.querySelector('.like-count');
        let currentCount = parseInt(countSpan.innerText);

        if (liked) {
            btn.classList.add('active');
            countSpan.innerText = currentCount + 1;
        } else {
            btn.classList.remove('active');
            countSpan.innerText = Math.max(0, currentCount - 1);
        }
    } catch (err) {
        console.error('Like error:', err);
    }
}
