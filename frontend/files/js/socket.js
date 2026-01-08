/**
 * socket.js - Socket.IO Initialization and Connection Management
 */

// Initialize Socket.IO
var baseUrl = window.location.origin;
var socket = navigator.onLine ? io(baseUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 10
}) : { emit: function () { }, on: function () { }, off: function () { } };

window.socket = socket;

// Connection status management
function updateConnectionStatus(status) {
    const indicator = document.getElementById('connectionIndicator');
    if (!indicator) return;

    if (status === 'connected') {
        indicator.className = 'w-2 h-2 rounded-full bg-green-500';
        indicator.title = 'Connected';
    } else if (status === 'connecting') {
        indicator.className = 'w-2 h-2 rounded-full bg-yellow-500 animate-pulse';
        indicator.title = 'Reconnecting...';
    } else {
        indicator.className = 'w-2 h-2 rounded-full bg-red-500';
        indicator.title = 'Disconnected';
    }
}

function rejoinActiveRooms() {
    const u = localStorage.getItem('savedUsername');
    if (u) {
        socket.emit('join_user', { username: u });
        socket.emit('register_status', { username: u });
    }
    // Rejoin active group room if viewing a group
    if (typeof currentGroupId !== 'undefined' && currentGroupId) {
        socket.emit('join_group', { groupId: currentGroupId, username: u });
    }
}

if (navigator.onLine) {
    socket.on('connect', () => {
        console.log('Socket connected');
        updateConnectionStatus('connected');
        rejoinActiveRooms();
    });

    socket.on('disconnect', (reason) => {
        console.log('Socket disconnected:', reason);
        updateConnectionStatus('disconnected');
        if (typeof showToast === 'function') {
            showToast('Connection lost. Attempting to reconnect...', 3000);
        }
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
        console.log('Reconnection attempt:', attemptNumber);
        updateConnectionStatus('connecting');
    });

    socket.on('reconnect', (attemptNumber) => {
        console.log('Reconnected after', attemptNumber, 'attempts');
        updateConnectionStatus('connected');
        rejoinActiveRooms();
        if (typeof showToast === 'function') {
            showToast('Reconnected!', 2000);
        }
    });

    socket.on('reconnect_failed', () => {
        console.log('Reconnection failed');
        updateConnectionStatus('disconnected');
        if (typeof showToast === 'function') {
            showToast('Could not reconnect. Please check your connection.', 5000);
        }
    });

    // User Status & Presence
    socket.on('user_status_change', (data) => {
        const { username, status, last_active } = data;
        updateUserStatusUI(username, status, last_active);
    });
}

// Idle Detection
var idleTimer;
var IDLE_TIMEOUT = 5 * 60 * 1000; // 5 minutes
var isAway = false;

function resetIdleTimer() {
    clearTimeout(idleTimer);
    if (isAway && navigator.onLine) {
        isAway = false;
        const u = localStorage.getItem('savedUsername');
        if (u) socket.emit('update_status', { username: u, status: 'online' });
    }
    idleTimer = setTimeout(() => {
        isAway = true;
        const u = localStorage.getItem('savedUsername');
        if (u && navigator.onLine) socket.emit('update_status', { username: u, status: 'away' });
    }, IDLE_TIMEOUT);
}

if (navigator.onLine) {
    document.addEventListener('mousemove', resetIdleTimer);
    document.addEventListener('keydown', resetIdleTimer);
    resetIdleTimer();
}

function updateUserStatusUI(username, status, last_active) {
    // 1. Sidebar DM List
    const sidebarItem = document.querySelector(`.sidebar-dm-item[data-username="${username}"] .status-dot`);
    if (sidebarItem) {
        sidebarItem.className = `status-dot w-2 h-2 rounded-full absolute bottom-0 right-0 border-2 border-discord-gray-900 ${getStatusColor(status)}`;
    }

    // 2. Friend List
    const friendItem = document.querySelector(`.friend-item[data-username="${username}"] .status-dot`);
    if (friendItem) {
        friendItem.className = `status-dot w-3 h-3 rounded-full border-2 border-discord-gray-800 ${getStatusColor(status)}`;
    }

    // 3. DM Header (if open)
    // Check if activeFriendChat is defined (it might be in chat.js)
    if (typeof activeFriendChat !== 'undefined' && activeFriendChat === username) {
        const headerStatus = document.getElementById('chatHeaderStatus');
        if (headerStatus) {
            if (status === 'online') {
                headerStatus.innerHTML = '<span class="text-green-500">●</span> Online';
            } else if (status === 'away') {
                headerStatus.innerHTML = '<span class="text-yellow-500">●</span> Away';
            } else {
                let timeStr = '';
                if (last_active) {
                    const date = new Date(last_active * 1000);
                    // If today, show time, else show date
                    const isToday = new Date().toDateString() === date.toDateString();
                    timeStr = isToday ? ` today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ` on ${date.toLocaleDateString()}`;
                }
                headerStatus.innerHTML = `<span class="text-gray-500">●</span> Offline${timeStr ? ' • Last seen' + timeStr : ''}`;
            }
        }
    }
}

function getStatusColor(status) {
    if (status === 'online') return 'bg-green-500';
    if (status === 'away') return 'bg-yellow-500';
    return 'bg-gray-500';
}
