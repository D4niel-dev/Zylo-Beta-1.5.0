/**
 * chat.js - Chat, AI, and Messaging Logic
 */

// Global State
var currentChatRoom = localStorage.getItem('chatRoom') || 'community';
var activeFriendChat = null;
var friendsState = { friends: [], incoming: [], outgoing: [] };
var groupsData = [];
var currentGroupId = null;
var activeChannelId = null;
var aiConversation = [];
var replyContext = null;
var activeTypers = new Set();
// processedMessageIds is for DM deduplication
var processedMessageIds = new Set();

// Elements
var chatInput = document.getElementById("chatInput");
var chatMessagesCommunity = document.getElementById("chatMessagesCommunity");
var chatMessagesAI = document.getElementById("chatMessagesAI");
var aiControls = document.getElementById("aiControls");
var aiModelSelect = document.getElementById("aiModelSelect");
var aiPersonaSelect = document.getElementById("aiPersonaSelect");
var typingIndicator = document.getElementById("typingIndicator");

// Load AI Conversation
try {
    aiConversation = JSON.parse(localStorage.getItem('ai_conversation') || '[]');
} catch { aiConversation = []; }


// === Message Rendering ===

// Helper to get status icon
function getStatusIcon(status) {
    if (status === 'read') return '<span class="text-blue-400 font-bold" title="Read">✓✓</span>';
    if (status === 'delivered') return '<span class="text-gray-400 font-bold" title="Delivered">✓✓</span>';
    return '<span class="text-discord-gray-500 font-bold" title="Sent">✓</span>';
}

/**
 * createDiscordMessage
 * Creates the DOM element for a chat message (Community, Group, or DM)
 */
