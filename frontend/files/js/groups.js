
// Group Logic
// groupsData and currentGroupId are defined in chat.js (globals)

function getGroupColor(groupName) {
    let hash = 0;
    for (let i = 0; i < groupName.length; i++) {
        hash = groupName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 50%)`;
}

function getGroupInitial(groupName) {
    return (groupName || 'G')[0].toUpperCase();
}

async function loadGroups() {
    const username = localStorage.getItem('username');
    if (!username) return;
    try {
        const res = await fetch(`/api/groups/list?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        groupsData = data.groups || [];
        renderServerSidebar();
    } catch (e) { console.error('Failed to load groups:', e); }
}
window.loadGroups = loadGroups;

function renderServerSidebar() {
    const container = document.getElementById('groupIconsContainer');
    if (!container) return;
    container.innerHTML = '';

    groupsData.forEach(g => {
        const item = document.createElement('div');
        item.className = 'group-icon-wrapper group relative flex items-center justify-center cursor-pointer my-2';

        const isActive = currentGroupId === g.id;
        const pillHeight = isActive ? 'h-10' : 'h-2';
        const pillOpacity = isActive ? 'opacity-100' : 'opacity-0 group-hover:opacity-100';

        const color = getGroupColor(g.name);
        const initial = getGroupInitial(g.name);
        let iconStyle = '';

        if (g.icon) {
            iconStyle = `background-image: url(${g.icon}); background-size: cover; background-position: center;`;
        } else if (!isActive) {
            iconStyle = `background-color: ${color};`;
        }

        item.onclick = () => selectGroup(g.id);

        item.innerHTML = `
            <div class="absolute -left-2 w-1 bg-white rounded-r-full transition-all duration-200 ${pillHeight} ${pillOpacity}"></div>
            <div class="sidebar-icon w-12 h-12 flex items-center justify-center bg-discord-gray-700 hover:bg-discord-blurple text-white font-semibold transition-all duration-200 ${isActive ? 'rounded-2xl bg-discord-blurple' : 'rounded-[24px] hover:rounded-2xl'}" style="${iconStyle}">
               ${g.icon ? '' : initial}
            </div>
            <!-- Tooltip -->
            <div class="absolute left-full ml-4 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
               ${g.name}
            </div>
        `;
        container.appendChild(item);
    });
    if (window.feather) feather.replace();
}
window.renderServerSidebar = renderServerSidebar;



function renderGroupChannels() {
    const list = document.getElementById('groupChannelsList');
    if (!list) return;
    list.innerHTML = '';

    // Find current group data
    const group = groupsData.find(g => g.id === currentGroupId);
    const channels = (group && group.channels) ? group.channels : [{ id: 'general', name: 'general' }];

    // Group by category, default "Text Channels"
    const categories = {};
    channels.forEach(ch => {
        const cat = ch.category || 'Text Channels';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(ch);
    });

    // Render grouped
    // Order: Text Channels first, then others alphabetical, or alphabetical
    const sortedCats = Object.keys(categories).sort((a, b) => {
        if (a === 'Text Channels') return -1;
        if (b === 'Text Channels') return 1;
        return a.localeCompare(b);
    });

    sortedCats.forEach(cat => {
        // Render Header
        const header = document.createElement('div');
        header.className = 'flex items-center justify-between px-2 pt-4 pb-1 text-xs font-bold text-discord-gray-400 uppercase hover:text-discord-gray-300 group select-none transition-colors';
        header.innerHTML = `
            <div class="flex items-center gap-0.5 cursor-pointer">
                <span>\/</span>
                <span>${cat}</span>
            </div>
            <!-- Future: Add "+" btn for admin -->
        `;
        list.appendChild(header);

        // Render Channels
        categories[cat].forEach(ch => {
            const channelName = typeof ch === 'string' ? ch : ch.name;
            const channelId = typeof ch === 'string' ? ch : ch.id;
            const type = ch.type || 'text';
            
            const btn = document.createElement('div');
            const isActive = (typeof activeChannelId !== 'undefined' ? activeChannelId : 'general') === channelId;
            btn.className = `channel-item group flex items-center px-2 py-1.5 mx-2 rounded cursor-pointer transition-colors mb-0.5 ${isActive ? 'bg-discord-gray-600/50 text-white' : 'text-discord-gray-400 hover:bg-discord-gray-700/50 hover:text-discord-gray-200'}`;
            
            const icon = type === 'voice' ? 'volume-2' : 'hash';
            
            btn.innerHTML = `
                <i data-feather="${icon}" class="w-4 h-4 mr-1.5 text-discord-gray-400"></i>
                <span class="truncate font-medium">${channelName}</span>
            `;
            btn.onclick = () => {
                 switchGroupChannel(group, channelId);
            };
            list.appendChild(btn);
        });
    });
    if (window.feather) feather.replace();

    // Also update header info if available
    const nameEl = document.getElementById('groupPanelName');
    const descEl = document.getElementById('groupPanelDesc');
    if(group) {
        if (nameEl) nameEl.textContent = group.name;
        if (descEl) descEl.textContent = group.description || 'No description';
    }
}

