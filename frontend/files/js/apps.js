
/**
 * apps.js - Logic for the internal "Apps" modal (Calculator, Calendar, etc.)
 */

var currentApp = null;

function openAppModal(appName) {
    currentApp = appName;
    const modal = document.getElementById('appsModal');
    const title = document.getElementById('appModalTitle');
    const content = document.getElementById('appModalContent');

    const apps = {
        menu: {
            title: '📱 Apps & Tools',
            render: () => `
        <div class="grid grid-cols-2 gap-3 p-2">
          <button onclick="openAppModal('calculator')" class="p-4 rounded-xl bg-discord-gray-700 hover:bg-discord-gray-600 transition text-center group">
            <div class="text-3xl mb-2">🧮</div>
            <div class="text-sm font-medium text-gray-300 group-hover:text-white">Calculator</div>
          </button>
          <button onclick="openAppModal('calendar')" class="p-4 rounded-xl bg-discord-gray-700 hover:bg-discord-gray-600 transition text-center group">
            <div class="text-3xl mb-2">📅</div>
            <div class="text-sm font-medium text-gray-300 group-hover:text-white">Calendar</div>
          </button>
          <button onclick="openAppModal('speedtest')" class="p-4 rounded-xl bg-discord-gray-700 hover:bg-discord-gray-600 transition text-center group">
            <div class="text-3xl mb-2">⚡</div>
            <div class="text-sm font-medium text-gray-300 group-hover:text-white">Speed Test</div>
          </button>
          <button onclick="openAppModal('notes')" class="p-4 rounded-xl bg-discord-gray-700 hover:bg-discord-gray-600 transition text-center group">
            <div class="text-3xl mb-2">📝</div>
            <div class="text-sm font-medium text-gray-300 group-hover:text-white">Notes</div>
          </button>
          <button onclick="openAppModal('timer')" class="p-4 rounded-xl bg-discord-gray-700 hover:bg-discord-gray-600 transition text-center group">
            <div class="text-3xl mb-2">⏱️</div>
            <div class="text-sm font-medium text-gray-300 group-hover:text-white">Timer</div>
          </button>
          <button onclick="openAppModal('colorpicker')" class="p-4 rounded-xl bg-discord-gray-700 hover:bg-discord-gray-600 transition text-center group">
            <div class="text-3xl mb-2">🎨</div>
            <div class="text-sm font-medium text-gray-300 group-hover:text-white">Colors</div>
          </button>
        </div>
      `
        },
        calculator: {
            title: '🧮 Calculator',
            render: () => `
        <div class="bg-discord-gray-700 p-4 rounded-lg">
          <input type="text" id="calcDisplay" class="w-full bg-discord-gray-900 text-white text-2xl text-right p-3 rounded mb-3" readonly value="0">
          <div class="grid grid-cols-4 gap-2">
            ${['7', '8', '9', '/', '4', '5', '6', '*', '1', '2', '3', '-', 'C', '0', '=', '+'].map(b =>
                `<button onclick="calcPress('${b}')" class="p-3 rounded ${b.match(/[0-9.]/) ? 'bg-discord-gray-600' : 'bg-discord-blurple'} hover:opacity-80 text-white font-bold">${b}</button>`
            ).join('')}
          </div>
        </div>
      `
        },
        calendar: {
            title: '📅 Calendar',
            render: () => {
                const now = new Date();
                const month = now.toLocaleString('default', { month: 'long' });
                const year = now.getFullYear();
                const today = now.getDate();
                const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).getDay();
                const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

                let days = '';
                for (let i = 0; i < firstDay; i++) days += '<div></div>';
                for (let d = 1; d <= daysInMonth; d++) {
                    const isToday = d === today ? 'bg-discord-blurple text-white' : 'bg-discord-gray-700 hover:bg-discord-gray-600';
                    days += `<div class="p-2 text-center rounded ${isToday} cursor-pointer">${d}</div>`;
                }

                return `
          <div class="text-center mb-4">
            <div class="text-xl font-bold text-white">${month} ${year}</div>
          </div>
          <div class="grid grid-cols-7 gap-1 text-xs text-center">
            <div class="text-discord-gray-400 font-bold">Sun</div>
            <div class="text-discord-gray-400 font-bold">Mon</div>
            <div class="text-discord-gray-400 font-bold">Tue</div>
            <div class="text-discord-gray-400 font-bold">Wed</div>
            <div class="text-discord-gray-400 font-bold">Thu</div>
            <div class="text-discord-gray-400 font-bold">Fri</div>
            <div class="text-discord-gray-400 font-bold">Sat</div>
            ${days}
          </div>
        `;
            }
        },
        speedtest: {
            title: '⚡ Speed Test',
            render: () => `
        <div class="text-center">
          <div id="speedResult" class="text-6xl font-bold text-white mb-2">--</div>
          <div class="text-discord-gray-400 mb-4">Mbps (Download)</div>
          <button onclick="runSpeedTest()" class="px-6 py-3 bg-discord-blurple hover:bg-opacity-80 text-white rounded-lg font-medium">
            Run Test
          </button>
          <p class="text-xs text-discord-gray-500 mt-4">Note: Simulated test for demo</p>
        </div>
      `
        },
        notes: {
            title: '📝 Quick Notes',
            render: () => `
        <textarea id="quickNotes" class="w-full h-48 bg-discord-gray-700 text-white p-3 rounded-lg resize-none" placeholder="Type your notes here...">${localStorage.getItem('quickNotes') || ''}</textarea>
        <button onclick="saveNotes()" class="mt-2 w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">Save Notes</button>
      `
        },
        timer: {
            title: '⏱️ Timer',
            render: () => `
        <div class="text-center">
          <div id="timerDisplay" class="text-6xl font-mono font-bold text-white mb-4">00:00</div>
          <div class="flex gap-2 justify-center mb-4">
            <input type="number" id="timerMinutes" class="w-20 bg-discord-gray-700 text-white p-2 rounded text-center" placeholder="Min" value="5">
            <span class="text-2xl text-white">:</span>
            <input type="number" id="timerSeconds" class="w-20 bg-discord-gray-700 text-white p-2 rounded text-center" placeholder="Sec" value="00">
          </div>
          <div class="flex gap-2 justify-center">
            <button onclick="startTimer()" class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg">Start</button>
            <button onclick="stopTimer()" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg">Stop</button>
            <button onclick="resetTimer()" class="px-4 py-2 bg-discord-gray-600 hover:bg-discord-gray-500 text-white rounded-lg">Reset</button>
          </div>
        </div>
      `
        },
        colorpicker: {
            title: '🎨 Color Picker',
            render: () => `
        <div class="space-y-4">
          <div id="colorPreview" class="w-full h-24 rounded-lg bg-discord-blurple border-2 border-discord-gray-600"></div>
          <input type="color" id="colorInput" class="w-full h-12 rounded cursor-pointer" value="#5865f2" onchange="updateColorPreview()">
          <input type="text" id="colorHex" class="w-full bg-discord-gray-700 text-white p-2 rounded text-center font-mono" value="#5865f2" onchange="updateFromHex()">
          <button onclick="copyColor()" class="w-full py-2 bg-discord-blurple hover:bg-opacity-80 text-white rounded-lg">Copy Hex Code</button>
        </div>
      `
        }
    };

    const app = apps[appName];
    if (!app) return;

    title.textContent = app.title;
    content.innerHTML = app.render();
    modal.classList.remove('hidden');
    feather.replace();
}