async function createDiscordMessage(data) {
    const msgWrapper = document.createElement("div");
    // Add message ID for deduplication
    if (data.id) msgWrapper.setAttribute('data-msg-id', data.id);
    // Important: Add timestamp for finding message during updates
    if (data.timestamp || data.ts) msgWrapper.setAttribute('data-timestamp', data.timestamp || data.ts);

    msgWrapper.classList.add("flex", "flex-col", "p-2", "rounded", "hover:bg-discord-gray-600/20", "leading-snug", "group", "relative");

    const messageRow = document.createElement("div");
    messageRow.className = "flex items-start gap-3 relative w-full";

    // Actions (Reply / Edit)
    const actions = document.createElement("div");
    actions.className = "absolute right-4 -top-4 hidden group-hover:flex bg-discord-gray-900 rounded border border-discord-gray-800 shadow-sm z-20 scale-90 p-0.5";

    const replyBtn = document.createElement("button");
    replyBtn.className = "p-1 px-2 hover:bg-discord-gray-700 text-discord-gray-400 hover:text-white rounded-l transition";
    replyBtn.title = "Reply";
    replyBtn.onclick = () => startReply(data.id || Date.now(), data.username || data.from, data.message || '');
    replyBtn.innerHTML = '<i data-feather="corner-up-left" class="w-4 h-4"></i>';

    const editBtn = document.createElement("button");
    editBtn.className = "p-1 px-2 hover:bg-discord-gray-700 text-discord-gray-400 hover:text-white rounded-r transition";
    editBtn.title = "Edit";
    editBtn.innerHTML = '<i data-feather="edit-2" class="w-4 h-4"></i>';

    // Only allow editing own messages
    const currentUser = localStorage.getItem('savedUsername') || 'User';
    const msgAuthor = data.username || data.from;
    const isOwnMessage = (currentUser === msgAuthor);

    if (!isOwnMessage) {
        editBtn.classList.add('opacity-30', 'cursor-not-allowed');
        editBtn.title = "Can only edit your own messages";
        editBtn.onclick = null;
    } else {
        editBtn.onclick = async () => {
            const newT = prompt("Edit message:", data.message);
            if (newT && newT !== data.message) {
                // Optimistic UI update - target the message body specifically
                const bodyEl = msgWrapper.querySelector('.msg-body-text');
                if (bodyEl) {
                    bodyEl.textContent = newT;
                    // Add edited indicator
                    const editedSpan = document.createElement('span');
                    editedSpan.className = 'text-discord-gray-400 text-xs ml-1 italic';
                    editedSpan.textContent = '(edited)';
                    bodyEl.appendChild(editedSpan);
                }

                // Call backend API to persist the edit
                try {
                    const payload = {
                        groupId: currentGroupId,
                        channel: activeChannelId || 'general',
                        username: currentUser,
                        timestamp: data.timestamp || data.ts,
                        newMessage: newT
                    };

                    // Only call API for group messages (if in group context)
                    if (currentGroupId) {
                        const res = await fetch('/api/groups/message/edit', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const result = await res.json();
                        if (!result.success) {
                            console.error('Edit failed:', result.error);
                            alert("Edit failed: " + result.error);
                        }
                    }
                } catch (error) {
                    console.error('Error editing message:', error);
                }
            }
        };
    }

    actions.appendChild(replyBtn);

    // Discord-style Quick Reactions - inline emoji buttons
    const quickReactions = ['👍', '❤️', '😂', '😮'];
    quickReactions.forEach(emoji => {
        const emojiBtn = document.createElement("button");
        emojiBtn.className = "p-1 hover:bg-discord-gray-700 text-discord-gray-400 hover:text-white transition text-sm hover:scale-110";
        emojiBtn.textContent = emoji;
        emojiBtn.title = `React with ${emoji}`;
        emojiBtn.onclick = (e) => {
            e.stopPropagation();
            addReactionToMessage(msgWrapper, emoji, data);
        };
        actions.appendChild(emojiBtn);
    });

    // More reactions button (shows full picker)
    const moreReactBtn = document.createElement("button");
    moreReactBtn.className = "p-1 px-2 hover:bg-discord-gray-700 text-discord-gray-400 hover:text-white transition relative";
    moreReactBtn.title = "More Reactions";
    moreReactBtn.innerHTML = '<i data-feather="plus" class="w-3 h-3"></i>';

    // Full reaction picker popup - fixed positioning
    const reactionPicker = document.createElement("div");
    reactionPicker.className = "reaction-picker hidden";
    reactionPicker.style.cssText = "position: absolute; bottom: 100%; right: 0; margin-bottom: 4px; background: #2f3136; border-radius: 8px; border: 1px solid #202225; padding: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.4); z-index: 100; min-width: 200px;";

    const pickerGrid = document.createElement("div");
    pickerGrid.style.cssText = "display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;";

    const emojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👀', '💯', '✅', '❌'];
    emojis.forEach(emoji => {
        const btn = document.createElement("button");
        btn.className = "reaction-emoji";
        btn.style.cssText = "font-size: 20px; padding: 4px; border-radius: 4px; background: transparent; border: none; cursor: pointer; transition: transform 0.1s, background 0.1s;";
        btn.textContent = emoji;
        btn.dataset.emoji = emoji;
        btn.onmouseover = () => { btn.style.background = '#40444b'; btn.style.transform = 'scale(1.2)'; };
        btn.onmouseout = () => { btn.style.background = 'transparent'; btn.style.transform = 'scale(1)'; };
        btn.onclick = (e) => {
            e.stopPropagation();
            addReactionToMessage(msgWrapper, emoji, data);
            reactionPicker.classList.add('hidden');
        };
        pickerGrid.appendChild(btn);
    });

    reactionPicker.appendChild(pickerGrid);

    moreReactBtn.onclick = (e) => {
        e.stopPropagation();
        // Close all other pickers first
        document.querySelectorAll('.reaction-picker-open').forEach(p => p.classList.add('hidden'));
        reactionPicker.classList.toggle('hidden');
        if (!reactionPicker.classList.contains('hidden')) {
            reactionPicker.classList.add('reaction-picker-open');
        }
    };

    moreReactBtn.appendChild(reactionPicker);
    actions.appendChild(moreReactBtn);
    actions.appendChild(editBtn);

    // Delete Button (only for own messages)
    if (isOwnMessage) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "p-1 px-2 hover:bg-red-500/20 text-discord-gray-400 hover:text-red-400 transition";
        deleteBtn.title = "Delete Message";
        deleteBtn.innerHTML = '<i data-feather="trash-2" class="w-4 h-4"></i>';
        deleteBtn.onclick = async () => {
            if (confirm('Are you sure you want to delete this message?')) {
                // Optimistic removal
                msgWrapper.remove();

                // Send to backend
                try {
                    if (currentGroupId) {
                        await fetch('/api/groups/message/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                groupId: currentGroupId,
                                channel: activeChannelId || 'general',
                                timestamp: data.timestamp,
                                username: username
                            })
                        });
                    }
                } catch (err) {
                    console.error('Failed to delete message:', err);
                }
            }
        };
        actions.appendChild(deleteBtn);
    }
    messageRow.appendChild(actions);

    // Render Reply Context
    if (data.replyTo) {
        const replyContainer = document.createElement("div");
        replyContainer.className = "flex items-center mb-0.5 cursor-pointer opacity-80 hover:opacity-100";

        replyContainer.onclick = (e) => {
            e.stopPropagation();
            const targetId = data.replyTo.id;
            if (targetId) {
                const original = document.querySelector(`[data-msg-id="${targetId}"]`);
                if (original) {
                    original.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    original.classList.add('bg-discord-blurple/30', 'transition-all');
                    setTimeout(() => original.classList.remove('bg-discord-blurple/30'), 1500);
                }
            }
        };

        // Spine (Curved Line)
        const spine = document.createElement("div");
        spine.className = "w-8 h-3 border-l-2 border-t-2 border-discord-gray-600 rounded-tl-md ml-4 mt-2 mr-2 flex-shrink-0";
        replyContainer.appendChild(spine);

        const replyContent = document.createElement("div");
        replyContent.className = "flex items-center gap-1 text-xs text-discord-gray-300 overflow-hidden";

        const rAvatar = document.createElement("img");
        rAvatar.src = "/images/default_avatar.png";
        rAvatar.className = "w-4 h-4 rounded-full reply-avatar object-cover flex-shrink-0";
        replyContent.appendChild(rAvatar);

        const rUser = document.createElement("span");
        rUser.className = "font-semibold hover:underline bg-transparent text-discord-gray-200";
        rUser.textContent = "@" + (data.replyTo.username || "User");
        replyContent.appendChild(rUser);

        const rText = document.createElement("span");
        rText.className = "text-discord-gray-400 truncate max-w-[300px] hover:text-white transition-colors";
        const rTxt = data.replyTo.content || data.replyTo.message || '';
        rText.textContent = rTxt;
        replyContent.appendChild(rText);

        replyContainer.appendChild(replyContent);

        if (data.replyTo.username) {
            getUserAvatarUrl(data.replyTo.username).then(url => {
                rAvatar.src = url;
            });
        }

        msgWrapper.appendChild(replyContainer); // Append first
    }

    const avatar = document.createElement("img");
    const fallbackAvatar = '/images/default_avatar.png';
    const avatarUrl = await getUserAvatarUrl(data.username || data.from);
    avatar.src = avatarUrl;
    avatar.alt = `${data.username || data.from}'s avatar`;
    avatar.className = "w-10 h-10 rounded-full object-cover cursor-pointer";
    avatar.onerror = function () { this.onerror = null; this.src = fallbackAvatar; };
    const tUname = data.username || data.from;
    avatar.onclick = () => showUserProfile(tUname);
    messageRow.appendChild(avatar);

    const contentWrapper = document.createElement("div");

    const header = document.createElement("div");
    header.className = "flex items-baseline gap-2";
    const userSpan = document.createElement("span");

    // Role-based color styling
    const roleColorMap = {
        'admin': 'text-red-500',
        'mod': 'text-purple-500',
        'moderator': 'text-purple-500',
        'vip': 'text-yellow-400',
        'user': 'text-white'
    };

    // Try to get cached role or default to white
    let roleColor = 'text-white';
    let roleTitle = '';
    try {
        const cachedUser = avatarCache.get(tUname + '_role');
        if (cachedUser) {
            roleColor = roleColorMap[cachedUser.toLowerCase()] || 'text-white';
            roleTitle = cachedUser;
        } else {
            // Async fetch role (non-blocking)
            if (tUname) {
                fetch(`/api/get-user?identifier=${encodeURIComponent(tUname)}`)
                    .then(r => r.json())
                    .then(d => {
                        if (d.success && d.user && d.user.role) {
                            avatarCache.set(tUname + '_role', d.user.role);
                            const color = roleColorMap[d.user.role.toLowerCase()] || 'text-white';
                            userSpan.className = `${color} font-semibold cursor-pointer hover:underline`;
                            if (d.user.role !== 'user') {
                                userSpan.title = d.user.role.charAt(0).toUpperCase() + d.user.role.slice(1);
                            }
                        }
                    })
                    .catch(() => { });
            }
        }
    } catch { }

    userSpan.className = `${roleColor} font-semibold cursor-pointer hover:underline`;
    if (roleTitle && roleTitle !== 'user') {
        userSpan.title = roleTitle.charAt(0).toUpperCase() + roleTitle.slice(1);
    }
    userSpan.textContent = tUname;
    userSpan.onclick = () => showUserProfile(tUname);
    const timeSpan = document.createElement("span");
    timeSpan.className = "text-discord-gray-400 text-xs";
    timeSpan.textContent = new Date(data.ts ? data.ts * 1000 : Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    header.appendChild(userSpan);
    header.appendChild(timeSpan);

    // Status Indicator (Sent/Delivered/Read)
    if (isOwnMessage) {
        const statusSpan = document.createElement("span");
        statusSpan.className = "ml-2 text-[10px] select-none msg-status-icon cursor-help opacity-80 hover:opacity-100";
        const currentStatus = data.status || (data.readBy && data.readBy.length > 1 ? 'read' : 'sent');
        statusSpan.innerHTML = getStatusIcon(currentStatus);
        header.appendChild(statusSpan);
    }

    contentWrapper.appendChild(header);

    // Body (text OR file)
    if (data.fileData && data.fileName) {
        const ext = data.fileName.split(".").pop().toLowerCase();
        const imageExts = ["png", "jpg", "jpeg", "gif", "webp", "svg"];
        const videoExts = ["mp4", "webm", "ogg", "mov", "m4v"];
        const audioExts = ["mp3", "wav", "ogg", "m4a", "aac", "flac", "webm"];

        let body;
        if (imageExts.includes(ext)) {
            body = document.createElement("img");
            body.src = data.fileData;
            body.alt = data.fileName;
            body.className = "max-w-xs rounded shadow-md cursor-pointer mt-1";
        } else if (videoExts.includes(ext)) {
            body = document.createElement("video");
            body.controls = true;
            body.src = data.fileData;
            body.className = "max-w-xs rounded mt-1";
        } else if (audioExts.includes(ext) || data.type === 'voice') {
            // Voice message with styled player
            body = document.createElement("div");
            body.className = "voice-message-player flex items-center gap-2 bg-discord-gray-700/50 rounded-lg p-2 mt-1 max-w-xs";

            const playBtn = document.createElement("button");
            playBtn.className = "w-10 h-10 rounded-full bg-discord-blurple hover:bg-discord-blurple/80 flex items-center justify-center text-white transition";
            playBtn.innerHTML = '<i data-feather="play" class="w-5 h-5"></i>';

            const audioEl = document.createElement("audio");
            audioEl.src = data.fileData;
            audioEl.preload = "metadata";

            const waveform = document.createElement("div");
            waveform.className = "flex-1 flex items-center gap-0.5 h-8";
            // Create waveform bars (decorative)
            for (let i = 0; i < 20; i++) {
                const bar = document.createElement("div");
                bar.className = "w-1 bg-discord-gray-400 rounded-full transition-all";
                bar.style.height = `${Math.random() * 20 + 8}px`;
                waveform.appendChild(bar);
            }

            const durationSpan = document.createElement("span");
            durationSpan.className = "text-xs text-discord-gray-300 min-w-[32px]";
            durationSpan.textContent = data.duration ? `0:${String(data.duration).padStart(2, '0')}` : "0:00";

            let isPlaying = false;
            playBtn.onclick = () => {
                if (isPlaying) {
                    audioEl.pause();
                    playBtn.innerHTML = '<i data-feather="play" class="w-5 h-5"></i>';
                } else {
                    audioEl.play();
                    playBtn.innerHTML = '<i data-feather="pause" class="w-5 h-5"></i>';
                }
                isPlaying = !isPlaying;
                feather.replace();
            };

            audioEl.onended = () => {
                isPlaying = false;
                playBtn.innerHTML = '<i data-feather="play" class="w-5 h-5"></i>';
                feather.replace();
            };

            body.appendChild(playBtn);
            body.appendChild(waveform);
            body.appendChild(durationSpan);
        } else {
            body = document.createElement("a");
            body.href = data.fileData;
            body.download = data.fileName;
            body.textContent = `📎 ${data.fileName}`;
            body.className = "text-blue-400 hover:underline mt-1 block";
        }
        contentWrapper.appendChild(body);
    } else if (data.sticker_src) {
        // Modern sticker handling
        const body = document.createElement("div");
        body.className = "sticker-message mt-1";
        const img = document.createElement("img");
        img.src = data.sticker_src;
        img.alt = "Sticker";
        img.className = "sticker-img w-32 h-32 object-contain";
        body.appendChild(img);
        contentWrapper.appendChild(body);
    } else if (data.message && data.message.match(/^\[sticker:(.+)\]$/)) {
        // Fallback for legacy sticker messages
        const stickerId = data.message.match(/^\[sticker:(.+)\]$/)[1];
        let src = '';
        if (typeof AVAILABLE_STICKERS !== 'undefined') {
            const s = AVAILABLE_STICKERS.find(x => x.id === stickerId);
            if (s) src = s.src;
        }

        if (src) {
            const body = document.createElement("div");
            body.className = "sticker-message mt-1";
            const img = document.createElement("img");
            img.src = src;
            img.alt = "Sticker";
            img.className = "sticker-img w-32 h-32 object-contain";
            body.appendChild(img);
            contentWrapper.appendChild(body);
        } else {
            const body = document.createElement("div");
            body.className = "text-white italic opacity-50";
            body.textContent = `[Sticker: ${stickerId}]`;
        }
    } else if (data.message) {
        const body = document.createElement("div");
        body.className = "text-white msg-body-text whitespace-pre-wrap";

        // URL detection
        const urlRegex = /(https?:\/\/[^\s<]+[^<.,:;"')\]\s])/gi;
        let message = data.message;
        const urls = message.match(urlRegex) || [];

        // Parse markdown 
        if (window.parseDiscordMarkdown) {
            message = window.parseDiscordMarkdown(message);
        } else {
            // Fallback safe string
             message = message.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        }

        // Then make URLs clickable (after markdown)
        if (urls.length > 0) {
            urls.forEach(url => {
                const escapedUrl = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                message = message.replace(
                    escapedUrl,
                    `<a href="${url}" target="_blank" class="text-blue-400 hover:underline">${escapedUrl}</a>`
                );
            });
        }

        body.innerHTML = message;

        // Add (edited) indicator
        if (data.edited) {
            const editedSpan = document.createElement("span");
            editedSpan.className = "text-discord-gray-400 text-xs ml-1 italic cursor-pointer hover:underline hover:text-white transition-colors select-none";
            editedSpan.textContent = "(edited)";
            editedSpan.title = "View edit history";
            editedSpan.onclick = (e) => {
                e.stopPropagation();
                if(window.showEditHistory) showEditHistory(data.history || [], data.message, data.editedAt);
            };
            body.appendChild(editedSpan);
        }

        contentWrapper.appendChild(body);

        // Create embed cards for URLs
        for (const url of urls.slice(0, 3)) { 
            const embedCard = document.createElement("div");
            embedCard.className = "link-embed mt-2 p-3 bg-discord-gray-900/60 border-l-4 border-discord-blurple rounded max-w-md";
            embedCard.innerHTML = `
            <div class="link-embed-loading text-xs text-discord-gray-400">
              <i class="animate-pulse">Loading preview...</i>
            </div>
          `;
            contentWrapper.appendChild(embedCard);

            try {
                const hostname = new URL(url).hostname;
                fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
                    .then(r => r.json())
                    .then(preview => {
                        if (preview.success) {
                            embedCard.innerHTML = `
                    <div class="flex gap-3">
                      <div class="flex-1 min-w-0">
                        <div class="text-xs text-discord-gray-400 mb-1">${preview.site_name || hostname}</div>
                        <a href="${url}" target="_blank" class="text-blue-400 hover:underline font-medium text-sm block truncate">
                          ${preview.title || url}
                        </a>
                        ${preview.description ? `<p class="text-xs text-discord-gray-300 mt-1 line-clamp-2">${preview.description.substring(0, 100)}...</p>` : ''}
                      </div>
                      ${preview.image ? `<img src="${preview.image}" class="w-16 h-16 rounded object-cover flex-shrink-0" onerror="this.style.display='none'">` : ''}
                    </div>
                  `;
                        } else {
                            embedCard.innerHTML = `
                    <a href="${url}" target="_blank" class="text-blue-400 hover:underline text-sm">
                      🔗 ${hostname}
                    </a>
                  `;
                        }
                    })
                    .catch(() => {
                        const hostname = new URL(url).hostname;
                        embedCard.innerHTML = `
                  <a href="${url}" target="_blank" class="text-blue-400 hover:underline text-sm">
                    🔗 ${hostname}
                  </a>
                `;
                    });
            } catch { }
        }
    }


    // Reactions display area
    if (data.reactions && Object.keys(data.reactions).length > 0) {
        const reactionsContainer = document.createElement("div");
        reactionsContainer.className = "reactions-container flex flex-wrap gap-1 mt-1";

        const username = localStorage.getItem('savedUsername') || 'User';
        for (const [emoji, users] of Object.entries(data.reactions)) {
            const hasUserReacted = users.includes(username);
            const reactionBadge = document.createElement("button");
            reactionBadge.className = `flex items-center gap-1 px-2 py-0.5 rounded text-sm border transition ${hasUserReacted ? 'bg-discord-blurple/20 border-discord-blurple text-white' : 'bg-discord-gray-800/50 hover:bg-discord-gray-700 border-discord-gray-600 text-discord-gray-300'}`;
            reactionBadge.innerHTML = `<span>${emoji}</span><span class="text-xs">${users.length}</span>`;
            reactionBadge.title = users.join(', ');
            reactionBadge.onclick = () => addReactionToMessage(msgWrapper, emoji, data);
            reactionsContainer.appendChild(reactionBadge);
        }
        contentWrapper.appendChild(reactionsContainer);
    }

    messageRow.appendChild(contentWrapper);
    msgWrapper.appendChild(messageRow);
    return msgWrapper;
}

window.createDiscordMessage = createDiscordMessage;

// === USER PROFILE VIEW MODAL LOGIC ===
async function showUserProfile(targetUsername) {
    if (!targetUsername || targetUsername === 'N/A') return;
    const overlay = document.getElementById('userViewModalOverlay');
    const modal = document.getElementById('userViewModal');

    // Initial Loading State
    document.getElementById('uvUsername').textContent = targetUsername;
    document.getElementById('uvUsertag').textContent = 'Loading...';
    document.getElementById('uvAvatar').src = '/images/default_avatar.png';
    document.getElementById('uvBanner').src = '/images/default_banner.png';
    document.getElementById('uvBio').textContent = 'Searching for user bio...';

    overlay.classList.remove('hidden');
    modal.classList.remove('hidden');
    // feather.replace(); // Call feather if needed, but usually redundant if icons are static

    if (targetUsername === 'AI') {
        document.getElementById('uvUsername').textContent = 'Zylo AI';
        document.getElementById('uvUsertag').textContent = '@AI';
        document.getElementById('uvAvatar').src = '/images/Zylo_icon.ico';
        document.getElementById('uvBio').textContent = 'Your friendly AI assistant within Zylo.';
        document.getElementById('uvMessageBtn').classList.add('hidden');
        document.getElementById('uvProfileBtn').classList.add('hidden');
        return;
    } else {
        document.getElementById('uvMessageBtn').classList.remove('hidden');
        document.getElementById('uvProfileBtn').classList.remove('hidden');
    }

    try {
        const res = await fetch(`/api/get-user?identifier=${encodeURIComponent(targetUsername)}`);
        const data = await res.json();
        if (data.success && data.user) {
            const u = data.user;
            document.getElementById('uvUsername').textContent = u.username;
            document.getElementById('uvUsertag').textContent = (u.usertag || '@user0000');
            if (u.avatar) document.getElementById('uvAvatar').src = u.avatar;
            if (u.banner) document.getElementById('uvBanner').src = u.banner;
            document.getElementById('uvBio').textContent = u.about || u.aboutMe || 'No bio shared.';

            // Set Up Message Button
            const msgBtn = document.getElementById('uvMessageBtn');
            msgBtn.onclick = () => {
                closeUserViewModal();
                if (window.openDMFromProfile) window.openDMFromProfile(u.username);
                else openDM(u.username);
            };

            // Set Up Profile Card Button
            const profBtn = document.getElementById('uvProfileBtn');
            profBtn.onclick = () => {
                closeUserViewModal();
                if (u.username === localStorage.getItem('username')) {
                    if (window.switchTab) window.switchTab('profile');
                }
            };
        } else {
            document.getElementById('uvBio').textContent = 'User details are currently unavailable.';
        }
    } catch (error) {
        console.error('Failed to load user profile modal:', error);
        document.getElementById('uvBio').textContent = 'Error loading user data.';
    }
}
window.showUserProfile = showUserProfile;

function closeUserViewModal() {
    document.getElementById('userViewModalOverlay').classList.add('hidden');
    document.getElementById('userViewModal').classList.add('hidden');
}
window.closeUserViewModal = closeUserViewModal;

async function appendCommunityMessage(data) {
    const msgElement = await createDiscordMessage(data);
    chatMessagesCommunity.appendChild(msgElement);
    chatMessagesCommunity.scrollTop = chatMessagesCommunity.scrollHeight;
    if (window.feather) feather.replace();
    if (typeof hljs !== 'undefined') {
        msgElement.querySelectorAll('pre code.hljs').forEach(block => {
            hljs.highlightElement(block);
        });
    }
}

async function appendAiBubble(role, content) {
    const isOwn = role === 'user';
    const data = {
        username: isOwn ? (localStorage.getItem('savedUsername') || 'User') : 'AI',
        message: content,
        from: isOwn ? (localStorage.getItem('savedUsername') || 'User') : 'AI'
    };

    const msgElement = await createDiscordMessage(data);

    if (!isOwn) {
        msgElement.querySelector('img').src = '/images/Zylo_icon.ico';
        // Add feedback actions logic here if needed
    }

    chatMessagesAI.appendChild(msgElement);
    chatMessagesAI.scrollTop = chatMessagesAI.scrollHeight;
    if (typeof hljs !== 'undefined') {
        msgElement.querySelectorAll('pre code.hljs').forEach(block => {
            hljs.highlightElement(block);
        });
    }
}

// Reply Context
function startReply(id, username, content) {
    replyContext = { id, username, content };

    let barId = 'replyBar';
    let textId = 'replyTargetText';
    let inputId = 'chatInput';

    const showFriends = document.getElementById('tab-friends')?.classList.contains('hidden') === false;
    const showGroup = document.getElementById('tab-group')?.classList.contains('hidden') === false;

    if (showFriends) {
        barId = 'friendsReplyBar';
        textId = 'friendsReplyTargetText';
        inputId = 'friendsChatInput';
    } else if (showGroup) {
        barId = 'groupReplyBar';
        textId = 'groupReplyTargetText';
        inputId = 'groupChatInput';
    }

    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);
    const input = document.getElementById(inputId);

    if (bar && text) {
        bar.classList.remove('hidden');
        text.textContent = `Replying to ${username}`;
    }
    if (input) {
        input.focus();
        input.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function cancelReply() {
    replyContext = null;
    ['replyBar', 'friendsReplyBar', 'groupReplyBar'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}
window.cancelReply = cancelReply;

// Add reaction
async function addReactionToMessage(msgWrapper, emoji, data) {
    const username = localStorage.getItem('savedUsername') || 'User';

    let reactionsContainer = msgWrapper.querySelector('.reactions-container');
    if (!reactionsContainer) {
        reactionsContainer = document.createElement("div");
        reactionsContainer.className = "reactions-container flex flex-wrap gap-1 mt-1 ml-12";
        msgWrapper.appendChild(reactionsContainer);
    }

    if (!data.reactions) data.reactions = {};
    if (!data.reactions[emoji]) data.reactions[emoji] = [];

    const userIndex = data.reactions[emoji].indexOf(username);
    if (userIndex === -1) {
        data.reactions[emoji].push(username);
    } else {
        data.reactions[emoji].splice(userIndex, 1);
        if (data.reactions[emoji].length === 0) {
            delete data.reactions[emoji];
        }
    }

    // Re-render
    reactionsContainer.innerHTML = '';
    for (const [reactionEmoji, users] of Object.entries(data.reactions)) {
        if (users.length === 0) continue;
        const hasUserReacted = users.includes(username);
        const reactionBadge = document.createElement("button");
        reactionBadge.className = `flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition ${hasUserReacted ? 'bg-discord-blurple/30 border-discord-blurple' : 'bg-discord-gray-700/50 hover:bg-discord-gray-600 border-discord-gray-600'}`;
        reactionBadge.innerHTML = `<span>${reactionEmoji}</span><span class="text-discord-gray-300">${users.length}</span>`;
        reactionBadge.title = users.join(', ');
        reactionBadge.onclick = () => addReactionToMessage(msgWrapper, reactionEmoji, data);
        reactionsContainer.appendChild(reactionBadge);
    }

    // Sync to backend
    if (typeof currentGroupId !== 'undefined' && currentGroupId && data.timestamp) {
        try {
            await fetch('/api/groups/message/react', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    groupId: currentGroupId,
                    channel: activeChannelId || 'general',
                    timestamp: data.timestamp,
                    username,
                    emoji,
                    action: userIndex === -1 ? 'add' : 'remove'
                })
            });
        } catch (e) { console.error('Reaction sync failed:', e); }
    }
}

// Rate Limiting
const rateLimit = {
    count: 5,
    window: 10000,
    history: []
};

async function sendMessage() {
    const username = localStorage.getItem('savedUsername') || 'N/A';
    
    // Security: Rate Limiting Check
    const now = Date.now();
    rateLimit.history = rateLimit.history.filter(ts => now - ts < rateLimit.window);
    if (rateLimit.history.length >= rateLimit.count) {
        const resetTime = Math.ceil((rateLimit.history[0] + rateLimit.window - now) / 1000);
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded shadow-lg z-50 animate-bounce';
        notification.textContent = `Slow down! Please wait ${resetTime} seconds.`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
        return;
    }
    rateLimit.history.push(now);

    const message = chatInput.value.trim();
    if (!message) return;

    if (currentChatRoom === 'community') {
        const tempId = typeof generateUUID === 'function' ? generateUUID() : Date.now().toString();
        const payload = {
            id: tempId,
            username,
            message,
            replyTo: replyContext ? { id: replyContext.id, username: replyContext.username, content: replyContext.content } : null,
            ts: Date.now() / 1000
        };

        if (chatMessagesCommunity) {
            createDiscordMessage(payload).then(el => {
                el.setAttribute('data-msg-id', tempId);
                chatMessagesCommunity.appendChild(el);
                chatMessagesCommunity.scrollTop = chatMessagesCommunity.scrollHeight;
            });
        }

        chatInput.value = "";
        chatInput.style.height = "auto";
        cancelReply();

        try {
            await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) { console.error('Failed to send message:', e); }
        return;
    }
    
    // AI Chat
    // ...AI Logic...
    const model = aiModelSelect?.value || '';
    const persona = aiPersonaSelect?.value || localStorage.getItem('ai_persona') || 'helper';
    const payload = {
        model,
        persona,
        username,
        messages: [...aiConversation, { role: 'user', content: message }]
    };
    await appendAiBubble('user', message);
    aiConversation.push({ role: 'user', content: message });
    localStorage.setItem('ai_conversation', JSON.stringify(aiConversation));
    chatInput.value = "";
    chatInput.style.height = "auto";
    try {
        const res = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        const reply = data.reply || data.response || 'Sorry, no reply available.';
        await appendAiBubble('assistant', reply);
        aiConversation.push({ role: 'assistant', content: reply });
        localStorage.setItem('ai_conversation', JSON.stringify(aiConversation));
    } catch (e) {
        await appendAiBubble('assistant', 'There was an error contacting the AI.');
    }
}
window.sendMessage = sendMessage;

function toggleEmojiPicker(pickerId, inputId) {
    const picker = document.getElementById(pickerId);
    const input = document.getElementById(inputId);
    if (!picker || !input) return;

    if (picker.classList.contains("hidden")) {
        document.querySelectorAll('[id$="EmojiPicker"]').forEach(p => p.classList.add("hidden"));
        picker.classList.remove("hidden");
        picker.innerHTML = "";
        if (typeof EmojiMart !== 'undefined') {
            const pickerInstance = new EmojiMart.Picker({
                onEmojiSelect: (emoji) => {
                    input.value += emoji.native;
                    input.focus();
                },
                theme: "dark",
            });
            picker.appendChild(pickerInstance);
        }
    } else {
        picker.classList.add("hidden");
    }
}
window.toggleEmojiPicker = toggleEmojiPicker;

function sendFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const username = localStorage.getItem('savedUsername') || 'User';

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        alert("File is too large! Maximum file size is 10MB.");
        event.target.value = "";
        return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
        socket.emit("send_file", {
            username,
            fileName: file.name,
            fileType: file.type,
            fileData: e.target.result
        });
    };
    reader.readAsDataURL(file);
}
window.sendFile = sendFile;