function selectGroup(groupId) {
    // Leave previous group room if connected
    if (typeof socket !== 'undefined' && socket && currentGroupId && currentGroupId !== groupId) {
        socket.emit('leave', { room: currentGroupId });
    }

    currentGroupId = groupId;
    const group = groupsData.find(g => g.id === groupId);
    if (!group) return;

    // Reset channel
    activeChannelId = 'general';

    // Update sidebar list (server icons)
    renderServerSidebar();

    // Show group panel (sidebar) and tab (main content)
    document.querySelectorAll('.sub-panel-content').forEach(p => p.classList.add('hidden'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));

    const gPanel = document.getElementById('sub-panel-group');
    const gTab = document.getElementById('tab-group');
    if (gPanel) gPanel.classList.remove('hidden');
    if (gTab) {
        gTab.classList.remove('hidden');
        gTab.style.display = ''; // Force remove inline display:none from navigateTo()
    }

    // Update basic info in sidebar
    const nameEl = document.getElementById('groupPanelName');
    const descEl = document.getElementById('groupPanelDesc');
    if (nameEl) nameEl.textContent = group.name;
    if (descEl) descEl.textContent = group.description || 'No description';

    // Handle Socket join
    if (typeof socket !== 'undefined' && socket) {
        socket.emit('join', { room: group.id });
    }

    // Load specific group data
    loadGroupChannels(group, activeChannelId);
    loadGroupMembers(group);
    loadGroupMessages(group, activeChannelId);

    if (window.feather) feather.replace();
}
window.selectGroup = selectGroup;

function loadGroupChannels(group, activeChannel = 'general') {
    const container = document.getElementById('groupChannelsList');
    if (!container) return;

    container.innerHTML = '';

    // Default channel
    const channels = group.channels || [{ id: 'general', name: 'general' }];

    channels.forEach(channel => {
        const ch = typeof channel === 'string' ? { id: channel, name: channel } : channel;
        const item = document.createElement('div');
        item.className = `channel-item ${ch.id === activeChannel ? 'active' : ''}`;
        item.innerHTML = `
          <span class="channel-icon">#</span>
          <span>${ch.name}</span>
        `;
        item.onclick = () => {
            switchGroupChannel(group, ch.id);
        };
        container.appendChild(item);
    });
}

