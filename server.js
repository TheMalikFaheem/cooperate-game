const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./db');

const app = express();
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 4000;
app.use(express.static(path.join(__dirname, 'public')));

let adminIp = null;
let adminSocketId = null;

io.on('connection', (socket) => {
    const rawIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    const clientIp = rawIp.split(',')[0].trim();
    
    // IP LOCKING
    if (!adminIp) {
        adminIp = clientIp;
        adminSocketId = socket.id;
        socket.emit('admin_status', true);
    } else {
        if (clientIp !== adminIp && clientIp !== '::1' && clientIp !== '127.0.0.1') {
            socket.emit('access_denied', 'Access Denied: Please connect to the local network.');
            socket.disconnect(true);
            return;
        }
        socket.emit('admin_status', false);
    }

    sendInitialState(socket);

    // --- ADMIN CONFIG ---
    socket.on('new_round', (newName) => {
        if (socket.id !== adminSocketId) return;
        db.run("UPDATE config SET target_name = ? WHERE id = 1", [newName], () => {
            sendInitialState(io); 
            socket.emit('system_message', { type: 'success', text: `New round started for ${newName}!` });
        });
    });

    socket.on('reset_all_users', () => {
        if (socket.id !== adminSocketId) return;
        db.run("DELETE FROM users", () => {
            db.run("DELETE FROM messages", () => {
                sendInitialState(io);
                socket.emit('system_message', { type: 'info', text: `Everything wiped.` });
            });
        });
    });

    // --- PLAYER AUTH (Netflix Style) ---
    socket.on('create_user', (data) => {
        const { username, pin } = data;
        db.run("INSERT INTO users (username, pin) VALUES (?, ?)", [username, pin], function(err) {
            if (err) {
                socket.emit('system_message', { type: 'error', text: 'Profile already exists! Try logging in.' });
            } else {
                db.get("SELECT target_name FROM config WHERE id = 1", (err, row) => {
                    socket.emit('login_success', { username, targetName: row.target_name });
                    sendInitialState(io); 
                });
            }
        });
    });

    socket.on('login_user', (data) => {
        const { username, pin } = data;
        db.get("SELECT * FROM users WHERE username = ? AND pin = ?", [username, pin], (err, user) => {
            if (user) {
                db.get("SELECT target_name FROM config WHERE id = 1", (err, config) => {
                    db.get("SELECT id FROM messages WHERE target_name = ? AND author = ?", [config.target_name, username], (err, msg) => {
                        socket.emit('login_success', { 
                            username, 
                            targetName: config.target_name,
                            hasSubmittedForCurrentRound: !!msg 
                        });
                    });
                });
            } else {
                socket.emit('system_message', { type: 'error', text: 'Incorrect PIN.' });
            }
        });
    });

    // --- SUBMIT MESSAGE ---
    socket.on('submit_message', (data) => {
        const { username, message } = data;
        db.get("SELECT target_name FROM config WHERE id = 1", (err, config) => {
            const target = config.target_name;
            db.run("INSERT INTO messages (target_name, author, message) VALUES (?, ?, ?)", [target, username, message], () => {
                socket.emit('submission_success');
                sendInitialState(io); // Broadcast to update Admin dashboard live
            });
        });
    });

});

function sendInitialState(target) {
    db.get("SELECT target_name FROM config WHERE id = 1", (err, config) => {
        const targetName = config ? config.target_name : 'Waiting...';
        db.all("SELECT id, username FROM users", (err, users) => {
            db.all("SELECT * FROM messages WHERE target_name = ? ORDER BY timestamp DESC", [targetName], (err, messages) => {
                target.emit('state_update', { 
                    targetName,
                    users: users || [],
                    messages: messages || []
                });
            });
        });
    });
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