function closeAppModal() {
    document.getElementById('appsModal').classList.add('hidden');
    currentApp = null;
}

// Calculator functions
var calcValue = '0';
function calcPress(btn) {
    const display = document.getElementById('calcDisplay');
    if (btn === 'C') {
        calcValue = '0';
    } else if (btn === '=') {
        try { calcValue = String(eval(calcValue)); } catch { calcValue = 'Error'; }
    } else {
        if (calcValue === '0' && !btn.match(/[+\-*/]/)) calcValue = btn;
        else calcValue += btn;
    }
    display.value = calcValue;
}

// Speed test (simulated)
function runSpeedTest() {
    const result = document.getElementById('speedResult');
    result.textContent = '...';
    let i = 0;
    const interval = setInterval(() => {
        result.textContent = Math.floor(Math.random() * 100 + 50);
        i++;
        if (i > 20) {
            clearInterval(interval);
            result.textContent = Math.floor(Math.random() * 50 + 75);
        }
    }, 100);
}

// Notes functions
function saveNotes() {
    const notes = document.getElementById('quickNotes').value;
    localStorage.setItem('quickNotes', notes);
    alert('Notes saved!');
}

// Timer functions
var timerInterval = null;
var timerRemaining = 0;
function startTimer() {
    if (timerInterval) return;
    const mins = parseInt(document.getElementById('timerMinutes').value) || 0;
    const secs = parseInt(document.getElementById('timerSeconds').value) || 0;
    timerRemaining = mins * 60 + secs;
    timerInterval = setInterval(tickTimer, 1000);
}
function tickTimer() {
    if (timerRemaining <= 0) {
        stopTimer();
        alert('Timer finished!');
        return;
    }
    timerRemaining--;
    const m = String(Math.floor(timerRemaining / 60)).padStart(2, '0');
    const s = String(timerRemaining % 60).padStart(2, '0');
    document.getElementById('timerDisplay').textContent = `${m}:${s}`;
}
function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
}
function resetTimer() {
    stopTimer();
    document.getElementById('timerDisplay').textContent = '00:00';
    timerRemaining = 0;
}

// Color picker functions
function updateColorPreview() {
    const color = document.getElementById('colorInput').value;
    document.getElementById('colorPreview').style.backgroundColor = color;
    document.getElementById('colorHex').value = color;
}
function updateFromHex() {
    const hex = document.getElementById('colorHex').value;
    document.getElementById('colorInput').value = hex;
    document.getElementById('colorPreview').style.backgroundColor = hex;
}
function copyColor() {
    const hex = document.getElementById('colorHex').value;
    navigator.clipboard.writeText(hex).then(() => alert('Copied: ' + hex));
}

// Close app modal on click outside
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('appsModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'appsModal') closeAppModal();
    });
});