function loadGroupMembers(group) {
    const container = document.getElementById('groupMembersList');
    if (!container) return;

    container.innerHTML = '';

    const members = group.members || [localStorage.getItem('savedUsername') || localStorage.getItem('username') || 'You'];

    members.forEach(member => {
        const item = document.createElement('div');
        item.className = 'flex items-center gap-2 p-1 text-sm cursor-pointer hover:bg-discord-gray-700/50 rounded';
        
        let roleIcon = '';
        let roleColor = 'text-discord-gray-300';
        let tooltip = 'Member';
        
        const roles = group.roles || {};
        const isAdmin = (roles.admin || []).includes(member);
        const isMod = (roles.moderator || []).includes(member);
        const isOwner = group.owner === member;

        if (isOwner) {
            roleIcon = '<i data-feather="monitor" class="w-3 h-3 text-yellow-500"></i>';
            roleColor = 'text-yellow-500 font-bold';
            tooltip = 'Owner';
        } else if (isAdmin) {
            roleIcon = '<i data-feather="shield" class="w-3 h-3 text-red-500"></i>';
            roleColor = 'text-red-400 font-medium';
            tooltip = 'Admin';
        } else if (isMod) {
            roleIcon = '<i data-feather="shield" class="w-3 h-3 text-green-500"></i>';
            roleColor = 'text-green-400 font-medium';
            tooltip = 'Moderator';
        }
        
        item.title = tooltip;
        item.innerHTML = `
            <div class="relative">
                 <div class="w-2 h-2 rounded-full ${isOwner ? 'bg-yellow-500' : (isAdmin ? 'bg-red-500' : (isMod ? 'bg-green-500' : 'bg-green-500'))}"></div>
            </div>
            <span class="${roleColor}">${member}</span>
            ${roleIcon}
        `;
        
        // Context menu for owner to assign roles (simple implementation)
        const me = localStorage.getItem('username') || localStorage.getItem('savedUsername');
        if (group.owner === me && member !== me) {
             item.oncontextmenu = (e) => {
                 e.preventDefault();
                 const action = confirm(`Manage role for ${member}?\nOK for Admin, Cancel for Moderator.`); // Very basic, improved in next step if needed or rely on settings
                 // Actually relying on settings tab is better UX. 
                 // Let's just add a simple onclick to open profile or something.
             };
        }
        
        container.appendChild(item);
    });
    if (window.feather) feather.replace();

    // Update member count
    const countEl = document.getElementById('groupChatMemberCount');
    if (countEl) countEl.textContent = `${members.length} members`;
}

async function loadGroupMessages(group, channelId) {
    activeChannelId = channelId;
    const container = document.getElementById('groupChatMessages');
    if (!container) return;

    container.innerHTML = '<div class="text-center text-discord-gray-400 py-4">Loading messages...</div>';

    // Update channel name and placeholder
    const channel = (group.channels || []).find(c => (c.id || c) === channelId) || { name: channelId };
    const displayTitle = channel.name || channelId;

    const titleEl = document.getElementById('groupChatChannelName');
    if (titleEl) titleEl.textContent = displayTitle;

    const input = document.getElementById('groupChatInput');
    if (input) input.placeholder = `Message #${displayTitle}`;

    try {
        const res = await fetch(`/api/groups/${group.id}/messages?channel=${channelId}`);
        const data = await res.json();
        const messages = data.messages || [];

        container.innerHTML = '';
        for (const msg of messages) {
            await appendGroupMessage(msg);
        }

        // Apply pinned status
        const currentChObj = (group.channels || []).find(c => (c.id || c) === channelId);
        if (currentChObj && currentChObj.pinned_messages) {
            currentChObj.pinned_messages.forEach(mid => {
                const el = container.querySelector(`[data-msg-id="${mid}"]`);
                if (el) updatePinnedMessageUI(el, true);
            });
        }

        container.scrollTop = container.scrollHeight;
    } catch (error) {
        console.log('No messages yet or error loading:', error);
        container.innerHTML = '<div class="text-center text-discord-gray-400 py-4">Start the conversation!</div>';
    }
}

function switchGroupChannel(group, channelId) {
    // Re-render channel list to update active states
    loadGroupChannels(group, channelId);

    // Load messages for this channel
    loadGroupMessages(group, channelId);
}

