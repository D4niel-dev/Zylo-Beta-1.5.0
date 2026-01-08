
/**
 * moments.js - Logic for the Moments/Explore feed
 */

async function loadMomentsFeed() {
    const container = document.getElementById('momentsFeed');
    if (!container) return;
    container.innerHTML = '<div class="text-center py-8"><div class="animate-spin w-8 h-8 border-2 border-discord-blurple border-t-transparent rounded-full mx-auto"></div></div>';

    try {
        const res = await fetch('/api/explore/posts');
        const data = await res.json();

        if (data.success) {
            if (data.posts.length === 0) {
                container.innerHTML = '<div class="text-center text-discord-gray-500 py-10">No moments yet. Share yours!</div>';
                return;
            }
            container.innerHTML = data.posts.map(post => renderMomentCard(post)).join('');
            if (feather) feather.replace();
        }
    } catch (err) {
        console.error('Failed to load moments:', err);
        container.innerHTML = '<div class="text-center text-red-400">Failed to load feed</div>';
    }
}

function renderMomentCard(post) {
    const isLiked = post.reactions && post.reactions.includes(localStorage.getItem('username'));
    const likeCount = post.reactions ? post.reactions.length : 0;
    const comments = post.comments || [];

    return `
    <div class="bg-discord-gray-800 rounded-lg p-4 shadow-sm animate-fadeIn">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-full bg-discord-gray-700 overflow-hidden">
           <img src="/images/default_avatar.png" class="w-full h-full object-cover">
        </div>
        <div>
          <div class="font-semibold text-white">${post.username}</div>
          <div class="text-xs text-discord-gray-400">${new Date(post.createdAt * 1000).toLocaleString()}</div>
        </div>
      </div>
      
      <div class="mb-3 text-discord-gray-100 whitespace-pre-wrap">${post.caption}</div>
      
      ${post.url ? `<div class="mb-3 rounded-lg overflow-hidden bg-black max-h-[400px] flex items-center justify-center">
        <img src="${post.url}" class="max-w-full max-h-[400px] object-contain" loading="lazy">
      </div>` : ''}
      
      <div class="flex items-center gap-4 border-t border-discord-gray-700 pt-3">
        <button onclick="reactToMoment('${post.id}')" class="flex items-center gap-2 ${isLiked ? 'text-red-500' : 'text-discord-gray-400 hover:text-red-400'} transition">
          <i data-feather="heart" class="${isLiked ? 'fill-current' : ''} w-5 h-5"></i>
          <span>${likeCount || 'Like'}</span>
        </button>
        <button onclick="document.getElementById('commentInput-${post.id}').focus()" class="flex items-center gap-2 text-discord-gray-400 hover:text-white transition">
          <i data-feather="message-square" class="w-5 h-5"></i>
          <span>Comment</span>
        </button>
      </div>

      <!-- Comments Section -->
      ${comments.length > 0 ? `
        <div class="mt-3 space-y-2 pl-4 border-l-2 border-discord-gray-700">
          ${comments.slice(-3).map(c => `
            <div class="text-sm">
              <span class="font-semibold text-white text-xs">${c.username}</span>: 
              <span class="text-discord-gray-300">${c.text}</span>
            </div>
          `).join('')}
          ${comments.length > 3 ? `<div class="text-xs text-discord-gray-500 cursor-pointer">View all ${comments.length} comments</div>` : ''}
        </div>
      ` : ''}
      
      <div class="mt-3 flex gap-2">
        <input id="commentInput-${post.id}" type="text" placeholder="Write a comment..." 
          class="flex-1 bg-discord-gray-900 border-none rounded-full px-4 py-2 text-sm text-white focus:ring-1 focus:ring-discord-blurple"
          onkeydown="if(event.key === 'Enter') commentOnMoment('${post.id}', this.value)">
      </div>
    </div>
  `;
}

async function reactToMoment(postId) {
    const username = localStorage.getItem('username');
    if (!username) return;

    try {
        const res = await fetch('/api/moments/react', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, username })
        });
        const data = await res.json();
        if (data.success) {
            loadMomentsFeed();
        }
    } catch (e) { console.error(e); }
}

async function commentOnMoment(postId, text) {
    const username = localStorage.getItem('username');
    if (!username || !text.trim()) return;

    try {
        const res = await fetch('/api/moments/comment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ postId, username, comment: text })
        });
        const data = await res.json();
        if (data.success) {
            loadMomentsFeed();
        }
    } catch (e) { console.error(e); }
}

async function sendPost(payload) {
    try {
        const res = await fetch('/api/explore/posts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('momentsCaption').value = '';
            document.getElementById('momentsFile').value = '';
            loadMomentsFeed();
        } else {
            alert('Failed: ' + data.error);
        }
    } catch (e) {
        console.error(e);
        alert('Error posting');
    } finally {
        const btn = document.getElementById('momentsShareBtn');
        if (btn) {
            btn.disabled = false;
            btn.textContent = 'Share';
        }
    }
}

// Share Button Logic - use DOMContentLoaded to attach safely
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('momentsShareBtn')?.addEventListener('click', async () => {
        const caption = document.getElementById('momentsCaption').value;
        const fileInput = document.getElementById('momentsFile');
        const file = fileInput.files[0];
        const username = localStorage.getItem('username');

        if (!username) return alert('Please log in');
        if (!caption && !file) return; // Empty

        const btn = document.getElementById('momentsShareBtn');
        btn.disabled = true;
        btn.textContent = 'Posting...';

        const payload = {
            username,
            caption,
            fileData: null,
            fileName: null
        };

        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                payload.fileData = e.target.result;
                payload.fileName = file.name;
                await sendPost(payload);
            };
            reader.readAsDataURL(file);
        } else {
            if (!file) {
                alert("Please attach an image (Backend requires it currently).");
                btn.disabled = false;
                btn.textContent = 'Share';
                return;
            }
        }
    });
});

// Auto-load feed handler
window.addEventListener('load', () => {
    // Logic for Moments/Cloud moved to navigateTo to avoid duplication
    // But if we want auto-load on start if starting in moments view:
    // loadMomentsFeed(); // Optional
});