// Voice Message Recording
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let recordingStartTime = null;

async function startVoiceRecording(context) {
    if (isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        isRecording = true;
        recordingStartTime = Date.now();

        // Visual feedback
        // Need to find event target or button
        // Assuming called inline with onclick="startVoiceRecording('community', event)" if needed
        // But for now, just global class toggle if we can identify button
        // We'll rely on UI updating elsewhere or rewrite to accept event
    } catch (err) {
        alert('Please allow microphone access.');
    }
}
// Note: Voice recording needs more work to bind to UI buttons cleanly if buttons are dynamic.
// For now, I'm omitting the full Voice implementation if it relies on complex DOM traversal not safely targeted.
// But I'll include the basic functions.

// ...

// OPEN DM
async function openDM(peerUsername) {
    if(typeof window.activeFriendChat !== 'undefined') window.activeFriendChat = peerUsername; // Uses global if available
    else activeFriendChat = peerUsername; // Local var fallback

    // Update Sidebar List visually if renderSidebarList is global
    if (typeof window.renderSidebarList === 'function') window.renderSidebarList();

    document.getElementById('friendsDashboard').classList.add('hidden');
    document.getElementById('addFriendSection').classList.add('hidden');
    const view = document.getElementById('friendsChatView');
    if (view) view.classList.remove('hidden');

    const tabFriends = document.getElementById('tab-friends');
    const tabMessages = document.getElementById('tab-messages');
    if (tabFriends && tabMessages) {
        tabMessages.classList.add('hidden');
        tabFriends.classList.remove('hidden');
    }

    if (window.switchMessagesView) window.switchMessagesView('friends');

    document.getElementById('chatHeaderTitle').textContent = peerUsername;
    const headerStatus = document.getElementById('chatHeaderStatus');
    if (headerStatus) headerStatus.innerHTML = '<span class="text-gray-500">Connecting...</span>';

    const input = document.getElementById('friendsChatInput');
    if (input) input.placeholder = `Message @${peerUsername}`;

    // Fetch user status
    if (navigator.onLine) {
        fetch(`/api/get-user?identifier=${encodeURIComponent(peerUsername)}`)
            .then(r => r.json())
            .then(data => {
                if (data.success && data.user && window.updateUserStatusUI) {
                    updateUserStatusUI(data.user.username, data.user.status, data.user.last_active);
                }
            })
            .catch(e => console.error("Status fetch failed", e));
    }

    // Clear & Load Messages
    const msgsContainer = document.getElementById('friendsChatMessages');
    if (!msgsContainer) return;
    msgsContainer.innerHTML = '<div class="text-center p-4 text-discord-gray-400">Loading history...</div>';

    const me = localStorage.getItem('savedUsername') || 'User';
    try {
        const res = await fetch(`/api/dm/history?userA=${encodeURIComponent(me)}&userB=${encodeURIComponent(peerUsername)}`);
        const result = await res.json();
        const msgs = result.success ? result.messages : (Array.isArray(result) ? result : []);

        msgsContainer.innerHTML = '';
        if (msgs.length === 0) {
            msgsContainer.innerHTML = '<div class="text-center p-4 text-discord-gray-400">No messages yet. Start the conversation!</div>';
        }

        for (const m of msgs) {
            const el = await createDiscordMessage({ ...m, username: m.from });
            msgsContainer.appendChild(el);
        }
        msgsContainer.scrollTop = msgsContainer.scrollHeight;
    } catch (e) {
        msgsContainer.innerHTML = '<div class="text-center p-4 text-discord-gray-400">Could not load history.</div>';
    }
}
window.openDM = openDM;

