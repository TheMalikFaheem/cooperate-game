const socket = io();

// UI Elements
const deniedScreen = document.getElementById('denied-screen');
const adminBadge = document.getElementById('admin-badge');
const adminScreen = document.getElementById('admin-screen');

const profilesScreen = document.getElementById('profiles-screen');
const profilesContainer = document.getElementById('profiles-container');
const btnShowAdd = document.getElementById('btn-show-add');

const pinScreen = document.getElementById('pin-screen');
const pinPrompt = document.getElementById('pin-prompt');
const loginPinInput = document.getElementById('login-pin');

const addUserScreen = document.getElementById('add-user-screen');
const newUsername = document.getElementById('new-username');
const newPin = document.getElementById('new-pin');

const reviewScreen = document.getElementById('review-screen');
const reviewTargetName = document.getElementById('review-target-name');
const reviewText = document.getElementById('review-text');
const submitReviewBtn = document.getElementById('submit-review-btn');

const waitingScreen = document.getElementById('waiting-screen');

let isAdmin = false;
let myUsername = "";
let selectedProfile = "";
let currentTarget = "";

// --- SOCKET EVENTS ---
socket.on('access_denied', (msg) => {
    deniedScreen.classList.remove('hidden');
    document.getElementById('denied-message').textContent = msg;
});

socket.on('admin_status', (status) => {
    isAdmin = status;
    if (isAdmin) {
        adminBadge.classList.remove('hidden');
        adminScreen.classList.remove('hidden');
    }
});

socket.on('system_message', (msg) => showToast(msg.text, msg.type));

socket.on('state_update', (data) => {
    // Admin specific updates
    if (isAdmin) {
        document.getElementById('admin-current-target').textContent = data.targetName;
        const msgList = document.getElementById('admin-messages-list');
        msgList.innerHTML = '';
        if (data.messages.length === 0) {
            msgList.innerHTML = '<li style="color: #94a3b8; font-style: italic; background: transparent;">No messages yet for this person...</li>';
        } else {
            data.messages.forEach(m => {
                const li = document.createElement('li');
                li.style.flexDirection = 'column';
                li.style.alignItems = 'flex-start';
                li.innerHTML = `<span style="color:#cbd5e1; font-size:1.2rem; margin-bottom: 0.5rem;">"${m.message}"</span> <strong style="font-size: 0.8rem; color: var(--primary);">— ${m.author}</strong>`;
                msgList.appendChild(li);
            });
        }
    }

    // Update profiles if user is not logged in yet
    if (myUsername === "") {
        profilesScreen.classList.remove('hidden');
        renderProfiles(data.users);
    } else {
        // If logged in but the Admin started a new round with a new target, refresh the state
        if (currentTarget !== data.targetName) {
            socket.emit('login_user', { username: myUsername, pin: window.mySecretPin });
        }
    }
});

socket.on('login_success', (data) => {
    myUsername = data.username;
    currentTarget = data.targetName;
    
    pinScreen.classList.add('hidden');
    addUserScreen.classList.add('hidden');
    profilesScreen.classList.add('hidden');
    adminScreen.classList.add('hidden');
    document.getElementById('main-header').classList.add('hidden');
    
    if (data.hasSubmittedForCurrentRound || currentTarget.includes("Waiting")) {
        reviewScreen.classList.add('hidden');
        waitingScreen.classList.remove('hidden');
        
        if (currentTarget.includes("Waiting")) {
            waitingScreen.innerHTML = `<h2>Please Wait...</h2><p style="color:#94a3b8; margin-top:1rem;">The admin is selecting the next person to review.</p>`;
        } else {
            waitingScreen.innerHTML = `<h2>Message Sent! ✅</h2><p style="color:#94a3b8; margin-top:1rem;">Waiting for everyone else to finish reviewing <strong>${currentTarget}</strong>...</p>`;
        }
    } else {
        waitingScreen.classList.add('hidden');
        reviewScreen.classList.remove('hidden');
        reviewTargetName.textContent = currentTarget;
        reviewText.value = ''; // clear previous
    }
});

socket.on('submission_success', () => {
    reviewScreen.classList.add('hidden');
    waitingScreen.classList.remove('hidden');
    waitingScreen.innerHTML = `<h2>Message Sent! ✅</h2><p style="color:#94a3b8; margin-top:1rem;">Waiting for everyone else to finish reviewing <strong>${currentTarget}</strong>...</p>`;
});

// --- RENDER PROFILES ---
function renderProfiles(users) {
    document.querySelectorAll('.profile-card:not(.add-profile)').forEach(el => el.remove());
    
    users.forEach(user => {
        const card = document.createElement('div');
        card.className = `profile-card`;
        
        const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
        const color = colors[user.username.length % colors.length];

        card.innerHTML = `
            <div class="avatar" style="background: ${color}">${user.username.charAt(0).toUpperCase()}</div>
            <div class="name">${user.username}</div>
        `;
        
        card.onclick = () => {
            selectedProfile = user.username;
            pinPrompt.textContent = `Enter PIN for ${user.username}`;
            loginPinInput.value = '';
            pinScreen.classList.remove('hidden');
        };
        
        profilesContainer.insertBefore(card, btnShowAdd);
    });
}

// --- BUTTON LISTENERS ---
btnShowAdd.onclick = () => {
    newUsername.value = '';
    newPin.value = '';
    addUserScreen.classList.remove('hidden');
};

document.getElementById('add-cancel-btn').onclick = () => addUserScreen.classList.add('hidden');
document.getElementById('pin-cancel-btn').onclick = () => pinScreen.classList.add('hidden');

document.getElementById('add-submit-btn').onclick = () => {
    const user = newUsername.value.trim();
    const pin = newPin.value.trim();
    if (!user || !pin) return showToast('Name and PIN are required!', 'error');
    window.mySecretPin = pin; // save to auto-login on new rounds
    socket.emit('create_user', { username: user, pin: pin });
};

document.getElementById('pin-submit-btn').onclick = () => {
    const pin = loginPinInput.value.trim();
    if (!pin) return showToast('Please enter your PIN', 'error');
    window.mySecretPin = pin;
    socket.emit('login_user', { username: selectedProfile, pin: pin });
};

submitReviewBtn.onclick = () => {
    const text = reviewText.value.trim();
    if(!text) return showToast('You must write something!', 'error');
    socket.emit('submit_message', { username: myUsername, message: text });
};

// Admin config
document.getElementById('admin-start-btn').onclick = () => {
    const target = document.getElementById('admin-target-input').value.trim();
    if(target) socket.emit('new_round', target);
};
document.getElementById('admin-reset-btn').onclick = () => {
    if(confirm('Wipe everything? All users and messages will be lost.')) socket.emit('reset_all_users');
};

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
