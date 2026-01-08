
// Friends Logic

var currentFriendFilter = 'online';

function filterFriends(filter) {
    currentFriendFilter = filter;

    // Update toolbar buttons
    document.querySelectorAll('.friend-toolbar-btn').forEach(btn => {
        btn.classList.remove('active', 'bg-discord-gray-600/50', 'text-white');
        if (btn.textContent.toLowerCase().includes(filter) || (filter === 'add' && btn.classList.contains('add-friend'))) {
            btn.classList.add('active');
        }
    });

    renderFriendsDashboard();
}
window.filterFriends = filterFriends;

function renderFriendsDashboard() {
    const container = document.getElementById('friendsDashboardContent');
    const addSection = document.getElementById('addFriendSection');
    if (!container) return;

    container.innerHTML = '';

    if (currentFriendFilter === 'add') {
        container.classList.add('hidden');
        if(addSection) addSection.classList.remove('hidden');
        return;
    }

    container.classList.remove('hidden');
    if(addSection) addSection.classList.add('hidden');

    // Helper to create row
    const createRow = (username, subtext, actions) => {
        const div = document.createElement('div');
        div.className = 'friend-row group';

        getUserAvatarUrl(username).then(url => {
            const img = div.querySelector('.row-avatar');
            if (img) img.src = url;
        });

        div.innerHTML = `
              <div class="flex items-center gap-3" onclick="openDM('${username}')">
                  <img src="/images/default_avatar.png" class="row-avatar w-10 h-10 rounded-full bg-discord-gray-700">
                  <div>
                      <div class="font-semibold text-white">${username}</div>
                      <div class="text-xs text-discord-gray-400">${subtext}</div>
                  </div>
              </div>
              <div class="flex items-center gap-2">
                  ${actions}
              </div>
      `;
        return div;
    };

    // Render based on filter
    if (currentFriendFilter === 'all' || currentFriendFilter === 'online') {
        // Note: We don't have real presence yet, assuming all friends are "Offline" visually for now or just listing them
        (friendsState.friends || []).forEach(f => {
            const actions = `
          <button class="action-icon-btn" onclick="openDM('${f}')" title="Message"><i data-feather="message-circle" class="w-4 h-4"></i></button>
          <button class="action-icon-btn danger" onclick="removeFriend('${f}')" title="Remove"><i data-feather="trash-2" class="w-4 h-4"></i></button>
      `;
            container.appendChild(createRow(f, "Friend", actions));
        });
        if ((friendsState.friends || []).length === 0) container.innerHTML = `<div class="text-center mt-10 text-discord-gray-400">No friends found. Wumpus is lonely.</div>`;
    }

    if (currentFriendFilter === 'pending') {
        const headerIn = document.createElement('h3');
        headerIn.className = "uppercase text-xs font-bold text-discord-gray-400 mb-2 mt-4";
        headerIn.textContent = `Incoming - ${(friendsState.incoming || []).length} `;
        container.appendChild(headerIn);

        (friendsState.incoming || []).forEach(f => {
            const actions = `
          <button class="action-icon-btn success" onclick="acceptFriend('${f}')"><i data-feather="check" class="w-4 h-4"></i></button>
          <button class="action-icon-btn danger" onclick="declineFriend('${f}')"><i data-feather="x" class="w-4 h-4"></i></button>
      `;
            container.appendChild(createRow(f, "Incoming Friend Request", actions));
        });

        const headerOut = document.createElement('h3');
        headerOut.className = "uppercase text-xs font-bold text-discord-gray-400 mb-2 mt-4";
        headerOut.textContent = `Outgoing - ${(friendsState.outgoing || []).length}`;
        container.appendChild(headerOut);

        (friendsState.outgoing || []).forEach(f => {
            const actions = `
          <button class="action-icon-btn danger" onclick="cancelFriendRequest('${f}')"><i data-feather="x" class="w-4 h-4"></i></button>
          `;
            container.appendChild(createRow(f, "Outgoing Friend Request", actions));
        });
    }

    if (window.feather) feather.replace();
}
window.renderFriendsDashboard = renderFriendsDashboard;