// Listeners
if (typeof socket !== 'undefined') {
    socket.on("typing", (data) => {
        // Typing indicator logic...
        activeTypers.add(data.username);
        // updateTypingIndicator(); // Ensure this function is defined or moved
        setTimeout(() => { activeTypers.delete(data.username); }, 2500);
    });

    socket.on("receive_message", async (data) => {
        await appendCommunityMessage(data);
    });

    socket.on('receive_dm', async (data) => {
        const me = localStorage.getItem('savedUsername') || '';
        const { from, to } = data || {};
        // activeFriendChat might be global property on window
        const currentActive = window.activeFriendChat || activeFriendChat;

        if (currentActive && typeof currentActive === 'string') {
            if ((from === me && to === currentActive) || (to === me && from === currentActive)) {
                 if (data.id) {
                    if (processedMessageIds.has(data.id)) return;
                    processedMessageIds.add(data.id);
                 }
                 const el = await createDiscordMessage({ ...data, username: from });
                 const msgsContainer = document.getElementById('friendsChatMessages');
                 if (msgsContainer) {
                    msgsContainer.appendChild(el);
                    msgsContainer.scrollTop = msgsContainer.scrollHeight;
                    if (window.feather) feather.replace();
                 }
            }
        }
    });
}

function switchChatRoom(room) {
    currentChatRoom = room;
    localStorage.setItem('chatRoom', room);
    const btnCommunity = document.getElementById('btnRoomCommunity');
    const btnAI = document.getElementById('btnRoomAI');
    const title = document.getElementById('main-content-title');

    // Ensure we're showing tab-messages, not tab-friends
    const tabMessages = document.getElementById('tab-messages');
    const tabFriends = document.getElementById('tab-friends');
    if (tabMessages && tabFriends) {
        tabMessages.classList.remove('hidden');
        tabFriends.classList.add('hidden');
    }

    if (room === 'community') {
        chatMessagesCommunity.classList.remove('hidden');
        chatMessagesAI.classList.add('hidden');
        aiControls.classList.add('hidden');
        if (btnCommunity) btnCommunity.classList.add('active');
        if (btnAI) btnAI.classList.remove('active');
        if (title) title.textContent = '# Community';
    } else {
        chatMessagesCommunity.classList.add('hidden');
        chatMessagesAI.classList.remove('hidden');
        aiControls.classList.remove('hidden');
        if (btnAI) btnAI.classList.add('active');
        if (btnCommunity) btnCommunity.classList.remove('active');
        if (title) title.textContent = '🤖 AI Chat';
        restoreAiConversation();
    }
}
window.switchChatRoom = switchChatRoom;

