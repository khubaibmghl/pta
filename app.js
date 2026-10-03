// State & Storage
let gatewayIp = localStorage.getItem('gatewayIp') || '192.168.23.1';
let gatewayPort = localStorage.getItem('gatewayPort') || '8080';
let contacts = JSON.parse(localStorage.getItem('contacts')) || [
    { id: 1, name: 'Home Gateway', phone: '+1234567890', favorite: true },
    { id: 2, name: 'Emergency Support', phone: '1122', favorite: false }
];
let recents = JSON.parse(localStorage.getItem('recents')) || [];

let callTimer = null;
let secondsActive = 0;
let currentCallState = 0; // 0 = IDLE, 1 = RINGING, 2 = OFFHOOK

// DOM Elements
const currentTimeEl = document.getElementById('currentTime');
const islandIndicator = document.getElementById('islandIndicator');
const bannerDot = document.getElementById('bannerDot');
const bannerText = document.getElementById('bannerText');
const retryConnectionBtn = document.getElementById('retryConnectionBtn');
const phoneNumberInput = document.getElementById('phoneNumberInput');
const backspaceBtn = document.getElementById('backspaceBtn');
const dialCallBtn = document.getElementById('dialCallBtn');

// Tabs & Navigation
const tabItems = document.querySelectorAll('.tab-item');
const tabViews = document.querySelectorAll('.tab-view');

// In-Call Overlay Elements
const incallOverlay = document.getElementById('incallOverlay');
const incallStatusSub = document.getElementById('incallStatusSub');
const incallCallerName = document.getElementById('incallCallerName');
const incallCallerNumber = document.getElementById('incallCallerNumber');
const incallAvatarInitials = document.getElementById('incallAvatarInitials');
const incallTimerClock = document.getElementById('incallTimerClock');
const hardHangupBtn = document.getElementById('hardHangupBtn');

// Contacts & Recents Elements
const contactsList = document.getElementById('contactsList');
const recentsList = document.getElementById('recentsList');
const favoritesGrid = document.getElementById('favoritesGrid');
const contactSearchInput = document.getElementById('contactSearchInput');
const addContactBtn = document.getElementById('addContactBtn');
const contactModal = document.getElementById('contactModal');
const cancelContactBtn = document.getElementById('cancelContactBtn');
const saveContactBtn = document.getElementById('saveContactBtn');
const newContactName = document.getElementById('newContactName');
const newContactPhone = document.getElementById('newContactPhone');

// Settings Elements
const gatewayIpInput = document.getElementById('gatewayIpInput');
const gatewayPortInput = document.getElementById('gatewayPortInput');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const settingsStatusPill = document.getElementById('settingsStatusPill');

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    updateClock();
    setInterval(updateClock, 1000);
    setupNavigation();
    setupKeypad();
    setupModals();
    renderContacts();
    renderRecents();
    renderFavorites();
    startPolling();
});

function updateClock() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    currentTimeEl.textContent = `${hours}:${minutes}`;
}

// Tab Switching
function setupNavigation() {
    tabItems.forEach(item => {
        item.addEventListener('click', () => {
            const targetTab = item.getAttribute('data-tab');
            tabItems.forEach(t => t.classList.remove('active'));
            tabViews.forEach(v => v.classList.add('hidden'));

            item.classList.add('active');
            document.getElementById(targetTab).classList.remove('hidden');
        });
    });
}

// Keypad Event Handlers
function setupKeypad() {
    document.querySelectorAll('.key-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const key = btn.getAttribute('data-key');
            phoneNumberInput.value += key;
        });
    });

    backspaceBtn.addEventListener('click', () => {
        phoneNumberInput.value = phoneNumberInput.value.slice(0, -1);
    });

    dialCallBtn.addEventListener('click', () => {
        const number = phoneNumberInput.value.trim();
        if (number) {
            triggerOutgoingCall(number);
        }
    });

    hardHangupBtn.addEventListener('click', triggerHardHangup);
    retryConnectionBtn.addEventListener('click', pollGateway);
}

