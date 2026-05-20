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

const quizScreen = document.getElementById('quiz-screen');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const finishContainer = document.getElementById('finish-container');
const questionContainer = document.getElementById('question-container');

let isAdmin = false;
let myUsername = "";
let selectedProfile = "";
let hrTargetName = "HR";
let currentQuestionIndex = 0;

const questions = [
    { q: "1. How would you rate our company's leadership?", options: ["Outstanding", "Excellent", "Flawless"] },
    { q: "2. What is your favorite part of the job?", options: ["The Synergy", "The Coffee", "Mandatory Meetings"] },
    { q: "3. How productive do you feel working here?", options: ["100%", "110%", "I am basically a machine"] },
    { q: "4. How much overtime are you willing to do without pay?", options: ["10 hours", "20 hours", "I live at the office now"] },
    { q: "5. After analyzing the team dynamics, who should be immediately fired?", options: [] }
];

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
    // We only update profiles if we are on the profile screen (or admin)
    if (quizScreen.classList.contains('hidden') || isAdmin) {
        profilesScreen.classList.remove('hidden');
        renderProfiles(data.users);
    }
});

socket.on('login_success', (data) => {
    myUsername = data.username;
    hrTargetName = data.hrName;
    questions[4].options = [hrTargetName, hrTargetName, hrTargetName, hrTargetName];
    
    pinScreen.classList.add('hidden');
    addUserScreen.classList.add('hidden');
    profilesScreen.classList.add('hidden');
    adminScreen.classList.add('hidden');
    document.getElementById('main-header').classList.add('hidden');
    
    quizScreen.classList.remove('hidden');
    currentQuestionIndex = 0;
    finishContainer.classList.add('hidden');
    questionContainer.classList.remove('hidden');
    renderQuestion();
});

// --- RENDER PROFILES (NETFLIX STYLE) ---
function renderProfiles(users) {
    // Remove existing profiles (keep the "Add User" button)
    document.querySelectorAll('.profile-card:not(.add-profile)').forEach(el => el.remove());
    
    users.forEach(user => {
        const card = document.createElement('div');
        card.className = `profile-card ${user.has_voted ? 'voted' : ''}`;
        
        // Generate a random background color based on name length so avatars look different
        const colors = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'];
        const color = colors[user.username.length % colors.length];

        card.innerHTML = `
            <div class="avatar" style="background: ${color}">${user.username.charAt(0).toUpperCase()}</div>
            <div class="name">${user.username}</div>
            ${user.has_voted ? '<div style="font-size:0.7rem; color:#94a3b8; margin-top:5px;">Already Voted</div>' : ''}
        `;
        
        if (!user.has_voted) {
            card.onclick = () => {
                selectedProfile = user.username;
                pinPrompt.textContent = `Enter PIN for ${user.username}`;
                loginPinInput.value = '';
                pinScreen.classList.remove('hidden');
            };
        }
        
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
    socket.emit('create_user', { username: user, pin: pin });
};

document.getElementById('pin-submit-btn').onclick = () => {
    const pin = loginPinInput.value.trim();
    if (!pin) return showToast('Please enter your PIN', 'error');
    socket.emit('login_user', { username: selectedProfile, pin: pin });
};

// Admin config
document.getElementById('admin-save-btn').onclick = () => {
    const newHR = document.getElementById('admin-hr-input').value.trim();
    if(newHR) socket.emit('update_hr', newHR);
};
document.getElementById('admin-reset-btn').onclick = () => {
    if(confirm('Are you sure you want to delete all users and votes?')) socket.emit('reset_all');
};

// --- QUIZ LOGIC ---
function renderQuestion() {
    optionsContainer.innerHTML = '';
    const q = questions[currentQuestionIndex];
    questionText.textContent = q.q;
    
    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn-secondary mt-2';
        btn.textContent = opt;
        
        if (currentQuestionIndex === 4) {
            btn.className = 'btn-danger mt-2';
            btn.style.fontSize = '1.2rem';
        }

        btn.onclick = () => {
            currentQuestionIndex++;
            if (currentQuestionIndex < questions.length) {
                renderQuestion();
            } else {
                questionContainer.classList.add('hidden');
                finishContainer.classList.remove('hidden');
                socket.emit('quiz_finished', myUsername);
            }
        };
        optionsContainer.appendChild(btn);
    });
}

function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    if(message.includes("GOT 'EM")) {
        toast.style.background = 'var(--danger)';
        toast.style.fontSize = '1.1rem';
        toast.style.padding = '20px';
    }
    
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}