function restoreAiConversation() {
    try {
        aiConversation = JSON.parse(localStorage.getItem('ai_conversation') || '[]');
    } catch { aiConversation = []; }
    if (chatMessagesAI) {
        chatMessagesAI.innerHTML = '';
        (async () => {
            for (const msg of aiConversation) {
                await appendAiBubble(msg.role, msg.content);
            }
        })();
    }
}
window.restoreAiConversation = restoreAiConversation;

function clearAiConversation() {
    aiConversation = [];
    localStorage.removeItem('ai_conversation');
    if (chatMessagesAI) chatMessagesAI.innerHTML = '';
}
window.clearAiConversation = clearAiConversation;

async function loadAiModels() {
    try {
        const res = await fetch('/api/ai/models');
        const data = await res.json();
        const models = data.models || [];
        aiModelSelect.innerHTML = '';
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            aiModelSelect.appendChild(opt);
        });
        const saved = localStorage.getItem('ai_model');
        if (saved && models.includes(saved)) {
            aiModelSelect.value = saved;
        }
        aiModelSelect.addEventListener('change', () => {
            localStorage.setItem('ai_model', aiModelSelect.value);
        });
    } catch { }
}
window.loadAiModels = loadAiModels;

async function loadAiPersonas() {
    try {
        const res = await fetch('/api/ai/personas');
        const data = await res.json();
        const personas = (data.personas || []).map(p => ({ key: p.key, name: p.name }));
        aiPersonaSelect.innerHTML = '';
        personas.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.key;
            opt.textContent = p.name;
            aiPersonaSelect.appendChild(opt);
        });
        const saved = localStorage.getItem('ai_persona');
        if (saved) aiPersonaSelect.value = saved;
        aiPersonaSelect.addEventListener('change', () => {
            localStorage.setItem('ai_persona', aiPersonaSelect.value);
        });
    } catch { }
}
window.loadAiPersonas = loadAiPersonas;

