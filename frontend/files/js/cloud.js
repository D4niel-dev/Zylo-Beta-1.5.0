
/**
 * cloud.js - Logic for Zylo Cloud file storage
 */

async function loadCloudFiles() {
    const username = localStorage.getItem('username');
    if (!username) return;

    const container = document.getElementById('filesListContainer');
    if (!container) return; // Guard
    container.innerHTML = '<div class="col-span-full text-center py-8"><div class="animate-spin w-8 h-8 border-2 border-discord-blurple border-t-transparent rounded-full mx-auto"></div></div>';

    try {
        const res = await fetch(`/api/cloud/files?username=${encodeURIComponent(username)}`);
        const data = await res.json();

        if (data.success && data.files.length > 0) {
            container.innerHTML = data.files.map(file => {
                let previewHtml = '';
                // Backend stores 'url', frontend upload flow might have 'fileData' temporarily but we check url first
                const imgSrc = file.url || file.fileData;

                if (file.fileType.startsWith('image/') && imgSrc) {
                    previewHtml = `<img src="${imgSrc}" class="w-10 h-10 rounded object-cover border border-discord-gray-600 bg-black">`;
                } else {
                    previewHtml = `<div class="w-10 h-10 rounded bg-discord-gray-700 flex items-center justify-center text-2xl">${getFileIcon(file.fileType)}</div>`;
                }

                return `
            <div class="bg-discord-gray-800 p-3 rounded-lg flex items-center gap-3 group hover:bg-discord-gray-700 transition relative">
              ${previewHtml}
              <div class="overflow-hidden flex-1">
                <h4 class="text-sm font-medium text-white truncate" title="${file.fileName}">${file.fileName}</h4>
                <p class="text-xs text-discord-gray-400">${new Date(file.createdAt * 1000).toLocaleDateString()}</p>
              </div>
               <button onclick="deleteCloudFile('${file.id}')" class="p-2 text-red-400 opacity-0 group-hover:opacity-100 transition hover:bg-discord-gray-600 rounded">
                <i data-feather="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          `}).join('');
            if (window.feather) feather.replace();
        } else {
            container.innerHTML = `
            <div class="col-span-full py-12 text-center text-discord-gray-500">
              <i data-feather="folder" class="w-12 h-12 mx-auto mb-3 opacity-20"></i>
              <p>No files yet. Upload your first file!</p>
            </div>
          `;
            if (window.feather) feather.replace();
        }
    } catch (err) {
        console.error('Failed to load files:', err);
        container.innerHTML = '<p class="text-red-500 text-center col-span-full">Failed to load files.</p>';
    }
}

function getFileIcon(type) {
    if (!type) return '❓';
    if (type.startsWith('image/')) return '🖼️';
    if (type.startsWith('video/')) return '🎥';
    if (type.startsWith('audio/')) return '🎵';
    if (type.includes('pdf')) return '📄';
    if (type.includes('zip') || type.includes('compressed')) return '📦';
    return '📁';
}

async function uploadCloudFile(files) {
    if (!files || files.length === 0) return;

    const username = localStorage.getItem('username');
    if (!username) return alert("Please log in first.");

    const progress = document.getElementById('cloudUploadProgress');
    if (progress) progress.classList.remove('hidden');

    for (let file of files) {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                await fetch('/api/cloud/upload', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username,
                        fileName: file.name,
                        fileType: file.type,
                        fileData: e.target.result
                    })
                });
                loadCloudFiles(); // Refresh list
            } catch (err) {
                console.error('Upload failed:', err);
                alert('Failed to upload ' + file.name);
            }
        };
        reader.readAsDataURL(file);
    }

    if (progress) setTimeout(() => progress.classList.add('hidden'), 2000);
}

async function deleteCloudFile(fileId) {
    if (!confirm("Delete this file?")) return;
    const username = localStorage.getItem('username');
    try {
        const res = await fetch('/api/cloud/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, fileId })
        });
        const data = await res.json();
        if (data.success) {
            loadCloudFiles();
        } else {
            alert("Delete failed: " + data.error);
        }
    } catch (err) {
        alert("Delete failed");
    }
}

// Initialize logic
document.addEventListener('DOMContentLoaded', () => {
    // Add drag-drop listeners
    const dropZone = document.getElementById('cloudUploadArea');
    if (dropZone) {
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('border-discord-blurple');
        });
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-discord-blurple');
        });
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('border-discord-blurple');
            uploadCloudFile(e.dataTransfer.files);
        });
    }

    // Helper for legacy calls
    window.refreshFilesList = loadCloudFiles;
});