async function appendGroupMessage(msg) {
    const container = document.getElementById('groupChatMessages');
    if (!container || !window.createDiscordMessage) return;

    const el = await createDiscordMessage(msg);
    
    // Check if pinned (if msg has pinned property from backend, currently not sent but we can update later)
    // For now, rely on updates or separate fetch.
    
    // Context Menu for Pinning
    el.addEventListener('contextmenu', (e) => {
        // Check permissions
        const me = localStorage.getItem('username') || localStorage.getItem('savedUsername');
        const group = groupsData.find(g => g.id === currentGroupId);
        if (!group) return;
        
        const roles = group.roles || {};
        const isOwner = group.owner === me;
        const isAdmin = (roles.admin || []).includes(me);
        const isMod = (roles.moderator || []).includes(me);
        
        if (isOwner || isAdmin || isMod) {
            e.preventDefault();
            // Simple toggle prompt for MVP
            // Ideally check if already pinned to toggle text
            if (confirm("Pin/Unpin this message?")) {
                 const action = confirm("Click OK to PIN, Cancel to UNPIN") ? 'pin' : 'unpin';
                 window.socket.emit('pin_message', {
                     groupId: currentGroupId,
                     channelId: activeChannelId,
                     messageId: msg.id,
                     username: me,
                     action: action
                 });
            }
        }
    });

    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    if (window.feather) feather.replace();
}
window.appendGroupMessage = appendGroupMessage;

// Pin Listeners
function setupPinListeners() {
    const s = window.socket;
    if (!s) { setTimeout(setupPinListeners, 500); return; }
    if (s.__pinListenersAttached) return;
    s.__pinListenersAttached = true;
    
    s.on('message_pinned_update', (data) => {
        if (data.groupId === currentGroupId && data.channelId === activeChannelId) {
            // Update UI for all messages in the list
            // data.pinnedMessages is an array of IDs
            const allMsgs = document.querySelectorAll('#groupChatMessages > div');
            allMsgs.forEach(el => {
                const mid = el.getAttribute('data-msg-id');
                if (mid) {
                    const isPinned = data.pinnedMessages.includes(mid);
                    updatePinnedMessageUI(el, isPinned);
                }
            });
        }
    });
}

function updatePinnedMessageUI(el, isPinned) {
    let pinIcon = el.querySelector('.pin-icon');
    if (isPinned) {
        if (!pinIcon) {
            pinIcon = document.createElement('div');
            pinIcon.className = 'pin-icon absolute -left-2 top-2 text-red-500 transform -rotate-45';
            pinIcon.innerHTML = '<i data-feather="map-pin" class="w-3 h-3"></i>';
            el.appendChild(pinIcon);
            if (window.feather) feather.replace();
        }
    } else {
        if (pinIcon) pinIcon.remove();
    }
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPinListeners);
} else {
    setupPinListeners();
}

// Remove old openGroupChat - no longer needed since selectGroup handles everything

// Keep loadGroupMembers export for external calls



window.selectGroup = selectGroup;

function showGroupsModal() {
    const m = document.getElementById('groupsModal');
    if (m) m.classList.remove('hidden');
}
window.showGroupsModal = showGroupsModal;

function closeGroupsModal() {
    const m = document.getElementById('groupsModal');
    if (m) m.classList.add('hidden');
}
window.closeGroupsModal = closeGroupsModal;

function switchGroupModalTab(tab) {
    const createTab = document.getElementById('createGroupTab');
    const joinTab = document.getElementById('joinGroupTab');
    const createForm = document.getElementById('createGroupForm');
    const joinForm = document.getElementById('joinGroupForm');

    if (tab === 'create') {
        createTab.classList.add('border-b-2', 'border-discord-blurple', 'text-white');
        createTab.classList.remove('text-discord-gray-400');
        joinTab.classList.remove('border-b-2', 'border-discord-blurple', 'text-white');
        joinTab.classList.add('text-discord-gray-400');

        createForm.classList.remove('hidden');
        joinForm.classList.add('hidden');
    } else {
        joinTab.classList.add('border-b-2', 'border-discord-blurple', 'text-white');
        joinTab.classList.remove('text-discord-gray-400');
        createTab.classList.remove('border-b-2', 'border-discord-blurple', 'text-white');
        createTab.classList.add('text-discord-gray-400');

        joinForm.classList.remove('hidden');
        createForm.classList.add('hidden');
    }
}
window.switchGroupModalTab = switchGroupModalTab;

// function openGroupChat removed (duplicated/legacy)
// function appendGroupMessage removed (duplicated)


async function refreshGroups() {
    return loadGroups();
}
window.refreshGroups = refreshGroups;

