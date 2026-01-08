
// Settings & 2FA Logic

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initSettingsModules, 1000); // Delay slightly to ensure mainapp.html DOM is ready
});

function initSettingsModules() {
    console.log("Initializing Settings Module...");
    const twoFactorToggle = document.getElementById('twoFactorToggle');
    if (twoFactorToggle) {
        check2FAStatus();
        twoFactorToggle.addEventListener('change', handle2FAToggle);
    }
}

async function check2FAStatus() {
    const username = localStorage.getItem('username');
    if (!username) return;

    try {
        const res = await fetch(`/api/get-user?identifier=${encodeURIComponent(username)}`);
        const data = await res.json();
        const toggle = document.getElementById('twoFactorToggle');
        if (toggle) {
            if (data.success && data.user.twofa_enabled) {
                toggle.checked = true;
            } else {
                toggle.checked = false;
            }
        }
    } catch (e) {
        console.error("Failed to check 2FA status", e);
    }
}

async function handle2FAToggle(e) {
    const isEnabled = e.target.checked;
    const username = localStorage.getItem('username');
    if (!username) return;

    if (isEnabled) {
        // Enable 2FA
        try {
            const res = await fetch('/api/auth/2fa/enable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const data = await res.json();
            if (data.success) {
                show2FAModal(data.secret);
            } else {
                if (window.showToast) window.showToast(data.error || "Failed to enable 2FA", 3000, true);
                else alert(data.error);
                e.target.checked = false;
            }
        } catch (err) {
            if (window.showToast) window.showToast("Network error", 3000, true);
            e.target.checked = false;
        }
    } else {
        // Disable 2FA
        if (!confirm("Are you sure you want to disable 2FA? Your account will be less secure.")) {
            e.target.checked = true;
            return;
        }
        try {
            const res = await fetch('/api/auth/2fa/disable', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            const data = await res.json();
            if (data.success) {
                if (window.showToast) window.showToast("2FA Disabled");
            } else {
                if (window.showToast) window.showToast(data.error || "Failed to disable 2FA", 3000, true);
                e.target.checked = true;
            }
        } catch (err) {
            if (window.showToast) window.showToast("Network error", 3000, true);
            e.target.checked = true;
        }
    }
}

function show2FAModal(secret) {
    // Remove existing if any
    const existing = document.getElementById('twoFaSetupModal');
    if (existing) existing.remove();

    const modalHtml = `
    <div id="twoFaSetupModal" class="fixed inset-0 bg-black bg-opacity-60 backdrop-blur-sm z-50 flex items-center justify-center px-4 animate-fadeIn">
        <div class="bg-discord-gray-800 max-w-md w-full p-6 rounded-lg shadow-xl border border-discord-gray-700">
            <div class="text-center mb-6">
                <div class="w-16 h-16 bg-discord-blurple/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-discord-blurple"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                </div>
                <h3 class="text-xl font-bold text-white mb-2">Two-Factor Authentication</h3>
                <p class="text-discord-gray-400 text-sm">Scan the QR code or enter the secret key into your authenticator app.</p>
            </div>

            <div class="bg-discord-gray-900 p-4 rounded-lg mb-6 text-center border border-discord-gray-700">
                <p class="text-xs text-discord-gray-500 uppercase font-bold tracking-wider mb-2">Secret Key</p>
                <code class="text-lg text-discord-blurple font-mono tracking-widest select-all cursor-pointer hover:text-white transition" onclick="navigator.clipboard.writeText(this.innerText); if(window.showToast) window.showToast('Copied!')">${secret}</code>
                <p class="text-xs text-discord-gray-600 mt-2">(Use '123456' to test verification)</p>
            </div>

            <div class="bg-yellow-500/10 border border-yellow-500/20 rounded p-3 mb-6 flex gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-yellow-500 flex-shrink-0"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <p class="text-xs text-yellow-200">Save this key! If you lose access to your authenticator app, you will need this key to restore access.</p>
            </div>

            <button onclick="close2FAModal()" class="w-full py-2 bg-discord-blurple hover:bg-opacity-90 text-white font-medium rounded-lg transition shadow-lg transform active:scale-95">
                I've Saved It
            </button>
        </div>
    </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}


function close2FAModal() {
    const modal = document.getElementById('twoFaSetupModal');
    if (modal) {
        modal.remove(); 
    }
}



// --- Account Settings Logic ---
var pendingAvatar = null;
var pendingBanner = null;
var pendingUsertag = null;
var accountSettingsChanged = false;

// Prompt functions for edit buttons
function promptUsernameEdit() {
    alert("Changing username is not supported yet.");
}

function promptEmailEdit() {
    alert("Changing email is not supported yet.");
}

function promptUsertagEdit() {
    const current = document.getElementById('currentUsertag').innerText;
    const newVal = prompt("Enter new Usertag (e.g. @CoolUser):", current);
    if (newVal !== null && newVal !== current) {
        document.getElementById('currentUsertag').innerText = newVal;
        pendingUsertag = newVal;
        accountSettingsChanged = true;
        updateSaveButtonVisibility();
    }
}

function updateSaveButtonVisibility() {
    const btn = document.getElementById('saveSettingsBtn');
    if (btn) btn.style.display = accountSettingsChanged ? 'block' : 'none';
}

function showSaveSettingsModal() {
    // Just save directly for now
    persistAccountSettings();
    accountSettingsChanged = false;
    updateSaveButtonVisibility();
}

// Avatar/Banner Upload Listeners
document.addEventListener('DOMContentLoaded', () => {
    const avatarInput = document.getElementById('settingsAvatarUpload');
    const bannerInput = document.getElementById('settingsBannerUpload');

    if (avatarInput) {
        avatarInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (evt) {
                const img = document.getElementById('settingsAvatar');
                if (img) img.src = evt.target.result;
                pendingAvatar = evt.target.result; // Data URL
                accountSettingsChanged = true;
                updateSaveButtonVisibility();
            };
            reader.readAsDataURL(file);
        });
    }

    if (bannerInput) {
        bannerInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function (evt) {
                const img = document.getElementById('settingsBanner');
                if (img) img.src = evt.target.result;
                pendingBanner = evt.target.result; // Data URL
                accountSettingsChanged = true;
                updateSaveButtonVisibility();
            };
            reader.readAsDataURL(file);
        });
    }
});

// Helper to persist account settings
async function persistAccountSettings() {
    const username = localStorage.getItem('username');
    if (!username) return;

    const payload = {
        username: username,
    };

    let hasChanges = false;

    if (pendingAvatar) {
        payload.avatar = pendingAvatar;
        hasChanges = true;
    }
    if (pendingBanner) {
        payload.banner = pendingBanner;
        hasChanges = true;
    }
    if (pendingUsertag) {
        payload.usertag = pendingUsertag;
        hasChanges = true;
    }

    if (!hasChanges) {
        if (window.showToast) window.showToast("No changes to save.");
        return;
    }

    try {
        const res = await fetch('/api/update-profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
            // Update local storage if needed
            if (data.user.avatar) localStorage.setItem('avatar', data.user.avatar);
            if (data.user.banner) localStorage.setItem('banner', data.user.banner);
            if (data.user.usertag) localStorage.setItem('usertag', data.user.usertag);

            // Clear pending
            pendingAvatar = null;
            pendingBanner = null;
            pendingUsertag = null;

             if (window.showToast) window.showToast("Profile updated successfully!");

            // Refresh profile UI if function exists
            if (typeof loadUserProfile === 'function') loadUserProfile();
        } else {
            console.error("Failed to update profile:", data.error);
            if (window.showToast) window.showToast("Failed to update profile: " + data.error, 3000, true);
        }
    } catch (err) {
        console.error("Error saving profile:", err);
         if (window.showToast) window.showToast("Error saving profile settings.", 3000, true);
    }
}
window.persistAccountSettings = persistAccountSettings;
window.saveAccountSettings = persistAccountSettings;
