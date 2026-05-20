const socket = io();

// UI Elements
const deniedScreen = document.getElementById('denied-screen');
const deniedMessage = document.getElementById('denied-message');
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const adminBadge = document.getElementById('admin-badge');
const adminControls = document.getElementById('admin-controls');
const adminGameControls = document.getElementById('admin-game-controls');
const joinBtn = document.getElementById('join-btn');
const playerNameInput = document.getElementById('player-name');
const playersList = document.getElementById('players-list');
const playerCount = document.getElementById('player-count');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const toastContainer = document.getElementById('toast-container');
const roleName = document.getElementById('role-name');
const roleDesc = document.getElementById('role-desc');

let isAdmin = false;

// --- SOCKET EVENTS ---

socket.on('access_denied', (message) => {
    deniedScreen.classList.remove('hidden');
    deniedMessage.textContent = message;
});

socket.on('admin_status', (status) => {
    isAdmin = status;
    if (isAdmin) {
        adminBadge.classList.remove('hidden');
        adminControls.classList.remove('hidden');
        adminGameControls.classList.remove('hidden');
    }
});

socket.on('system_message', (msg) => {
    showToast(msg.text, msg.type);
});

socket.on('state_update', (game) => {
    // Update players list
    playersList.innerHTML = '';
    playerCount.textContent = game.players.length;
    
    game.players.forEach(p => {
        const li = document.createElement('li');
        li.textContent = p.name;
        playersList.appendChild(li);
    });

    // Handle screen transitions based on game state
    if (game.status === 'lobby') {
        lobbyScreen.classList.remove('hidden');
        gameScreen.classList.add('hidden');
        // If we are in the players list, hide the join input
        const me = game.players.find(p => p.id === socket.id);
        if (me) {
            document.querySelector('.input-group').classList.add('hidden');
        } else {
            document.querySelector('.input-group').classList.remove('hidden');
        }
    } else if (game.status === 'playing') {
        lobbyScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
    }
});

socket.on('role_assigned', (role) => {
    roleName.textContent = role;
    roleName.className = `role-${role}`; // Apply specific color class
    
    if (role === 'Executive') {
        roleDesc.textContent = "Your goal: Pass 3 Corporate Initiatives successfully. Find the Whistleblowers.";
    } else {
        roleDesc.textContent = "Your goal: Sabotage 3 Corporate Initiatives without getting caught.";
    }
});

// --- EVENT LISTENERS ---

joinBtn.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    if (name.length < 2) {
        showToast('Name must be at least 2 characters.', 'error');
        return;
    }
    socket.emit('join_game', name);
});

startBtn.addEventListener('click', () => {
    socket.emit('start_game');
});

resetBtn.addEventListener('click', () => {
    socket.emit('reset_game');
});

// Helper for notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
