const socket = io();

// Elements
const adminModal = document.getElementById('admin-modal');
const openAdminModal = document.getElementById('open-admin-modal');
const modalCancel = document.getElementById('modal-cancel');
const modalSubmit = document.getElementById('modal-submit');
const modalUsername = document.getElementById('modal-username');
const modalPassword = document.getElementById('modal-password');

const adminView = document.getElementById('admin-view');
const publicView = document.getElementById('public-view');

// Admin elements
const adminNameInput = document.getElementById('admin-name-input');
const startRoundBtn = document.getElementById('start-round-btn');
const clearBtn = document.getElementById('clear-btn');
const messagesGrid = document.getElementById('messages-grid');
const emptyState = document.getElementById('empty-state');
const sidebarTarget = document.getElementById('sidebar-target');
const topbarTarget = document.getElementById('topbar-target');
const msgCount = document.getElementById('msg-count');

// Public elements
const publicTargetName = document.getElementById('public-target-name');
const targetAvatar = document.getElementById('target-avatar');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const writeSection = document.getElementById('write-section');
const sentSection = document.getElementById('sent-section');
const sendAnotherBtn = document.getElementById('send-another-btn');
const charCount = document.getElementById('char-count');

let isAdmin = false;

// =====================
// ADMIN MODAL
// =====================
openAdminModal.onclick = () => {
    modalUsername.value = '';
    modalPassword.value = '';
    adminModal.classList.remove('hidden');
    setTimeout(() => modalUsername.focus(), 100);
};

modalCancel.onclick = () => adminModal.classList.add('hidden');

adminModal.onclick = (e) => { if (e.target === adminModal) adminModal.classList.add('hidden'); };

modalSubmit.onclick = submitAdminLogin;
modalPassword.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAdminLogin(); });

function submitAdminLogin() {
    const username = modalUsername.value.trim();
    const password = modalPassword.value.trim();
    if (!username || !password) return showToast('Enter username and password', 'error');
    socket.emit('admin_login', { username, password });
}

// =====================
// SOCKET EVENTS
// =====================
socket.on('admin_auth', (success) => {
    if (success) {
        isAdmin = true;
        adminModal.classList.add('hidden');
        openAdminModal.textContent = '★ Admin';
        openAdminModal.style.background = '#1a1a1a';
        openAdminModal.style.color = 'white';
        openAdminModal.style.borderColor = '#1a1a1a';
        openAdminModal.onclick = null;

        publicView.classList.add('hidden');
        adminView.classList.remove('hidden');
        showToast('Welcome back, Admin!', 'success');
    } else {
        showToast('Invalid credentials', 'error');
        modalPassword.value = '';
        modalPassword.focus();
    }
});

socket.on('state_update', (data) => {
    const name = data.targetName || 'Waiting...';
    const waiting = name === 'Waiting...' || name === 'Waiting';

    // Update public view
    publicTargetName.textContent = name;
    targetAvatar.textContent = waiting ? '?' : name.charAt(0).toUpperCase();

    // Update admin view
    sidebarTarget.textContent = name;
    topbarTarget.textContent = name;
    msgCount.textContent = data.total || 0;

    // Render message cards (admin only)
    if (isAdmin) renderMessages(data.messages);
});

socket.on('submit_ok', () => {
    writeSection.classList.add('hidden');
    sentSection.classList.remove('hidden');
    messageInput.value = '';
    charCount.textContent = '0';
});

// =====================
// ADMIN ACTIONS
// =====================
startRoundBtn.onclick = () => {
    const name = adminNameInput.value.trim();
    if (!name) return showToast('Enter a name to start the round', 'error');
    socket.emit('new_round', name);
    adminNameInput.value = '';
    showToast(`Round started for ${name}!`, 'success');
};

clearBtn.onclick = () => {
    if (confirm('Clear all messages for the current round?')) {
        socket.emit('clear_messages');
        showToast('Messages cleared', 'success');
    }
};

adminNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') startRoundBtn.click();
});

// =====================
// PUBLIC ACTIONS
// =====================
messageInput.addEventListener('input', () => {
    const len = messageInput.value.length;
    charCount.textContent = len;
    if (len > 300) messageInput.value = messageInput.value.substring(0, 300);
});

sendBtn.onclick = () => {
    const text = messageInput.value.trim();
    if (!text) return showToast('Please write a message first!', 'error');
    socket.emit('submit_message', text);
};

sendAnotherBtn.onclick = () => {
    sentSection.classList.add('hidden');
    writeSection.classList.remove('hidden');
};

// =====================
// RENDER MESSAGES
// =====================
function renderMessages(messages) {
    // Remove all existing cards
    document.querySelectorAll('.message-card').forEach(el => el.remove());

    if (!messages || messages.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    emptyState.classList.add('hidden');

    messages.forEach(m => {
        const card = document.createElement('div');
        card.className = 'message-card';
        const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        card.innerHTML = `
            <p class="message-text">${escapeHtml(m.message)}</p>
            <div class="message-meta">
                <span class="anonymous-tag">Anonymous</span>
                <span>${time}</span>
            </div>
        `;
        messagesGrid.appendChild(card);
    });
}

function escapeHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// =====================
// TOAST
// =====================
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}