// Contacts & Recents Rendering
function renderContacts() {
    contactsList.innerHTML = '';
    const query = contactSearchInput.value.toLowerCase();
    const filtered = contacts.filter(c => c.name.toLowerCase().includes(query) || c.phone.includes(query));

    filtered.forEach(contact => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-left">
                <div class="item-avatar">${contact.name.charAt(0).toUpperCase()}</div>
                <div class="item-info">
                    <span class="item-title">${contact.name}</span>
                    <span class="item-sub">${contact.phone}</span>
                </div>
            </div>
            <div class="item-right">
                <button class="call-btn-mini" onclick="triggerOutgoingCall('${contact.phone}')">📞</button>
            </div>
        `;
        contactsList.appendChild(item);
    });
}

contactSearchInput.addEventListener('input', renderContacts);

function renderFavorites() {
    favoritesGrid.innerHTML = '';
    const favs = contacts.filter(c => c.favorite);
    favs.forEach(contact => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-left">
                <div class="item-avatar">${contact.name.charAt(0).toUpperCase()}</div>
                <div class="item-info">
                    <span class="item-title">${contact.name}</span>
                    <span class="item-sub">Favorite</span>
                </div>
            </div>
            <div class="item-right">
                <button class="call-btn-mini" onclick="triggerOutgoingCall('${contact.phone}')">📞</button>
            </div>
        `;
        favoritesGrid.appendChild(item);
    });
}

function renderRecents() {
    recentsList.innerHTML = '';
    if (recents.length === 0) {
        recentsList.innerHTML = `<div style="text-align:center; padding: 20px; color: var(--ios-text-sub);">No Recent Calls</div>`;
        return;
    }

    recents.forEach(entry => {
        const item = document.createElement('div');
        item.className = 'list-item';
        item.innerHTML = `
            <div class="item-left">
                <div class="item-info">
                    <span class="item-title ${entry.type === 'missed' ? 'missed' : ''}">${entry.name || entry.number}</span>
                    <span class="item-sub">${entry.type.toUpperCase()} • ${entry.time}</span>
                </div>
            </div>
            <div class="item-right">
                <button class="call-btn-mini" onclick="triggerOutgoingCall('${entry.number}')">📞</button>
            </div>
        `;
        recentsList.appendChild(item);
    });
}

function addRecentCall(number, type) {
    const matched = contacts.find(c => c.phone === number);
    const now = new Date();
    const timeStr = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;
    recents.unshift({
        number: number,
        name: matched ? matched.name : number,
        type: type, // 'outgoing', 'incoming', 'missed'
        time: timeStr
    });
    if (recents.length > 30) recents.pop();
    localStorage.setItem('recents', JSON.stringify(recents));
    renderRecents();
}

// Modal Handlers
function setupModals() {
    addContactBtn.addEventListener('click', () => contactModal.classList.remove('hidden'));
    cancelContactBtn.addEventListener('click', () => contactModal.classList.add('hidden'));
    saveContactBtn.addEventListener('click', () => {
        const name = newContactName.value.trim();
        const phone = newContactPhone.value.trim();
        if (name && phone) {
            contacts.push({ id: Date.now(), name: name, phone: phone, favorite: false });
            localStorage.setItem('contacts', JSON.stringify(contacts));
            renderContacts();
            newContactName.value = '';
            newContactPhone.value = '';
            contactModal.classList.add('hidden');
        }
    });

    saveSettingsBtn.addEventListener('click', () => {
        gatewayIp = gatewayIpInput.value.trim();
        gatewayPort = gatewayPortInput.value.trim();
        localStorage.setItem('gatewayIp', gatewayIp);
        localStorage.setItem('gatewayPort', gatewayPort);
        pollGateway();
    });
}

