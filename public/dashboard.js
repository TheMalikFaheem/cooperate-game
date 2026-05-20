// dashboard.js — Admin Dashboard
const socket = io();
let activeRoomId = null;
let activeRoomSlug = null;

// Check auth
fetch('/api/me').then(r => r.json()).then(data => {
    if (!data.loggedIn) return window.location.href = '/';
    document.getElementById('header-name').textContent = data.name;
    loadRooms();
});

// Logout
document.getElementById('logout-btn').onclick = async () => {
    await fetch('/api/logout', { method: 'POST' });
    window.location.href = '/';
};

// ── ROOMS ──────────────────────────────────────────────────
async function loadRooms() {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    renderRoomsList(rooms);
    if (rooms.length > 0) selectRoom(rooms[0]);
}

function renderRoomsList(rooms) {
    const list = document.getElementById('rooms-list');
    const noRooms = document.getElementById('no-rooms');
    document.querySelectorAll('.room-list-item').forEach(el => el.remove());

    if (rooms.length === 0) {
        noRooms.classList.remove('hidden');
        return;
    }
    noRooms.classList.add('hidden');

    rooms.forEach(room => {
        const item = document.createElement('div');
        item.className = `room-list-item ${room.id === activeRoomId ? 'active' : ''}`;
        item.dataset.id = room.id;
        item.innerHTML = `
            <div class="room-item-name">${escHtml(room.name)}</div>
            <div class="room-item-meta">${room.msg_count || 0} msg${room.msg_count !== 1 ? 's' : ''} · ${room.current_target ? room.current_target : 'No target'}</div>
        `;
        item.onclick = () => selectRoom(room);
        list.appendChild(item);
    });
}

function selectRoom(room) {
    activeRoomId = room.id;
    activeRoomSlug = room.slug;

    // Update sidebar active state
    document.querySelectorAll('.room-list-item').forEach(el => {
        el.classList.toggle('active', parseInt(el.dataset.id) === room.id);
    });

    // Show room dashboard
    document.getElementById('no-room-selected').classList.add('hidden');
    document.getElementById('room-dashboard').classList.remove('hidden');

    // Populate room info
    document.getElementById('room-title').textContent = room.name;
    const link = `${window.location.origin}/r/${room.slug}`;
    document.getElementById('share-link-display').textContent = link;
    document.getElementById('current-target-name').textContent = room.current_target || 'No target set';

    // Clear messages grid
    document.querySelectorAll('.message-card').forEach(el => el.remove());
    document.getElementById('empty-state').classList.remove('hidden');

    // Join socket room for live updates
    socket.emit('admin_join_room', room.id);
}

// ── CREATE ROOM ────────────────────────────────────────────
const createRoomModal = document.getElementById('create-room-modal');
const openModal = () => {
    document.getElementById('room-name-input').value = '';
    createRoomModal.classList.remove('hidden');
    setTimeout(() => document.getElementById('room-name-input').focus(), 100);
};

document.getElementById('new-room-btn').onclick = openModal;
document.getElementById('create-first-room').onclick = openModal;
document.getElementById('cancel-room-modal').onclick = () => createRoomModal.classList.add('hidden');
createRoomModal.onclick = (e) => { if (e.target === createRoomModal) createRoomModal.classList.add('hidden'); };

document.getElementById('confirm-create-room').onclick = async () => {
    const name = document.getElementById('room-name-input').value.trim();
    if (!name) return showToast('Enter a room name', 'error');

    const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    });
    const room = await res.json();
    if (room.error) return showToast(room.error, 'error');

    createRoomModal.classList.add('hidden');
    showToast(`Room "${name}" created!`, 'success');
    loadRooms();
};

document.getElementById('room-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('confirm-create-room').click();
});

// ── DELETE ROOM ────────────────────────────────────────────
document.getElementById('delete-room-btn').onclick = async () => {
    if (!activeRoomId) return;
    if (!confirm('Delete this room and all its messages?')) return;

    await fetch(`/api/rooms/${activeRoomId}`, { method: 'DELETE' });
    activeRoomId = null;
    activeRoomSlug = null;
    document.getElementById('room-dashboard').classList.add('hidden');
    document.getElementById('no-room-selected').classList.remove('hidden');
    showToast('Room deleted', 'success');
    loadRooms();
};

// ── ROUND MANAGEMENT ──────────────────────────────────────
document.getElementById('start-round-btn').onclick = async () => {
    const target = document.getElementById('new-target-input').value.trim();
    if (!target) return showToast('Enter a person\'s name', 'error');
    if (!activeRoomId) return;

    await fetch(`/api/rooms/${activeRoomId}/target`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target })
    });

    document.getElementById('current-target-name').textContent = target;
    document.getElementById('new-target-input').value = '';
    document.getElementById('messages-sub').textContent = `About: ${target}`;
    document.querySelectorAll('.message-card').forEach(el => el.remove());
    document.getElementById('empty-state').classList.remove('hidden');
    showToast(`Round started for ${target}!`, 'success');
    loadRooms(); // refresh sidebar counts
};

document.getElementById('new-target-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('start-round-btn').click();
});

// ── CLEAR MESSAGES ─────────────────────────────────────────
document.getElementById('clear-btn').onclick = async () => {
    if (!activeRoomId) return;
    if (!confirm('Clear all messages for the current round?')) return;
    await fetch(`/api/rooms/${activeRoomId}/clear`, { method: 'POST' });
    document.querySelectorAll('.message-card').forEach(el => el.remove());
    document.getElementById('empty-state').classList.remove('hidden');
    showToast('Messages cleared', 'success');
    loadRooms();
};

// ── COPY LINK ──────────────────────────────────────────────
document.getElementById('copy-link-btn').onclick = () => {
    const link = document.getElementById('share-link-display').textContent;
    navigator.clipboard.writeText(link).then(() => showToast('Link copied!', 'success'));
};

// ── SOCKET EVENTS ──────────────────────────────────────────
socket.on('room_messages', ({ messages, targetName }) => {
    document.getElementById('current-target-name').textContent = targetName || 'No target set';
    document.getElementById('messages-sub').textContent = targetName ? `About: ${targetName}` : 'Waiting for messages...';
    document.querySelectorAll('.message-card').forEach(el => el.remove());

    if (!messages || messages.length === 0) {
        document.getElementById('empty-state').classList.remove('hidden');
    } else {
        document.getElementById('empty-state').classList.add('hidden');
        messages.forEach(addMessageCard);
    }
});

socket.on('new_message', (msg) => {
    document.getElementById('empty-state').classList.add('hidden');
    addMessageCard(msg, true); // true = prepend (newest first)
    loadRooms(); // update sidebar count
});

socket.on('messages_cleared', () => {
    document.querySelectorAll('.message-card').forEach(el => el.remove());
    document.getElementById('empty-state').classList.remove('hidden');
});

function addMessageCard(m, prepend = false) {
    // Don't add if it's for a different room
    const time = new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const card = document.createElement('div');
    card.className = 'message-card';
    card.innerHTML = `
        <p class="message-text">${escHtml(m.message)}</p>
        <div class="message-meta">
            <span class="anonymous-tag">Anonymous</span>
            <span>${time}</span>
        </div>
    `;
    const grid = document.getElementById('messages-grid');
    if (prepend) {
        grid.insertBefore(card, grid.firstChild);
    } else {
        grid.appendChild(card);
    }
}

function escHtml(t) {
    return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = '0.3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}