async function sendFriendMessage() {
    const input = document.getElementById('friendsChatInput');
    const text = input.value.trim();
    if (!text || !activeFriendChat) return;
    const me = localStorage.getItem('savedUsername') || 'User';

    const payload = {
        from: me,
        to: activeFriendChat,
        message: text,
        ts: Date.now() / 1000,
        replyTo: replyContext ? { id: replyContext.id, username: replyContext.username, content: replyContext.content } : null
    };

    // DM Logic
    if (typeof activeFriendChat === 'string') {
        // Optimistic UI - Show message immediately (sender's view)
        const el = await createDiscordMessage({ ...payload, username: me });
        const msgsContainer = document.getElementById('friendsChatMessages');
        if (msgsContainer) {
            msgsContainer.appendChild(el);
            msgsContainer.scrollTop = msgsContainer.scrollHeight;
            if (window.feather) feather.replace();
        }

        if (navigator.onLine) {
            socket.emit('send_dm', payload);
        } else {
            // Always attempt API for persistence when offline
            fetch('/api/dm/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(() => { });
        }
    } else {
        // Group Logic
        const groupPayload = {
            groupId: activeFriendChat.id,
            username: me,
            message: text,
            ts: Date.now() / 1000,
            replyTo: replyContext ? { id: replyContext.id, username: replyContext.username, content: replyContext.content } : null
        };
        if (navigator.onLine) socket.emit('send_group_message', groupPayload);
    }

    input.value = '';
    cancelReply();
}
window.sendFriendMessage = sendFriendMessage;

function sendFriendFile(event) {
    const file = event.target.files?.[0];
    if (!file || !activeFriendChat) return;

    // Security: 10MB File Size Limit
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
        alert("File is too large! Maximum file size is 10MB.");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const me = localStorage.getItem('savedUsername') || 'User';

        if (typeof activeFriendChat === 'string') {
            // DM
            const payload = {
                from: me,
                username: me,
                to: activeFriendChat,
                fileName: file.name,
                fileType: file.type,
                fileData: e.target.result,
                ts: Date.now() / 1000,
                message: `File: ${file.name}` // Message for display
            };

            // Optimistic UI - show file immediately
            const msgsContainer = document.getElementById('friendsChatMessages');
            if (msgsContainer) {
                const el = await createDiscordMessage({ ...payload });
                msgsContainer.appendChild(el);
                msgsContainer.scrollTop = msgsContainer.scrollHeight;
                if (window.feather) feather.replace();
            }

            // Send to server
            if (navigator.onLine) {
                socket.emit('send_dm', payload);
            }
        } else {
            // Group via Friends view (if activeFriendChat is object)
            const payload = {
                groupId: activeFriendChat.id,
                username: me,
                fileName: file.name,
                fileType: file.type,
                fileData: e.target.result
            };
            if (navigator.onLine) socket.emit('send_group_file', payload);
        }
        event.target.value = '';
    };
    reader.readAsDataURL(file);
}

