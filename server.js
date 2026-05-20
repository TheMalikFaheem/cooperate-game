const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
// Trust proxy to get the real IP if hosted behind a reverse proxy (like Nginx)
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// --- IN-MEMORY GAME STATE ---
// This data will be destroyed completely when the server stops.
let game = {
    adminIp: null, // Locked to the first user's public/router IP
    adminSocketId: null,
    status: 'lobby', // 'lobby', 'playing'
    players: [], // { id, name, ip, role }
};

io.on('connection', (socket) => {
    // Get the IP of the connecting client.
    // socket.handshake.headers['x-forwarded-for'] is useful if deployed on cloud platforms.
    const rawIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    // Handle multiple IPs in x-forwarded-for
    const clientIp = rawIp.split(',')[0].trim();
    
    console.log(`New connection attempt from IP: ${clientIp}`);

    // IP LOCKING LOGIC
    if (!game.adminIp) {
        // First person to connect sets the lock
        game.adminIp = clientIp;
        game.adminSocketId = socket.id;
        console.log(`Game locked to IP: ${game.adminIp}`);
        socket.emit('system_message', { type: 'success', text: 'You are the Admin. Room locked to your Wi-Fi IP.' });
        socket.emit('admin_status', true);
    } else {
        // Check if subsequent connections match the Admin's IP
        // We allow localhost/127.0.0.1 bypass for local testing if needed
        if (clientIp !== game.adminIp && clientIp !== '::1' && clientIp !== '127.0.0.1') {
            console.log(`Blocked connection from unauthorized IP: ${clientIp}`);
            socket.emit('access_denied', 'Access Denied: You must be on the same Wi-Fi network as the Host.');
            socket.disconnect(true);
            return;
        }
        socket.emit('admin_status', false);
    }

    // Send current state to newly connected (and authorized) client
    socket.emit('state_update', game);

    // Handle joining the game
    socket.on('join_game', (playerName) => {
        if (game.status !== 'lobby') {
            socket.emit('system_message', { type: 'error', text: 'Game already in progress.' });
            return;
        }
        
        // Prevent duplicate names or multiple joins from same socket
        if (game.players.find(p => p.id === socket.id)) return;

        const newPlayer = {
            id: socket.id,
            name: playerName,
            ip: clientIp,
            role: null
        };
        game.players.push(newPlayer);
        console.log(`${playerName} joined the game.`);
        
        io.emit('state_update', game);
    });

    // Handle game start (Admin only)
    socket.on('start_game', () => {
        if (socket.id !== game.adminSocketId) return;
        if (game.players.length < 3) {
            socket.emit('system_message', { type: 'error', text: 'Need at least 3 players to start.' });
            return;
        }

        game.status = 'playing';
        
        // Assign Roles (Example logic: 1 Whistleblower per 3 players)
        const numWhistleblowers = Math.max(1, Math.floor(game.players.length / 3));
        let roles = Array(game.players.length).fill('Executive');
        for (let i = 0; i < numWhistleblowers; i++) {
            roles[i] = 'Whistleblower';
        }
        // Shuffle roles
        roles = roles.sort(() => Math.random() - 0.5);
        
        game.players.forEach((player, index) => {
            player.role = roles[index];
            // Send private role message to each player
            io.to(player.id).emit('role_assigned', player.role);
        });

        io.emit('state_update', game);
        io.emit('system_message', { type: 'info', text: 'Game Started! Check your secret role.' });
    });
    
    // Reset game (Admin only)
    socket.on('reset_game', () => {
        if (socket.id !== game.adminSocketId) return;
        game.status = 'lobby';
        game.players = [];
        io.emit('state_update', game);
        io.emit('system_message', { type: 'info', text: 'Game has been reset by Admin.' });
    });

    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        game.players = game.players.filter(p => p.id !== socket.id);
        io.emit('state_update', game);
        
        if (socket.id === game.adminSocketId) {
             console.log('Admin disconnected. The IP lock remains, but admin controls are lost until reset.');
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Network locked to the first connecting IP address.`);
});