async function createNewGroup() {
    const owner = localStorage.getItem('username');
    const nameInput = document.getElementById('newGroupNameInput');
    const descInput = document.getElementById('newGroupDescInput');
    const iconInput = document.getElementById('newGroupIconInput');
    let name = nameInput?.value?.trim();

    if (!name) { alert("Please enter a group name."); return; }

    const description = descInput?.value?.trim() || "";
    
    // Read icon data if provided
    let iconData = null;
    if (iconInput && iconInput.files && iconInput.files[0]) {
        iconData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.readAsDataURL(iconInput.files[0]);
        });
    }

    if (!owner) return;
    try {
        const res = await fetch('/api/groups/create', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ owner, name, description, iconData }) 
        });
        const data = await res.json();
        if (res.ok && data.success) {
            closeGroupsModal();
            refreshGroups();
            if (nameInput) nameInput.value = '';
            if (descInput) descInput.value = '';
            if (iconInput) iconInput.value = '';
        } else {
            alert(data.error || "Failed to create group.");
        }
    } catch { }
}
window.createNewGroup = createNewGroup;

async function joinExistingGroup() {
    const groupIdInput = document.getElementById('joinGroupIdInput');
    const groupId = groupIdInput?.value?.trim();
    const username = localStorage.getItem('username');

    if (!username || !groupId) return;

    try {
        const res = await fetch('/api/groups/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, groupId }) });
        const data = await res.json();

        if (data.success) {
            closeGroupsModal();
            refreshGroups();
            if (groupIdInput) groupIdInput.value = '';
        } else {
            alert(data.error || "Failed to join group.");
        }
    } catch { }
}
window.joinExistingGroup = joinExistingGroup;

function sendGroupChatMessage() {
    const inputAlt = document.getElementById('groupChatInput');
    if (!inputAlt) return;
    
    const message = (inputAlt.value || '').trim();
    if (!message || !currentGroupId) return;
    
    const username = localStorage.getItem('username') || localStorage.getItem('savedUsername');
    const channel = activeChannelId || 'general';
    
    const payload = {
        id: (typeof generateUUID === 'function' ? generateUUID() : 'grp_' + Date.now()),
        groupId: currentGroupId,
        channel: channel,
        username: username,
        message,
        replyTo: window.replyContext ? { id: replyContext.id, username: replyContext.username, content: replyContext.content } : null,
        ts: Date.now() / 1000
    };
    
    // Optimistic UI - show message immediately
    (async () => { await appendGroupMessage(payload); })();
    
    // Send to server
    if (navigator.onLine && window.socket) {
        window.socket.emit('send_group_message', payload);
    }
    
    inputAlt.value = ''; 
    inputAlt.style.height = 'auto';
    if(window.cancelReply) window.cancelReply();
}
window.sendGroupChatMessage = sendGroupChatMessage;

function sendGroupFile(event) {
    const file = event.target.files?.[0];
    if (!file || !currentGroupId) return;

    // Security: 10MB File Size Limit
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
        alert("File is too large! Maximum file size is 10MB.");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const username = localStorage.getItem('username');
        const payload = {
            groupId: currentGroupId,
            channel: activeChannelId || 'general',
            username: username,
            fileName: file.name,
            fileType: file.type,
            fileData: e.target.result,
            ts: Date.now() / 1000
        };

        // Optimistic UI
        if(window.appendGroupMessage) {
            await appendGroupMessage({ 
                ...payload, 
                message: `File: ${file.name}` // fallback
            });
        }

        if (navigator.onLine && window.socket) window.socket.emit('send_group_file', payload);
        event.target.value = '';
    };
    reader.readAsDataURL(file);
}
window.sendGroupFile = sendGroupFile;

