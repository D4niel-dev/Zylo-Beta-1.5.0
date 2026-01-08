
/**
 * qrcode.js - Handles QR Code display for user profiles
 */

let currentQRUsername = null;
let qrCodeInstance = null;

function showQRCode() {
    const username = document.getElementById('uvUsername')?.textContent;
    if (!username || username === 'N/A') return;

    currentQRUsername = username;
    const modal = document.getElementById('qrCodeModal');
    const container = document.getElementById('qrCodeContainer');
    const usernameEl = document.getElementById('qrCodeUsername');

    // Update username display
    usernameEl.textContent = `@${username}`;

    // Clear previous QR
    container.innerHTML = '';

    // Generate QR code with profile link
    const profileLink = `zylo://u/${username}`;

    try {
        if (typeof QRCode !== 'undefined') {
            qrCodeInstance = new QRCode(container, {
                text: profileLink,
                width: 192,
                height: 192,
                colorDark: '#1a1a2e',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.H
            });
        } else {
            throw new Error("QRCode library not loaded");
        }
    } catch (e) {
        // Fallback if library not loaded
        container.innerHTML = `
        <div class="w-48 h-48 flex items-center justify-center bg-gray-100 text-gray-500 text-center p-4 rounded">
          <div>
            <div class="text-2xl mb-2">🔗</div>
            <div class="text-sm">${profileLink}</div>
          </div>
        </div>
      `;
    }

    modal.classList.remove('hidden');
    feather.replace();
}

function closeQRModal() {
    const modal = document.getElementById('qrCodeModal');
    if (modal) modal.classList.add('hidden');
    qrCodeInstance = null;
}

function copyProfileLink() {
    if (!currentQRUsername) return;
    const link = `zylo://u/${currentQRUsername}`;

    navigator.clipboard.writeText(link).then(() => {
        // Show success feedback
        const btn = event.target.closest('button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i data-feather="check" class="w-4 h-4 inline mr-2"></i>Copied!';
        btn.classList.add('bg-green-600');
        btn.classList.remove('bg-discord-blurple');
        feather.replace();

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('bg-green-600');
            btn.classList.add('bg-discord-blurple');
            feather.replace();
        }, 2000);
    }).catch(() => {
        alert('Failed to copy link');
    });
}

// Close QR modal on click outside
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('qrCodeModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'qrCodeModal') closeQRModal();
    });
});
