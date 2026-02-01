/**
 * moments.js - Logic for the Moments/Explore feed
 */

async function loadMomentsFeed() {
    const container = document.getElementById('momentsFeed');
    if (!container) {
        console.warn('momentsFeed container not found');
        return;
    }
    
    // Set user avatar
    const me = localStorage.getItem('username');
    if (me && typeof getUserAvatarUrl === 'function') {
        getUserAvatarUrl(me).then(url => {
            const el = document.getElementById('momentsMyAvatar');
            if (el) el.src = url;
        });
    }

    container.innerHTML = '<div class="text-center py-8"><div class="animate-spin w-8 h-8 border-2 border-discord-blurple border-t-transparent rounded-full mx-auto"></div></div>';

    try {
        const res = await fetch('/api/moments');
        const data = await res.json();

        if (data.success) {
            if (!data.moments || data.moments.length === 0) {
                container.innerHTML = '<div class="text-center text-discord-gray-500 py-10">No moments yet. Share yours!</div>';
                return;
            }
            container.innerHTML = data.moments.map(post => renderMomentCard(post)).join('');
            if (typeof feather !== 'undefined') feather.replace();
        } else {
            container.innerHTML = '<div class="text-center text-red-400">Failed to load feed</div>';
        }
    } catch (err) {
        console.error('Failed to load moments:', err);
        container.innerHTML = '<div class="text-center text-red-400">Failed to load feed</div>';
    }
}

function renderMomentCard(post) {
    const currentUser = localStorage.getItem('username');
    const isLiked = post.likes && post.likes.includes(currentUser);
    const likeCount = post.likes ? post.likes.length : 0;
    const timestamp = post.timestamp ? new Date(post.timestamp * 1000).toLocaleString() : 'Just now';

    return `
    <div class="bg-discord-gray-800 rounded-lg p-4 shadow-sm animate-fadeIn">
      <div class="flex items-center gap-3 mb-3">
        <div class="w-10 h-10 rounded-full bg-discord-gray-700 overflow-hidden">
           <img src="/images/default_avatar.png" class="w-full h-full object-cover">
        </div>
        <div>
          <div class="font-semibold text-white">${post.username || 'Anonymous'}</div>
          <div class="text-xs text-discord-gray-400">${timestamp}</div>
        </div>
      </div>
      
      <div class="mb-3 text-discord-gray-100 whitespace-pre-wrap">${(post.content || '').replace(/</g, '&lt;')}</div>
      
      ${post.image ? `<div class="mb-3 rounded-lg overflow-hidden bg-black max-h-[400px] flex items-center justify-center">
        <img src="${post.image}" class="max-w-full max-h-[400px] object-contain" loading="lazy">
      </div>` : ''}
      
      <div class="flex items-center gap-4 border-t border-discord-gray-700 pt-3">
        <button onclick="toggleLikeMoment('${post.id}')" class="flex items-center gap-2 ${isLiked ? 'text-red-500' : 'text-discord-gray-400 hover:text-red-400'} transition">
          <i data-feather="heart" class="${isLiked ? 'fill-current' : ''} w-5 h-5"></i>
          <span>${likeCount || 'Like'}</span>
        </button>
        <button class="flex items-center gap-2 text-discord-gray-400 hover:text-white transition">
          <i data-feather="message-square" class="w-5 h-5"></i>
          <span>Comment</span>
        </button>
      </div>
    </div>
  `;
}

async function toggleLikeMoment(postId) {
    const username = localStorage.getItem('username');
    if (!username) return;

    try {
        const res = await fetch('/api/moments/like', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: postId, username })
        });
        const data = await res.json();
        if (data.success) {
            loadMomentsFeed();
        }
    } catch (e) { console.error(e); }
}

async function postNewMoment() {
    const caption = document.getElementById('momentInputText');
    const fileInput = document.getElementById('momentInputImage');
    const username = localStorage.getItem('username');

    if (!username) return alert('Please log in');
    
    const text = caption ? caption.value.trim() : '';
    const file = fileInput && fileInput.files[0];
    
    if (!text && !file) return; // Empty

    const payload = {
        username,
        content: text,
        image: null
    };

    if (file) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            payload.image = e.target.result;
            await sendMomentPost(payload);
        };
        reader.readAsDataURL(file);
    } else {
        await sendMomentPost(payload);
    }
}

async function sendMomentPost(payload) {
    try {
        const res = await fetch('/api/moments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            const caption = document.getElementById('momentInputText');
            const fileInput = document.getElementById('momentInputImage');
            const preview = document.getElementById('momentImagePreview');
            
            if (caption) caption.value = '';
            if (fileInput) fileInput.value = '';
            if (preview) preview.classList.add('hidden');
            
            loadMomentsFeed();
        } else {
            alert('Failed: ' + data.error);
        }
    } catch (e) {
        console.error(e);
        alert('Error posting');
    }
}

function handleMomentImageSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(evt) {
        const preview = document.getElementById('momentPreviewImg');
        const container = document.getElementById('momentImagePreview');
        if (preview) preview.src = evt.target.result;
        if (container) container.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
}

function clearMomentImage() {
    const fileInput = document.getElementById('momentInputImage');
    const preview = document.getElementById('momentImagePreview');
    if (fileInput) fileInput.value = '';
    if (preview) preview.classList.add('hidden');
}

// Global function aliases
window.refreshMoments = loadMomentsFeed;
window.loadMomentsFeed = loadMomentsFeed;
window.postMoment = postNewMoment;
window.toggleLike = toggleLikeMoment;
window.toggleLikeMoment = toggleLikeMoment;
window.handleMomentImageSelect = handleMomentImageSelect;
window.clearMomentImage = clearMomentImage;

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
    console.log('Moments module loaded');
});