// Listeners - Deferred setup to ensure socket is ready
function setupGroupSocketListeners() {
    const s = window.socket;
    if (!s) {
        // Retry if socket not ready yet
        setTimeout(setupGroupSocketListeners, 500);
        return;
    }
    if (s.__groupListenersAttached) return;
    s.__groupListenersAttached = true;
    
    s.on('receive_group_message', async (data) => {
        if (data.groupId === currentGroupId) {
            await appendGroupMessage(data);
            // If viewing this channel, mark as read
            if (activeChannelId === (data.channel || 'general')) {
                markGroupChannelRead();
            }
        }
    });
    s.on('receive_group_file', async (data) => {
        if (data.groupId === currentGroupId) await appendGroupMessage(data);
    });
    
    s.on('group_read_update', (data) => {
        // data = { groupId, channel, username, messageId }
        if (data.groupId === currentGroupId) {
            // Find messages and update tick
            const selector = data.messageId ? `[data-msg-id="${data.messageId}"]` : `.chat-messages > div`;
            const msgs = document.querySelectorAll(selector);
            msgs.forEach(msgEl => {
                 // Only update own messages
                 // But wait, createDiscordMessage only renders status for OWN messages.
                 // So selecting all is fine, the non-own ones won't have the status icon container or we check author.
                 // Actually, simpler: find .msg-status-icon inside.
                 const icon = msgEl.querySelector('.msg-status-icon');
                 if (icon) {
                     icon.innerHTML = '<span class="text-blue-400 font-bold" title="Read">✓✓</span>';
                 }
            });
        }
    });
}

function markGroupChannelRead() {
    if (!currentGroupId || !activeChannelId || !window.socket) return;
    const me = localStorage.getItem('username') || localStorage.getItem('savedUsername');
    window.socket.emit('mark_group_read', {
        groupId: currentGroupId,
        channel: activeChannelId,
        username: me
    });
}

// Initialize on DOM ready or immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupGroupSocketListeners);
} else {
    setupGroupSocketListeners();
}
// Role Management
function showAssignRoleModal(role) {
    const username = prompt(`Enter username to assign as ${role}:`);
    if (username) {
        assignRole(username, role);
    }
}
window.showAssignRoleModal = showAssignRoleModal;

function assignRole(targetUser, role) {
    if (!currentGroupId || !window.socket) return;
    const me = localStorage.getItem('username') || localStorage.getItem('savedUsername');
    
    window.socket.emit('assign_role', {
        groupId: currentGroupId,
        username: me,
        targetUser: targetUser,
        role: role
    });
}

function updateRolesUI(groupId, roles) {
    // Only update if we are in settings for this group
    if (currentGroupId !== groupId) return;
    
    // In a real app, we would re-render the list. 
    // For now, let's just alert success or refresh logic if needed.
    // The simple UI we built doesn't list individual members yet except via logic we need to add.
    // Let's implement a simple member list fetch/refresh if open.
    console.log('Roles updated:', roles);
}

// Enhance setupGroupSocketListeners from previous step
// We need to re-declare it or append to it. 
// Since we can't easily append to inside a function without replacing it, 
// let's add a separate listener setup that runs finding the socket.

function setupRoleListeners() {
    const s = window.socket;
    if (!s) { setTimeout(setupRoleListeners, 500); return; }
    if (s.__roleListenersAttached) return;
    s.__roleListenersAttached = true;
    
    s.on('group_roles_updated', (data) => {
        if (data.groupId === currentGroupId) {
            // updateRolesUI(data.groupId, data.roles);
            // Refresh groups data to get new roles
            loadGroups(); 
            alert('Roles updated successfully!');
        }
    });
    
    s.on('user_kicked', (data) => {
        if (data.username === (localStorage.getItem('username') || localStorage.getItem('savedUsername'))) {
            alert(`You have been kicked from the group.`);
            location.reload(); // Simple reload to reset state
        } else if (data.groupId === currentGroupId) {
            loadGroups(); // Refresh member list
        }
    });
}
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupRoleListeners);
    setupRoleListeners();
}

