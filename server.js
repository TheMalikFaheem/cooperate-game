const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
// Trust proxy to get the real IP if hosted behind a reverse proxy (like Nginx)
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 4000;

app.use(express.static(path.join(__dirname, 'public')));

// --- IN-MEMORY PRANK STATE ---
let game = {
    adminIp: null, 
    adminSocketId: null,
    status: 'setup', // 'setup', 'active'
    groupCode: '',
    hrName: '',
    players: [] // { id, name }
};

io.on('connection', (socket) => {
    const rawIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    const clientIp = rawIp.split(',')[0].trim();
    
    console.log(`Connection attempt from IP: ${clientIp}`);

    // IP LOCKING LOGIC
    if (!game.adminIp) {
        // First person to connect sets the lock
        game.adminIp = clientIp;
        game.adminSocketId = socket.id;
        console.log(`Admin locked to IP: ${game.adminIp}`);
        socket.emit('admin_status', true);
    } else {
        // Enforce network lock (allowing local dev IPs for testing)
        if (clientIp !== game.adminIp && clientIp !== '::1' && clientIp !== '127.0.0.1') {
            console.log(`Blocked unauthorized IP: ${clientIp}`);
            socket.emit('access_denied', 'Access Denied: Must be on the company local network to access this internal portal.');
            socket.disconnect(true);
            return;
        }
        socket.emit('admin_status', false);
    }

    // Send current state
    socket.emit('state_update', game);

    // --- PRANK LOGIC ---
    
    // Admin configures the prank
    socket.on('setup_prank', (data) => {
        if (socket.id !== game.adminSocketId) return;
        game.groupCode = data.groupCode;
        game.hrName = data.hrName;
        game.status = 'active';
        io.emit('state_update', game);
        socket.emit('system_message', { type: 'success', text: 'Prank initialized! Awaiting victims...' });
    });

    // Victim joins the survey
    socket.on('join_game', (data) => {
        if (game.status !== 'active') {
            socket.emit('system_message', { type: 'error', text: 'Survey is not active yet.' });
            return;
        }
        if (data.groupCode !== game.groupCode) {
            socket.emit('system_message', { type: 'error', text: 'Invalid Secret Group Code.' });
            return;
        }

        const newPlayer = { id: socket.id, name: data.username };
        game.players.push(newPlayer);
        console.log(`${data.username} started the survey.`);
        
        socket.emit('join_success', { hrName: game.hrName });
        io.emit('state_update', game); // Updates admin dashboard
    });

    // Victim completes the survey
    socket.on('quiz_finished', (data) => {
        // Notify the admin screen that they voted for the HR person!
        io.to(game.adminSocketId).emit('system_message', { 
            type: 'success', 
            text: `🎯 GOT 'EM! ${data.username} just submitted their vote to fire ${game.hrName}!` 
        });
    });
    
    // Reset prank (Admin only)
    socket.on('reset_game', () => {
        if (socket.id !== game.adminSocketId) return;
        game.status = 'setup';
        game.groupCode = '';
        game.hrName = '';
        game.players = [];
        io.emit('state_update', game);
    });

    socket.on('disconnect', () => {
        game.players = game.players.filter(p => p.id !== socket.id);
        io.emit('state_update', game);
        
        if (socket.id === game.adminSocketId) {
             console.log('Admin disconnected.');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
