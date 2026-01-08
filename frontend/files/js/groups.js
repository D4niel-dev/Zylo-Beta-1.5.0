
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

    channels.forEach(ch => {
        const channelName = typeof ch === 'string' ? ch : ch.name;
        const channelId = typeof ch === 'string' ? ch : ch.id;
        
        const btn = document.createElement('div');
        const isActive = (typeof activeChannelId !== 'undefined' ? activeChannelId : 'general') === channelId;
        btn.className = `channel-item group flex items-center p-2 rounded cursor-pointer transition-colors mb-0.5 ${isActive ? 'bg-discord-gray-600/50 text-white' : 'text-discord-gray-400 hover:bg-discord-gray-700/50 hover:text-discord-gray-200'}`;
        btn.innerHTML = `<span class="text-discord-gray-400 mr-1">#</span> ${channelName}`;
        btn.onclick = () => {
             switchGroupChannel(group, channelId);
        };
        list.appendChild(btn);
    });

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
        item.className = 'flex items-center gap-2 p-1 text-sm';
        item.innerHTML = `
            <div class="w-2 h-2 rounded-full bg-green-500"></div>
            <span class="text-discord-gray-300">${member}</span>
          `;
        container.appendChild(item);
    });

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
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    if (window.feather) feather.replace();
}
window.appendGroupMessage = appendGroupMessage;

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
    let name = nameInput?.value?.trim();

    if (!name) { alert("Please enter a group name."); return; }

    const description = descInput?.value?.trim() || "";

    if (!owner) return;
    try {
        const res = await fetch('/api/groups/create', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ owner, name, description }) });
        const data = await res.json();
        if (res.ok && data.success) {
            closeGroupsModal();
            refreshGroups();
            if (nameInput) nameInput.value = '';
            if (descInput) descInput.value = '';
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
    const input = document.getElementById('friendsChatInput'); // Reusing friend input if that's the view
    // Wait, mainapp.html had 'groupChatInput' in some places, but if we are reusing 'friendsChatView', we might use 'friendsChatInput'.
    // Logic in mainapp.html says: 
    // "startReply... if(showGroup) inputId = 'groupChatInput'"
    // But `openGroupChat` shows `friendsChatView`.
    // Let's check `mainapp.html` again. 
    // `sendFriendMessage` handles Group if `activeFriendChat` is object.
    // `sendGroupChatMessage` uses `groupChatInput` and `groupsState.activeId`.
    // It seems there were TWO implementations of Groups: one separate tab, and one integrated into Friends view.
    // Key decision: support the Integrated one via `sendFriendMessage`.
    // `sendGroupChatMessage` might be legacy or for a specific separate tab.
    // I will keep `sendGroupChatMessage` just in case, but point it to `sendFriendMessage` logic if possible or keep independent.
    
    // Implementation:
    const inputAlt = document.getElementById('groupChatInput');
    if(inputAlt && !inputAlt.offsetParent) { 
        // if groupChatInput is hidden/not used, maybe use friendsChatInput via sendFriendMessage?
        if(window.sendFriendMessage) return window.sendFriendMessage();
    }
    
    const message = (inputAlt?.value || '').trim();
    if (!message || !currentGroupId) return;
    
    const payload = {
        groupId: currentGroupId,
        username: localStorage.getItem('username'),
        message,
        replyTo: window.replyContext ? { id: replyContext.id, username: replyContext.username, content: replyContext.content } : null
    };
    
    if (navigator.onLine && window.socket) window.socket.emit('send_group_message', payload);
    else (async () => { await appendGroupMessage(payload); })();
    
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

// Listeners
if (typeof socket !== 'undefined') {
    socket.on('receive_group_message', async (data) => {
        if (data.groupId === currentGroupId) await appendGroupMessage(data);
    });
    socket.on('receive_group_file', async (data) => {
        if (data.groupId === currentGroupId) await appendGroupMessage(data);
    });
}