// Channel Creation
async function showCreateChannelInput() {
    const name = prompt("Enter new channel name:");
    if (!name) return;
    
    // Simple verification for category input for now
    const category = prompt("Enter category (e.g. Text Channels, Voice Channels):", "Text Channels");
    
    // Determine type based on name or ask? 
    const type = confirm("Is this a Voice Channel? OK for Yes, Cancel for No") ? 'voice' : 'text';
    
    if (!currentGroupId) return;
    
    const username = localStorage.getItem('username') || localStorage.getItem('savedUsername');
    
    try {
        const res = await fetch('/api/groups/channels/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                groupId: currentGroupId,
                username: username,
                channelName: name,
                type: type,
                category: category || 'Text Channels'
            })
        });
        
        const data = await res.json();
        if (data.success) {
            // Refresh group data
            loadGroups(); // This will re-render channels
            alert('Channel created!');
        } else {
            alert(data.error || 'Failed to create channel');
        }
    } catch (e) {
        console.error('Error creating channel:', e);
        alert('Failed to connect to server.');
    }
}
window.showCreateChannelInput = showCreateChannelInput;

// Pinned Messages Modal Logic
function togglePinnedMessagesModal() {
    const m = document.getElementById('pinnedMessagesModal');
    if (!m) return;
    
    if (m.classList.contains('hidden')) {
        m.classList.remove('hidden');
        renderPinnedMessagesList();
    } else {
        m.classList.add('hidden');
    }
}
window.togglePinnedMessagesModal = togglePinnedMessagesModal;

async function renderPinnedMessagesList() {
    const list = document.getElementById('pinnedMessagesList');
    if(!list) return;
    list.innerHTML = '<div class="text-center text-gray-500 py-4">Loading...</div>';
    
    if (!currentGroupId || !activeChannelId) return;

    try {
        const res = await fetch(`/api/groups/${currentGroupId}/channels/${activeChannelId}/pins`);
        const data = await res.json();
        
        if (!data.success || !data.messages || data.messages.length === 0) {
            list.innerHTML = `<div class="text-center text-gray-500 py-8 flex flex-col items-center">
                <i data-feather="map-pin" class="w-8 h-8 mb-2 opacity-50"></i>
                <p>No pinned messages yet.</p>
            </div>`;
            if (window.feather) feather.replace();
            return;
        }

        list.innerHTML = '';
        data.messages.forEach(msg => {
            let content = msg.message || "";
            // Check for file
            if (msg.fileName && !content) content = `File: ${msg.fileName}`;
            if (msg.fileName && content) content += ` (File: ${msg.fileName})`;
            
            // Clean up content
            content = content.replace(/</g, "&lt;").replace(/>/g, "&gt;");

            const item = document.createElement('div');
            item.className = "bg-discord-gray-900 p-3 rounded text-sm mb-2 border border-discord-gray-700 hover:border-discord-gray-600 transition-colors";
            item.innerHTML = `
                <div class="font-bold text-discord-blurple mb-1 flex justify-between items-center">
                    <span>${msg.username || 'Unknown'}</span>
                    <span class="text-[10px] bg-discord-gray-800 px-2 py-0.5 rounded cursor-pointer hover:bg-discord-blurple hover:text-white transition" onclick="scrollToMessage('${msg.id}')">JUMP</span>
                </div>
                <div class="text-gray-300 line-clamp-3 break-words">${content}</div>
                <div class="text-[10px] text-gray-500 mt-1">${new Date((msg.ts || Date.now()) * 1000).toLocaleString()}</div>
            `;
            list.appendChild(item);
        });
        if (window.feather) feather.replace();
        
    } catch (e) {
        console.error('Error fetching pins:', e);
        list.innerHTML = '<div class="text-red-400 text-center py-4">Failed to load pins.</div>';
    }
}

function scrollToMessage(mid) {
    const el = document.querySelector(`[data-msg-id="${mid}"]`);
    if (el) {
        togglePinnedMessagesModal(); // close
        el.scrollIntoView({behavior: 'smooth', block: 'center'});
        
        // Highlight effect
        el.style.transition = 'background-color 0.5s';
        const originalBg = el.style.backgroundColor;
        el.style.backgroundColor = 'rgba(88, 101, 242, 0.3)'; // Blurple transparent
        
        setTimeout(() => {
            el.style.backgroundColor = originalBg;
            setTimeout(() => { el.style.backgroundColor = ''; }, 500);
        }, 1500);
    } else {
        alert("Message is not currently loaded in the view. Scroll up to load context.");
    }
}
window.scrollToMessage = scrollToMessage;