async function requestFriend() {
    const input = document.getElementById('addFriendInput');
    const to = (input?.value || '').trim();
    const from = localStorage.getItem('username');
    if (!to || !from) return;

    try {
        const res = await fetch('/api/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to }) });
        await res.json();
        input.value = '';
        if(window.loadFriends) loadFriends(); 
    } catch { }
}
window.requestFriend = requestFriend;

function requestFriendMain() {
    const input = document.getElementById('addFriendInputMain');
    const to = input.value.trim();
    if (to) {
        const from = localStorage.getItem('username');
        fetch('/api/friends/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to }) })
            .then(r => r.json()).then(d => {
                if (d.success) { alert('Request sent!'); input.value = ''; if(window.loadFriends) loadFriends(); }
                else alert(d.error || 'Failed');
            });
    }
}
window.requestFriendMain = requestFriendMain;

async function acceptFriend(from) {
    const username = localStorage.getItem('username');
    if (!username) return;
    await fetch('/api/friends/accept', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, from }) });
    if(window.loadFriends) loadFriends();
}
window.acceptFriend = acceptFriend;

async function declineFriend(from) {
    const username = localStorage.getItem('username');
    if (!username) return;
    await fetch('/api/friends/decline', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, from }) });
    if(window.loadFriends) loadFriends();
}
window.declineFriend = declineFriend;

async function cancelFriendRequest(target) {
    const username = localStorage.getItem('username');
    if (!username) return;
    await fetch('/api/friends/cancel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, to: target }) });
    if(window.loadFriends) loadFriends();
}
window.cancelFriendRequest = cancelFriendRequest;

async function removeFriend(friend) {
    const username = localStorage.getItem('username');
    if (!username) return;
    await fetch('/api/friends/remove', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, friend }) });
    if(window.loadFriends) loadFriends();
}
window.removeFriend = removeFriend;

// Load Friends (Fetch logic)
async function loadFriends() {
    const username = localStorage.getItem('username');
    if (!username) return;
    try {
        const res = await fetch(`/api/friends?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        friendsState = {
            friends: data.friends || [],
            incoming: data.incoming || data.incoming_requests || [],
            outgoing: data.outgoing || data.outgoing_requests || []
        };
        renderFriendsDashboard();
        // also render sidebar list
        if(window.renderSidebarList) renderSidebarList();
    } catch { }
}
window.loadFriends = loadFriends;

function renderSidebarList() {
    const list = document.getElementById('sidebarDMList');
    if (!list) return;
    list.innerHTML = '';

    // Friends / DMs Header
    const header = document.createElement('div');
    header.className = "px-2 py-1 text-xs font-semibold text-discord-gray-400 uppercase tracking-wider mb-1 mt-2";
    header.textContent = "Direct Messages";
    list.appendChild(header);

    const saved = friendsState.friends || [];
    saved.forEach(friend => {
        const btn = document.createElement('div');
        const isActive = window.activeFriendChat === friend;
        btn.className = `sidebar-dm-item group flex items-center p-2 rounded cursor-pointer transition-colors mx-2 mb-0.5 ${isActive ? 'bg-discord-gray-600/50 text-white' : 'text-discord-gray-400 hover:bg-discord-gray-700/50 hover:text-discord-gray-200'}`;
        btn.dataset.username = friend;
        btn.onclick = () => openDM(friend);

        // Avatar Container
        const avatarContainer = document.createElement('div');
        avatarContainer.className = "relative mr-3";

        const img = document.createElement('img');
        img.src = '/images/default_avatar.png';
        img.className = "w-8 h-8 rounded-full bg-discord-gray-700 object-cover";
        
        // Use getUserAvatarUrl
        if(window.getUserAvatarUrl) {
            getUserAvatarUrl(friend).then(url => img.src = url);
        }

        // Status Dot
        const statusDot = document.createElement('div');
        statusDot.className = "status-dot w-2.5 h-2.5 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-discord-gray-900 bg-gray-500";

        avatarContainer.appendChild(img);
        avatarContainer.appendChild(statusDot);

        const nameSpan = document.createElement('span');
        nameSpan.className = "font-medium truncate flex-1";
        nameSpan.textContent = friend;

        btn.appendChild(avatarContainer);
        btn.appendChild(nameSpan);

        // Delete button placeholder
        const delBtn = document.createElement('button');
        delBtn.className = "hidden group-hover:block text-discord-gray-400 hover:text-white p-1";
        delBtn.innerHTML = '<i data-feather="x" class="w-3 h-3"></i>';
        delBtn.onclick = (e) => {
            e.stopPropagation();
            removeFriend(friend); // Use global removeFriend from friends.js
        };
        btn.appendChild(delBtn);

        list.appendChild(btn);
    });
    if (window.feather) feather.replace();
}
window.renderSidebarList = renderSidebarList;
