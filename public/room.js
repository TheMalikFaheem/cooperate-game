// room.js — Public anonymous message page
const socket = io();
const slug = window.location.pathname.split('/r/')[1];
let roomId = null;

const loadingState = document.getElementById('loading-state');
const notFoundState = document.getElementById('not-found-state');
const waitingState = document.getElementById('waiting-state');
const writeState = document.getElementById('write-state');
const formSection = document.getElementById('form-section');
const sentSection = document.getElementById('sent-section');

async function loadRoom() {
    const res = await fetch(`/api/r/${slug}`);
    if (!res.ok) {
        loadingState.classList.add('hidden');
        notFoundState.classList.remove('hidden');
        return;
    }
    const room = await res.json();
    roomId = room.id;

    loadingState.classList.add('hidden');

    if (!room.current_target) {
        document.getElementById('waiting-room-name').textContent = `${room.name}`;
        waitingState.classList.remove('hidden');
    } else {
        showWriteState(room.current_target);
    }

    // Join socket room for live target updates
    socket.emit('public_join_room', room.id);
}

function showWriteState(targetName) {
    waitingState.classList.add('hidden');
    writeState.classList.remove('hidden');
    sentSection.classList.add('hidden');
    formSection.classList.remove('hidden');

    document.getElementById('target-name-display').textContent = targetName;
    document.getElementById('target-avatar').textContent = targetName.charAt(0).toUpperCase();
    document.getElementById('message-input').value = '';
    document.getElementById('char-count').textContent = '0';
}

// Live update when admin changes target
socket.on('target_changed', ({ targetName }) => {
    if (!targetName) {
        writeState.classList.add('hidden');
        waitingState.classList.remove('hidden');
    } else {
        showWriteState(targetName);
    }
});

// Char counter
document.getElementById('message-input').addEventListener('input', () => {
    document.getElementById('char-count').textContent = document.getElementById('message-input').value.length;
});

// Send message
document.getElementById('send-btn').onclick = async () => {
    const message = document.getElementById('message-input').value.trim();
    if (!message) return showToast('Write something first!', 'error');

    const res = await fetch(`/api/r/${slug}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    });
    const data = await res.json();

    if (data.success) {
        formSection.classList.add('hidden');
        sentSection.classList.remove('hidden');
    } else {
        showToast(data.error || 'Failed to send', 'error');
    }
};

// Send another
document.getElementById('send-another-btn').onclick = () => {
    sentSection.classList.add('hidden');
    formSection.classList.remove('hidden');
    document.getElementById('message-input').value = '';
    document.getElementById('char-count').textContent = '0';
};

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

loadRoom();