// API Communication
async function getApiUrl(endpoint) {
    return `http://${gatewayIp}:${gatewayPort}/api/${endpoint}`;
}

async function triggerOutgoingCall(number) {
    try {
        const url = await getApiUrl('dial');
        const matched = contacts.find(c => c.phone === number);
        
        incallStatusSub.textContent = 'Initiating GSM Call...';
        incallCallerName.textContent = matched ? matched.name : number;
        incallCallerNumber.textContent = number;
        incallAvatarInitials.textContent = matched ? matched.name.charAt(0).toUpperCase() : '?';
        
        incallOverlay.classList.remove('hidden');
        addRecentCall(number, 'outgoing');

        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: number })
        });
    } catch (err) {
        console.error('Error initiating call:', err);
    }
}

async function triggerHardHangup() {
    try {
        hardHangupBtn.style.opacity = '0.5';
        const url = await getApiUrl('hangup');
        await fetch(url, { method: 'POST' });
    } catch (err) {
        console.error('Error triggering hard hangup:', err);
    } finally {
        hardHangupBtn.style.opacity = '1';
        resetCallState();
    }
}

// Polling Gateway
function startPolling() {
    pollGateway();
    setInterval(pollGateway, 1000);
}

async function pollGateway() {
    try {
        const url = await getApiUrl('status');
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            handleStateUpdate(data);
            setOnlineStatus(true);
        } else {
            setOnlineStatus(false);
        }
    } catch (err) {
        setOnlineStatus(false);
    }
}

function handleStateUpdate(data) {
    // data.call_state: 0 = IDLE, 1 = RINGING, 2 = OFFHOOK
    const newState = data.call_state;

    if (newState === 0 && currentCallState !== 0) {
        resetCallState();
    } else if (newState === 1 && currentCallState !== 1) {
        incallStatusSub.textContent = 'Incoming Call...';
        if (data.incoming_number) {
            const matched = contacts.find(c => c.phone === data.incoming_number);
            incallCallerName.textContent = matched ? matched.name : data.incoming_number;
            incallCallerNumber.textContent = data.incoming_number;
            incallAvatarInitials.textContent = matched ? matched.name.charAt(0).toUpperCase() : '?';
            addRecentCall(data.incoming_number, 'incoming');
        }
        incallOverlay.classList.remove('hidden');
    } else if (newState === 2 && currentCallState !== 2) {
        incallStatusSub.textContent = 'Call Connected';
        startAnswerTimer();
        incallOverlay.classList.remove('hidden');
    }

    currentCallState = newState;
}

function startAnswerTimer() {
    if (callTimer) clearInterval(callTimer);
    secondsActive = 0;
    updateTimerDisplay();
    callTimer = setInterval(() => {
        secondsActive++;
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const mins = String(Math.floor(secondsActive / 60)).padStart(2, '0');
    const secs = String(secondsActive % 60).padStart(2, '0');
    incallTimerClock.textContent = `${mins}:${secs}`;
}

function resetCallState() {
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
    }
    secondsActive = 0;
    currentCallState = 0;
    incallTimerClock.textContent = '00:00';
    incallOverlay.classList.add('hidden');
    islandIndicator.className = 'island-indicator';
}

function setOnlineStatus(isOnline) {
    if (isOnline) {
        bannerDot.className = 'pulse-dot online';
        bannerText.textContent = `Connected to Gateway (${gatewayIp}:${gatewayPort})`;
        settingsStatusPill.className = 'status-pill online';
        settingsStatusPill.textContent = 'Connected';
        islandIndicator.className = 'island-indicator active';
    } else {
        bannerDot.className = 'pulse-dot offline';
        bannerText.textContent = `Disconnected from Gateway (${gatewayIp}:${gatewayPort})`;
        settingsStatusPill.className = 'status-pill offline';
        settingsStatusPill.textContent = 'Disconnected';
        islandIndicator.className = 'island-indicator';
    }
}
