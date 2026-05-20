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
    socket.on('update_hr', (newName) => {
        if (socket.id !== adminSocketId) return;
        db.run("UPDATE config SET hr_name = ? WHERE id = 1", [newName], () => {
            sendInitialState(io); 
            socket.emit('system_message', { type: 'success', text: `Target changed to ${newName}` });
        });
    });

    socket.on('reset_all', () => {
        if (socket.id !== adminSocketId) return;
        db.run("DELETE FROM users", () => {
            sendInitialState(io);
            socket.emit('system_message', { type: 'info', text: `All users deleted.` });
        });
    });

    // --- PLAYER AUTH (Netflix Style) ---
    socket.on('create_user', (data) => {
        const { username, pin } = data;
        db.run("INSERT INTO users (username, pin) VALUES (?, ?)", [username, pin], function(err) {
            if (err) {
                socket.emit('system_message', { type: 'error', text: 'Profile already exists! Try logging in.' });
            } else {
                db.get("SELECT hr_name FROM config WHERE id = 1", (err, row) => {
                    socket.emit('login_success', { username, hrName: row.hr_name });
                    sendInitialState(io); // Update screens for everyone
                    if(adminSocketId) {
                         io.to(adminSocketId).emit('system_message', { type: 'info', text: `${username} created a profile.` });
                    }
                });
            }
        });
    });

    socket.on('login_user', (data) => {
        const { username, pin } = data;
        db.get("SELECT * FROM users WHERE username = ? AND pin = ?", [username, pin], (err, user) => {
            if (user) {
                if (user.has_voted) {
                    socket.emit('system_message', { type: 'error', text: 'You have already submitted your mandatory feedback!' });
                    return;
                }
                db.get("SELECT hr_name FROM config WHERE id = 1", (err, row) => {
                    socket.emit('login_success', { username, hrName: row.hr_name });
                });
            } else {
                socket.emit('system_message', { type: 'error', text: 'Incorrect PIN.' });
            }
        });
    });

    // --- PRANK COMPLETION ---
    socket.on('quiz_finished', (username) => {
        db.run("UPDATE users SET has_voted = 1 WHERE username = ?", [username], () => {
            db.get("SELECT hr_name FROM config WHERE id = 1", (err, row) => {
                if (adminSocketId) {
                    io.to(adminSocketId).emit('system_message', { 
                        type: 'success', 
                        text: `🎯 GOT 'EM! ${username} just voted to fire ${row.hr_name}!` 
                    });
                }
                sendInitialState(io); // Updates the "has_voted" status on the profile select screen
            });
        });
    });
});

function sendInitialState(target) {
    db.get("SELECT hr_name FROM config WHERE id = 1", (err, config) => {
        db.all("SELECT id, username, has_voted FROM users", (err, users) => {
            target.emit('state_update', { 
                hrName: config ? config.hr_name : 'HR',
                users: users || []
            });
        });
    });
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
