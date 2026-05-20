const socket = io();

// UI Elements
const deniedScreen = document.getElementById('denied-screen');
const deniedMessage = document.getElementById('denied-message');
const adminBadge = document.getElementById('admin-badge');

const adminSetupScreen = document.getElementById('admin-setup-screen');
const adminLiveScreen = document.getElementById('admin-live-screen');
const loginScreen = document.getElementById('login-screen');
const quizScreen = document.getElementById('quiz-screen');

// Admin Inputs
const setupGroupCode = document.getElementById('setup-group-code');
const setupHrName = document.getElementById('setup-hr-name');

// Player Inputs
const joinGroupCode = document.getElementById('join-group-code');
const joinUsername = document.getElementById('join-username');
const joinPin = document.getElementById('join-pin');
const loginForm = document.getElementById('login-form');

// Quiz Elements
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const finishContainer = document.getElementById('finish-container');
const questionContainer = document.getElementById('question-container');

// Display Elements
const playersList = document.getElementById('players-list');
const playerCount = document.getElementById('player-count');
const displayCode = document.getElementById('display-code');

let isAdmin = false;
let currentQuestionIndex = 0;
let hrTargetName = "HR";
let myUsername = "";

// The fake corporate survey questions
const questions = [
    {
        q: "1. How would you rate our company's leadership?",
        options: ["Outstanding", "Excellent", "Flawless"]
    },
    {
        q: "2. What is your favorite part of the job?",
        options: ["The Synergy", "The Coffee", "Mandatory Meetings"]
    },
    {
        q: "3. How productive do you feel working here?",
        options: ["100%", "110%", "I am basically a machine"]
    },
    {
        q: "4. How much overtime are you willing to do without pay?",
        options: ["10 hours", "20 hours", "I live at the office now"]
    },
    {
        // The punchline question
        q: "5. After analyzing the team dynamics, who should be immediately fired?",
        options: [] // This will be dynamically populated with the HR person's name!
    }
];

// --- SOCKET EVENTS ---

socket.on('access_denied', (message) => {
    deniedScreen.classList.remove('hidden');
    deniedMessage.textContent = message;
});

socket.on('admin_status', (status) => {
    isAdmin = status;
    if (isAdmin) {
        adminBadge.classList.remove('hidden');
    }
});

socket.on('system_message', (msg) => {
    showToast(msg.text, msg.type);
});

socket.on('state_update', (game) => {
    if (isAdmin) {
        // ADMIN ROUTING
        if (game.status === 'setup') {
            adminSetupScreen.classList.remove('hidden');
            adminLiveScreen.classList.add('hidden');
            loginScreen.classList.add('hidden');
            quizScreen.classList.add('hidden');
        } else {
            adminSetupScreen.classList.add('hidden');
            adminLiveScreen.classList.remove('hidden');
            displayCode.textContent = game.groupCode;
            
            // Update live victim list
            playersList.innerHTML = '';
            playerCount.textContent = game.players.length;
            game.players.forEach(p => {
                const li = document.createElement('li');
                li.textContent = p.name;
                playersList.appendChild(li);
            });
        }
    } else {
        // PLAYER ROUTING
        if (game.status === 'setup') {
            loginScreen.classList.remove('hidden');
            // Hide the login form entirely and show a waiting message
            loginForm.classList.add('hidden');
            let waitingMsg = document.getElementById('waiting-msg');
            if(!waitingMsg) {
                waitingMsg = document.createElement('p');
                waitingMsg.id = 'waiting-msg';
                waitingMsg.style.color = 'var(--danger)';
                waitingMsg.textContent = "The mandatory survey is currently closed. Please wait.";
                loginScreen.appendChild(waitingMsg);
            } else {
                waitingMsg.classList.remove('hidden');
            }
        } else if (game.status === 'active' && quizScreen.classList.contains('hidden')) {
            // Survey is open, show login form
            loginScreen.classList.remove('hidden');
            loginForm.classList.remove('hidden');
            const waitingMsg = document.getElementById('waiting-msg');
            if(waitingMsg) waitingMsg.classList.add('hidden');
        }
    }
});

socket.on('join_success', (data) => {
    // Populate the punchline question options
    hrTargetName = data.hrName;
    questions[4].options = [hrTargetName, hrTargetName, hrTargetName, hrTargetName];
    
    // Switch to quiz UI
    loginScreen.classList.add('hidden');
    quizScreen.classList.remove('hidden');
    
    currentQuestionIndex = 0;
    finishContainer.classList.add('hidden');
    questionContainer.classList.remove('hidden');
    renderQuestion();
});

// --- EVENT LISTENERS ---

// Admin Start
document.getElementById('setup-btn').addEventListener('click', () => {
    const code = setupGroupCode.value.trim();
    const hr = setupHrName.value.trim();
    if (!code || !hr) return showToast('You must set a code and an HR name!', 'error');
    socket.emit('setup_prank', { groupCode: code, hrName: hr });
});

// Admin Reset
document.getElementById('reset-btn').addEventListener('click', () => {
    socket.emit('reset_game');
});

// Player Join
document.getElementById('join-btn').addEventListener('click', () => {
    const code = joinGroupCode.value.trim();
    const user = joinUsername.value.trim();
    const pin = joinPin.value.trim();
    
    if (!code || !user || !pin) {
        return showToast('All fields are required for security verification.', 'error');
    }
    
    myUsername = user;
    socket.emit('join_game', { groupCode: code, username: user, pin: pin });
});

// --- QUIZ LOGIC ---

function renderQuestion() {
    optionsContainer.innerHTML = '';
    const q = questions[currentQuestionIndex];
    questionText.textContent = q.q;
    
    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'btn-secondary mt-2';
        btn.textContent = opt;
        
        // Add prank styling for the final question
        if (currentQuestionIndex === 4) {
            btn.className = 'btn-danger mt-2';
            btn.style.fontSize = '1.2rem';
        }

        btn.onclick = () => {
            currentQuestionIndex++;
            if (currentQuestionIndex < questions.length) {
                renderQuestion();
            } else {
                // Quiz completed!
                questionContainer.classList.add('hidden');
                finishContainer.classList.remove('hidden');
                socket.emit('quiz_finished', { username: myUsername });
            }
        };
        optionsContainer.appendChild(btn);
    });
}

// Helper for notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    // Special styling for the prank notification on admin screen
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
