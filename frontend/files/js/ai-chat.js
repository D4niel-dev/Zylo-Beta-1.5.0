class AIChatManager {
    constructor() {
        this.activeSessionId = null; 
        this.activeSessions = new Map(); // id -> { model, messages, containerIdentifier }
        // containerIdentifier is tricky because we only have 2 physical containers in DOM for now (Diszi/Zily).
        // Wait, for TRUE multi-tabs (like browser), we need dynamic DOM creation.
        // BUT, the user prompt implies: "open a new tab completely". 
        // We have `aiTabContent_diszi` and `aiTabContent_zily`.
        // If we want multiple Diszis, we need to clone the DOM or manage content swapping.
        // EASIER APPROACH: Keep the 2 physical containers (Viewports), but swap the *content* (messages) based on active Session ID.
        // AND maybe separate "Tabs" in the UI bar are actual Session IDs.
        
        // Let's go with:
        // - `activeSessions`: Map of open sessions (Tabs).
        // - `activeSessionId`: The one currently displayed.
        // - We render the messages of the active session into the physical container matching its model (Diszi or Zily).
        
        this.allSessions = []; // Historical storage
        
        this.sessions = {
            diszi: { container: document.getElementById('aiTabContent_diszi') },
            zily: { container: document.getElementById('aiTabContent_zily') }
        };

        this.chatContainerWrapper = document.getElementById('chatMessagesAI');
        this.tabBar = document.getElementById('aiTabBar');
        this.input = document.getElementById('chatInput');
        this.controls = document.getElementById('aiControls');
        
        // Bind methods
        this.sendMessage = this.sendMessage.bind(this);
        this.toggleModel = this.startNewSession.bind(this); // Toggle now starts new session
        this.switchTab = this.switchTab.bind(this);
        this.openSettingsModal = this.openSettingsModal.bind(this);
        this.saveSettings = this.saveSettings.bind(this);
        this.closeTab = this.closeTab.bind(this);
        this.openHistoryModal = this.openHistoryModal.bind(this);
        
        this.init();
    }

    init() {
        console.log('AIChatManager initialized (Multi-Session)');
        this.loadHistory(); 
        this.updateUI();
    }

    getStorageKey() {
        const user = localStorage.getItem('username') || localStorage.getItem('savedUsername') || 'guest';
        return 'ai_sessions_v2_' + user;
    }

    loadHistory() {
        try {
            const saved = localStorage.getItem(this.getStorageKey());
            if (saved) {
                this.allSessions = JSON.parse(saved);
            }
        } catch (e) { console.error('Error loading history', e); }
    }

    saveSession(session) {
        // Update timestamp
        session.timestamp = Date.now();
        
        // Update/Add to allSessions
        const idx = this.allSessions.findIndex(s => s.id === session.id);
        if (idx >= 0) {
            this.allSessions[idx] = session;
        } else {
            this.allSessions.push(session);
        }
        
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.allSessions));
    }

    startNewSession(modelType) {
        // If modelType arg is missing (HTML click), determine from context? 
        // Actually the button onclick sends specific model? 
        // No, the HTML says `if(window.aiManager) window.aiManager.activeModel !== 'diszi' && window.aiManager.toggleModel()`
        // We should update HTML to pass model type, OR infer.
        // Let's assume toggleModel is now "Create New X Session".
        
        if (!modelType && this.activeSessionId) {
             // Toggle behavior: if currently diszi, make zily.
             const current = this.activeSessions.get(this.activeSessionId);
             modelType = (current && current.model === 'diszi') ? 'zily' : 'diszi';
        } else if (!modelType) {
            modelType = 'zily'; // Default
        }

        const id = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        const newSession = {
            id: id,
            model: modelType,
            messages: [],
            timestamp: Date.now(),
            name: `New ${modelType} Chat` // Default name
        };
        
        this.activeSessions.set(id, newSession);
        this.switchTab(id);
        this.saveSession(newSession);
    }

    switchTab(sessionId) {
        if (!this.activeSessions.has(sessionId)) {
            // Must be restoring from history
            const historical = this.allSessions.find(s => s.id === sessionId);
            if (historical) {
                this.activeSessions.set(sessionId, historical);
            } else {
                return; // Error
            }
        }

        this.activeSessionId = sessionId;
        const session = this.activeSessions.get(sessionId);
        const modelKey = session.model;

        // Show correct container
        Object.keys(this.sessions).forEach(key => {
            const container = this.sessions[key].container;
            if (key === modelKey) {
                container.classList.remove('hidden');
                // Render session messages into this container
                this.renderSessionContent(session, container);
            } else {
                container.classList.add('hidden');
            }
        });

        this.renderTabBar();
        this.updateUI();
    }

    renderSessionContent(session, container) {
        container.innerHTML = ''; // Clear current view
        
        if (session.messages.length === 0) {
            this.renderWelcomeScreen(session.model, container);
        } else {
            session.messages.forEach(msg => {
                this.appendMessageToDOM(session.model, msg.role, msg.content, container);
            });
            this.scrollToBottom(container);
        }
    }

    renderTabBar() {
        if (this.activeSessions.size === 0) {
            this.tabBar.classList.add('hidden');
            return;
        }
        
        this.tabBar.classList.remove('hidden');
        this.tabBar.innerHTML = '';
        
        this.activeSessions.forEach((session, id) => {
            const isActive = id === this.activeSessionId;
            const model = session.model;
            const name = model === 'diszi' ? 'Diszi' : 'Zily';
            const colorClass = model === 'diszi' ? 'text-blue-400' : 'text-purple-400';
            const bgClass = isActive ? 'bg-discord-gray-600' : 'hover:bg-discord-gray-800';
            
            const btn = document.createElement('button');
            btn.className = `flex items-center gap-2 px-3 py-1 rounded text-sm font-medium transition-colors ${bgClass}`;
            // Use session ID suffix or timestamp for display name? Or just "Diszi"
            // If multiple Diszi, we need differentiation.
            const displayName = session.messages.length > 0 
                ? (session.messages[0].content.substring(0, 10) + '...') 
                : `${name}`;
            
            btn.innerHTML = `
                <span class="${colorClass}">●</span>
                <span class="text-white max-w-[100px] truncate">${displayName}</span>
                <span onclick="event.stopPropagation(); window.aiManager.closeTab('${id}')" 
                      class="ml-2 text-discord-gray-400 hover:text-white cursor-pointer px-1">×</span>
            `;
            btn.onclick = () => this.switchTab(id);
            this.tabBar.appendChild(btn);
        });
    }

    closeTab(id) {
        this.activeSessions.delete(id);
        if (this.activeSessionId === id) {
            this.activeSessionId = null;
            if (this.activeSessions.size > 0) {
                this.switchTab(this.activeSessions.keys().next().value); // Switch to first available
            } else {
                // No tabs left. Clear view.
                Object.values(this.sessions).forEach(s => s.container.classList.add('hidden'));
                this.renderTabBar();
                this.updateUI();
            }
        } else {
            this.renderTabBar();
        }
    }

    updateUI() {
        if (!this.activeSessionId) {
            this.input.placeholder = "Select or Start a Chat...";
            return;
        }
        
        const session = this.activeSessions.get(this.activeSessionId);
        const model = session.model;
        
        this.controls.setAttribute('data-ai-model', model);
        
        // Update toggles to act as "New Chat" buttons
        document.getElementById('btnDiszi').classList.remove('active');
        document.getElementById('btnZily').classList.remove('active');
        // We don't really have an "active" model toggle state anymore if they are just "New" buttons.
        // Or we can highlight the one matching current session.
        if (model === 'diszi') document.getElementById('btnDiszi').classList.add('active');
        if (model === 'zily') document.getElementById('btnZily').classList.add('active');
        
        const placeholder = model === 'diszi' 
            ? 'Message Diszi...' 
            : 'Message Zily...';
        if (this.input) this.input.placeholder = placeholder;
    }

    // --- History Logic ---

    openHistoryModal() {
        const modal = document.getElementById('aiHistoryModal');
        const list = document.getElementById('aiHistoryList');
        if (!modal || !list) return;

        modal.classList.remove('hidden');
        list.innerHTML = '';
        
        const sorted = [...this.allSessions].sort((a, b) => b.timestamp - a.timestamp);
        
        if (sorted.length === 0) {
            list.innerHTML = '<div class="text-center text-gray-500">No history found.</div>';
            return;
        }

        sorted.forEach(s => {
            const el = document.createElement('div');
            el.className = 'p-3 bg-discord-gray-900/50 rounded hover:bg-discord-gray-700 cursor-pointer flex justify-between items-center group';
            const date = new Date(s.timestamp).toLocaleString();
            const preview = s.messages.length > 0 ? s.messages[0].content.substring(0, 40) + '...' : '(Empty Chat)';
            const color = s.model === 'diszi' ? 'text-blue-400' : 'text-purple-400';
            
            el.innerHTML = `
                <div>
                    <div class="flex items-center gap-2">
                         <span class="text-xs font-bold uppercase ${color}">${s.model}</span>
                         <span class="text-gray-400 text-xs">${date}</span>
                    </div>
                    <div class="text-white text-sm mt-1">${preview}</div>
                </div>
                <button class="text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 p-2"
                        onclick="event.stopPropagation(); window.aiManager.deleteSession('${s.id}')">
                    <i data-feather="trash-2" class="w-4 h-4"></i>
                </button>
            `;
            el.onclick = () => {
                this.activeSessions.set(s.id, s);
                this.switchTab(s.id);
                modal.classList.add('hidden');
                if(window.feather) feather.replace();
            };
            list.appendChild(el);
        });
        if(window.feather) feather.replace();
    }

    deleteSession(id) {
        this.allSessions = this.allSessions.filter(s => s.id !== id);
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.allSessions));
        this.openHistoryModal(); // Refresh list
        this.closeTab(id); // Close if open
    }

    clearAllHistory() {
        this.allSessions = [];
        this.activeSessions.clear();
        this.activeSessionId = null;
        localStorage.removeItem(this.getStorageKey());
        
        Object.values(this.sessions).forEach(s => s.container.innerHTML = '');
        
        document.getElementById('aiSettingsModal').classList.add('hidden');
        this.renderTabBar();
        this.updateUI();
        alert('History Cleared.');
    }
    
    // --- Existing Helper Methods (Modified) ---

    async sendMessage(text) {
        if (!text.trim()) return;
        
        // If no session active, start one?
        if (!this.activeSessionId) {
            this.startNewSession('zily'); // Default
        }

        const session = this.activeSessions.get(this.activeSessionId);
        const modelKey = session.model;
        const container = this.sessions[modelKey].container;

        // Add user message
        session.messages.push({ role: 'user', content: text });
        this.saveSession(session);
        this.renderSessionContent(session, container); // Re-render or append? Append is better but re-render is safer for sync. 
        // Let's just append for performance.
        // Actually, renderSessionContent clears innerHTML, so we should Append.
        // But wait, "renderSessionContent" was used in switchTab.
        // Let's use appendMessageToDOM directly.
        // But renderSessionContent clears "Welcome Screen".
        // The welcome screen logic needs to be robust.
        // Let's just re-render session content is safest to ensure welcome screen gone.
        this.renderSessionContent(session, container);

        this.showTyping(container, session.model);

        try {
            // Get selected sub-model (gemma:2b etc) from settings (shared per persona key)
            const selectedSubModel = localStorage.getItem(`ai_model_${modelKey}`) || 'gemma:2b';
            
            const response = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: selectedSubModel,
                    persona: modelKey,
                    messages: session.messages
                })
            });
            
            const data = await response.json();
            
            this.hideTyping(container);
            
            if (data.success) {
                const reply = data.reply || data.response?.content || 'Empty response';
                session.messages.push({ role: 'assistant', content: reply });
                this.saveSession(session);
                this.renderSessionContent(session, container); 
            } else {
                const err = 'Error: ' + (data.error || 'Unknown error');
                session.messages.push({ role: 'assistant', content: err });
                this.renderSessionContent(session, container);
            }
        } catch (e) {
            this.hideTyping(container);
            session.messages.push({ role: 'assistant', content: 'Error: Connection failed.' });
            this.renderSessionContent(session, container);
        }
    }

    appendMessageToDOM(model, role, content, container) {
        const div = document.createElement('div');
        const isUser = role === 'user';
        
        let avatarUrl = '/images/default_avatar.png';
        const imgId = `avatar-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        if (isUser) {
            // Try to use cached window.currentUser first
            if (window.currentUser && window.currentUser.avatar) {
                avatarUrl = window.currentUser.avatar;
            } else {
                // Async fetch
                const username = localStorage.getItem('username');
                if (username) {
                     if (window.getUserAvatarUrl) {
                        window.getUserAvatarUrl(username).then(url => {
                            const img = document.getElementById(imgId);
                            if (img) img.src = url;
                        });
                     } else {
                         avatarUrl = `/uploads/${username}/avatar.png`;
                     }
                }
            }
        } else {
            avatarUrl = model === 'diszi' ? '/images/ai/Diszi_beta2.png' : '/images/ai/Zily_beta2.png';
        }
            
        // Styling classes
        const baseClass = "flex gap-3 mb-6 max-w-[90%]";
        const alignClass = isUser ? "ml-auto flex-row-reverse" : "mr-auto";
        const bubbleClass = isUser 
            ? "bg-discord-gray-600 text-white rounded-2xl rounded-tr-sm p-4" 
            : (model === 'diszi' 
                ? "bg-gradient-to-br from-blue-900/50 to-discord-gray-700 border-l-4 border-blue-500 text-white rounded-2xl rounded-tl-sm p-4 shadow-lg backdrop-blur-sm" 
                : "bg-gradient-to-br from-purple-900/50 to-discord-gray-700 border-l-4 border-purple-500 text-white rounded-2xl rounded-tl-sm p-4 shadow-lg backdrop-blur-sm");

        div.className = `${baseClass} ${alignClass}`;
        
        div.innerHTML = `
            <img id="${imgId}" src="${avatarUrl}" class="w-10 h-10 rounded-full flex-shrink-0 object-cover border-2 ${isUser ? 'border-gray-500' : (model === 'diszi' ? 'border-blue-500' : 'border-purple-500')}" alt="${role}">
            <div class="${bubbleClass} overflow-hidden">
                ${!isUser ? `<div class="text-xs font-bold mb-1 ${model === 'diszi' ? 'text-blue-400' : 'text-purple-400'} uppercase tracking-wide">${model}</div>` : ''}
                <div class="prose prose-invert max-w-none text-sm leading-relaxed">
                    ${this.formatContent(content)}
                </div>
            </div>
        `;
        container.appendChild(div);
    }
    
    showTyping(container) {
        // Determine model from container ID or context? 
        // We know the container is specific to a session, but we need the model name.
        // Quick hack: check container ID or we can pass model to showTyping if we update call sites.
        // Let's look at call sites: this.showTyping(container) in sendMessage.
        // We have 'session' object there. Let's update sendMessage to pass model.
        
        // Actually, let's just use a generic 'AI' avatar or try to infer.
        // Better: Update showTyping signature. But I can't easily do that without multi-hunk.
        // Let's assume passed container has ID like `aiTabContent_diszi` ?? No, dynamic rendering.
        // Wait, in `sendMessage`, we have `session.model`. I should pass it.
    }
    
    // REDEFINING showTyping to accept model
    showTyping(container, model = 'zily') {
        const div = document.createElement('div');
        div.id = `aiTyping`;
        div.className = "flex gap-3 mb-6 mr-auto max-w-[90%]";
        const avatarUrl = model === 'diszi' ? '/images/ai/Diszi_beta2.png' : '/images/ai/Zily_beta2.png';
        
        div.innerHTML = `
             <img src="${avatarUrl}" class="w-10 h-10 rounded-full flex-shrink-0 object-cover border-2 ${model === 'diszi' ? 'border-blue-500' : 'border-purple-500'} animate-pulse" alt="Typing">
             <div class="bg-discord-gray-700/50 rounded-2xl rounded-tl-sm p-4 flex items-center">
                <div class="typing-dots"><span class="animate-bounce">.</span><span class="animate-bounce delay-100">.</span><span class="animate-bounce delay-200">.</span></div>
             </div>
        `;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    hideTyping(container) {
        const el = container.querySelector('#aiTyping');
        if (el) el.remove();
    }
    
    scrollToBottom(container) {
        if(container) container.scrollTop = container.scrollHeight;
    }

    formatContent(text) {
        return text
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`(.*?)`/g, '<code>$1</code>');
    }

    // Settings Modal
    async openSettingsModal() {
        const modal = document.getElementById('aiSettingsModal');
        if (modal) {
            modal.classList.remove('hidden');
            await this.fetchAndPopulateModels();
        }
    }
    
    async fetchAndPopulateModels() {
         const selectDiszi = document.getElementById('selectModel_diszi');
        const selectZily = document.getElementById('selectModel_zily');
        try {
            const res = await fetch('/api/ai/models');
            const data = await res.json();
            const models = data.success ? data.models : [];
            if(models.length === 0) models.push('gemma:2b', 'llama3.2:1b'); 

            [selectDiszi, selectZily].forEach(sel => {
                sel.innerHTML = '';
                models.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m;
                    opt.textContent = m;
                    sel.appendChild(opt);
                });
            });
            selectDiszi.value = localStorage.getItem('ai_model_diszi') || 'gemma:2b';
            selectZily.value = localStorage.getItem('ai_model_zily') || 'gemma:2b';
        } catch (e) { console.error(e); }
    }

    saveSettings() {
        localStorage.setItem('ai_model_diszi', document.getElementById('selectModel_diszi').value);
        localStorage.setItem('ai_model_zily', document.getElementById('selectModel_zily').value);
        document.getElementById('aiSettingsModal').classList.add('hidden');
    }
    
    // Legacy welcome screen adapted
    renderWelcomeScreen(model, container) {
        const isDiszi = model === 'diszi';
        const name = isDiszi ? 'Diszi' : 'Zily';
        const description = isDiszi ? 'Your Analytical AI Assistant' : 'Your Creative AI Companion';
        const styleClass = isDiszi ? 'text-blue-400' : 'text-purple-400';
        const suggestionClass = isDiszi ? 'border-blue-500/30 hover:bg-blue-500/10' : 'border-purple-500/30 hover:bg-purple-500/10';

        const suggestions = isDiszi ? [
            "Analyze this code", "Explain OAuth", "Optimize algo", "SQL vs NoSQL"
        ] : [
            "Sci-fi story", "Creative caption", "App ideas", "Coding poem"
        ];

        let suggestionsHtml = suggestions.map(text => `
            <button onclick="window.aiManager.setInputAndFocus('${text}')" 
                class="suggestion-btn p-3 rounded-xl border ${suggestionClass} text-left transition-all group">
                <span class="text-gray-300 group-hover:text-white text-sm">${text}</span>
            </button>
        `).join('');

        container.innerHTML = `
            <div class="ai-welcome-screen flex flex-col items-center justify-center h-full p-8">
                <div class="text-center mb-8">
                    <h1 class="text-4xl font-bold text-white mb-2">${name}</h1>
                    <p class="${styleClass} text-lg font-medium">${description}</p>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">${suggestionsHtml}</div>
            </div>
        `;
    }
    
    setInputAndFocus(text) {
        if (this.input) {
            this.input.value = text;
            this.input.focus();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.aiManager = new AIChatManager();
});