// Emoji Picker
function toggleEmojiPicker(pickerId, inputId) {
    const picker = document.getElementById(pickerId);
    const input = document.getElementById(inputId);
    if (!picker || !input) return;

    if (picker.classList.contains("hidden")) {
        document.querySelectorAll('[id$="EmojiPicker"]').forEach(p => p.classList.add("hidden"));
        picker.classList.remove("hidden");
        picker.innerHTML = "";
        
        if (typeof EmojiMart !== 'undefined') {
            const pickerInstance = new EmojiMart.Picker({
                onEmojiSelect: (emoji) => {
                    input.value += emoji.native;
                    input.focus();
                },
                theme: "dark",
            });
            picker.appendChild(pickerInstance);
        } else {
            console.warn('EmojiMart not loaded');
        }
    } else {
        picker.classList.add("hidden");
    }
}
window.toggleEmojiPicker = toggleEmojiPicker;

async function startVoiceRecording(context) {
    if (isRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        isRecording = true;
        recordingStartTime = Date.now();

        // Visual feedback
        const btn = document.querySelector('.voice-record-btn'); // You might need a more specific selector
        if (btn) {
            btn.classList.add('recording', 'bg-red-500', 'animate-pulse');
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const duration = Math.floor((Date.now() - recordingStartTime) / 1000);
            if (duration >= 1) {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onload = () => {
                    const base64Audio = reader.result;
                    sendVoiceMessage(base64Audio, duration, context);
                };
                reader.readAsDataURL(audioBlob);
            }
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
    } catch (err) {
        console.error('Microphone access denied:', err);
        alert('Please allow microphone access to record voice messages.');
    }
}
window.startVoiceRecording = startVoiceRecording;

function stopVoiceRecording(context) {
    if (!isRecording || !mediaRecorder) return;
    isRecording = false;
    mediaRecorder.stop();

    // Remove visual feedback
    document.querySelectorAll('.voice-record-btn').forEach(btn => {
        btn.classList.remove('recording', 'bg-red-500', 'animate-pulse');
        btn.style.backgroundColor = '';
        btn.style.animation = '';
    });
}
window.stopVoiceRecording = stopVoiceRecording;

async function sendVoiceMessage(audioData, duration, context) {
    const currentUser = localStorage.getItem('savedUsername') || 'User';
    const payload = {
        username: currentUser,
        type: 'voice',
        fileData: audioData,
        fileName: `voice_${Date.now()}.webm`,
        fileType: 'audio/webm',
        duration: duration,
        timestamp: Math.floor(Date.now() / 1000)
    };

    if (context === 'community') {
        if(window.socket) window.socket.emit("send_file", payload);
    } else if (context === 'group' && currentGroupId) {
        payload.groupId = currentGroupId;
        payload.channel = activeChannelId || 'general';
        // Optimistic UI update
        if(window.appendGroupMessage) await appendGroupMessage(payload);
        // Send to server
        try {
            await fetch('/api/groups/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
        } catch (e) { console.error('Voice message send failed:', e); }
    }
}
window.sendVoiceMessage = sendVoiceMessage;

function updateTypingIndicator() {
    const typingIndicator = document.getElementById("typingIndicator");
    if (!typingIndicator) return;

    if (activeTypers.size === 0) {
        typingIndicator.classList.add("hidden");
        typingIndicator.textContent = "";
    } else {
        const typers = Array.from(activeTypers);
        typingIndicator.classList.remove("hidden");
        if (typers.length === 1) {
            typingIndicator.textContent = `${typers[0]} is typing...`;
        } else if (typers.length === 2) {
            typingIndicator.textContent = `${typers[0]} and ${typers[1]} are typing...`;
        } else {
            typingIndicator.textContent = "Many people are typing...";
        }
    }

    // Sidebar indicators
    document.querySelectorAll('.sidebar-typing-indicator').forEach(el => el.remove());
    if (activeTypers.size > 0 && window.activeFriendChat) { // Check activeFriendChat? Not necessarily, sidebar shows for anyone
         // Logic to find sidebar items and append indicator...
         // Simplified:
         activeTypers.forEach(username => {
             const selector = `.sidebar-dm-item[data-username="${username}"]`; // Assuming we added data-username
             const item = document.querySelector(selector);
             if(item && !item.querySelector('.sidebar-typing-indicator')) {
                  const indicator = document.createElement("span");
                  indicator.className = "sidebar-typing-indicator text-xs text-discord-gray-400 italic ml-2 animate-pulse";
                  indicator.textContent = "typing...";
                  item.appendChild(indicator);
             }
         });
    }
}
window.updateTypingIndicator = updateTypingIndicator;

function showEditHistory(history, currentMessage, lastEditedAt) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('editHistoryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editHistoryModal';
        modal.className = 'fixed inset-0 bg-black/80 z-[100] flex items-center justify-center hidden';
        modal.innerHTML = `
            <div class="bg-discord-gray-800 rounded-lg w-full max-w-lg overflow-hidden shadow-2xl transform transition-all scale-100">
                <div class="p-4 border-b border-discord-gray-700 flex justify-between items-center bg-discord-gray-900">
                    <h3 class="font-bold text-white text-lg">Edit History</h3>
                    <button onclick="document.getElementById('editHistoryModal').classList.add('hidden')" class="text-gray-400 hover:text-white">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div class="p-4 max-h-[60vh] overflow-y-auto space-y-4" id="editHistoryContent">
                    <!-- History items go here -->
                </div>
                <div class="p-4 bg-discord-gray-900 text-center">
                    <button onclick="document.getElementById('editHistoryModal').classList.add('hidden')" class="bg-discord-blurple px-6 py-2 rounded text-white font-medium hover:bg-opacity-90 transition">Close</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    const container = document.getElementById('editHistoryContent');
    container.innerHTML = '';
    
    // Add current version
    const currentEl = document.createElement('div');
    currentEl.className = 'bg-discord-gray-900/50 p-3 rounded border border-discord-green/30';
    currentEl.innerHTML = `
        <div class="flex justify-between mb-1">
            <span class="text-xs text-discord-green uppercase font-bold">Current Version</span>
            <span class="text-xs text-gray-500">${new Date(lastEditedAt * 1000).toLocaleString()}</span>
        </div>
        <div class="text-white text-sm whitespace-pre-wrap">${currentMessage}</div>
    `;
    container.appendChild(currentEl);

    // Add previous versions (reverse order)
    if (history && history.length > 0) {
        [...history].reverse().forEach(h => {
               const el = document.createElement('div');
               el.className = 'bg-discord-gray-900/30 p-3 rounded';
               el.innerHTML = `
                   <div class="flex justify-between mb-1">
                       <span class="text-xs text-gray-400 uppercase font-bold">Previous</span>
                       <span class="text-xs text-gray-500">${new Date(h.timestamp * 1000).toLocaleString()}</span>
                   </div>
                   <div class="text-gray-300 text-sm whitespace-pre-wrap line-through opacity-70">${h.message}</div>
               `;
               container.appendChild(el);
        });
    } else {
         const empty = document.createElement('div');
         empty.className = 'text-center text-gray-500 italic py-4';
         empty.textContent = 'No previous edit history found.';
         container.appendChild(empty);
    }

    modal.classList.remove('hidden');
}
window.showEditHistory = showEditHistory;
