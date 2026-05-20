const socket = io();

// UI Elements
const deniedScreen = document.getElementById('denied-screen');
const deniedMessage = document.getElementById('denied-message');
const adminBadge = document.getElementById('admin-badge');

const adminLiveScreen = document.getElementById('admin-live-screen');
const loginScreen = document.getElementById('login-screen');
const quizScreen = document.getElementById('quiz-screen');

// Player Inputs
const joinGroupCode = document.getElementById('join-group-code');
const joinUsername = document.getElementById('join-username');
const joinPin = document.getElementById('join-pin');

// Quiz Elements
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const finishContainer = document.getElementById('finish-container');
const questionContainer = document.getElementById('question-container');

// Display Elements
const groupsContainer = document.getElementById('groups-container');
const votesList = document.getElementById('votes-list');

let isAdmin = false;
let currentQuestionIndex = 0;
let hrTargetName = "HR";
let myUsername = "";
let myGroupCode = "";
let myPin = "";

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
        q: "5. After analyzing the team dynamics, who should be immediately fired?",
        options: [] // dynamically populated based on DB group
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
        adminLiveScreen.classList.remove('hidden');
        loginScreen.classList.add('hidden');
        quizScreen.classList.add('hidden');
    } else {
        loginScreen.classList.remove('hidden');
    }
});

socket.on('system_message', (msg) => {
    showToast(msg.text, msg.type);
});

socket.on('dashboard_update', (data) => {
    if (!isAdmin) return;
    
    // Render Database Groups
    groupsContainer.innerHTML = '';
    data.groups.forEach(g => {
        const div = document.createElement('div');
        div.style.background = 'rgba(255,255,255,0.05)';
        div.style.padding = '1rem';
        div.style.borderRadius = '8px';
        div.style.flex = '1 1 200px';
        div.innerHTML = `
            <div style="font-size: 0.8rem; color: #94a3b8;">${g.group_name} Team</div>
            <div style="font-size: 1.5rem; font-weight: bold; color: var(--primary); margin: 5px 0;">${g.group_code}</div>
            <div style="font-size: 0.85rem;">Target: <span style="color: var(--danger); font-weight: bold;">${g.hr_name}</span></div>
        `;
        groupsContainer.appendChild(div);
    });

    // Render Database Votes
    votesList.innerHTML = '';
    if (data.votes.length === 0) {
        votesList.innerHTML = '<li style="color: #94a3b8; font-style: italic;">No victims have voted yet...</li>';
    } else {
        data.votes.forEach(v => {
            const li = document.createElement('li');
            li.innerHTML = `<strong>${v.username}</strong> <span style="color:#94a3b8; margin: 0 10px;">(Code: ${v.group_code})</span> voted at ${new Date(v.timestamp).toLocaleTimeString()}`;
            votesList.appendChild(li);
        });
    }
});

socket.on('join_success', (data) => {
    hrTargetName = data.hrName;
    questions[4].options = [hrTargetName, hrTargetName, hrTargetName, hrTargetName];
    
    loginScreen.classList.add('hidden');
    quizScreen.classList.remove('hidden');
    
    currentQuestionIndex = 0;
    finishContainer.classList.add('hidden');
    questionContainer.classList.remove('hidden');
    renderQuestion();
});

// --- EVENT LISTENERS ---

document.getElementById('join-btn').addEventListener('click', () => {
    const code = joinGroupCode.value.trim().toUpperCase();
    const user = joinUsername.value.trim();
    const pin = joinPin.value.trim();
    
    if (!code || !user || !pin) {
        return showToast('All fields are required for security verification.', 'error');
    }
    
    myGroupCode = code;
    myUsername = user;
    myPin = pin;
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
                
                // Save to database!
                socket.emit('quiz_finished', { groupCode: myGroupCode, username: myUsername, pin: myPin });
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
