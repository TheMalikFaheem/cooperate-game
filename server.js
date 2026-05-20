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

// Admin credentials (change these before deploying!)
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'letmein123';
const adminSockets = new Set();

function sendState(target) {
    db.get("SELECT target_name FROM config WHERE id = 1", (err, config) => {
        const targetName = config ? config.target_name : 'Waiting...';
        db.all("SELECT * FROM messages WHERE target_name = ? ORDER BY timestamp DESC", [targetName], (err, msgs) => {
            db.get("SELECT COUNT(*) as total FROM messages WHERE target_name = ?", [targetName], (err, count) => {
                target.emit('state_update', {
                    targetName,
                    messages: msgs || [],
                    total: count ? count.total : 0
                });
            });
        });
    });
}

io.on('connection', (socket) => {
    sendState(socket);

    socket.on('admin_login', ({ username, password }) => {
        if (username === ADMIN_USER && password === ADMIN_PASS) {
            adminSockets.add(socket.id);
            socket.emit('admin_auth', true);
            sendState(socket);
        } else {
            socket.emit('admin_auth', false);
        }
    });

    socket.on('new_round', (name) => {
        if (!adminSockets.has(socket.id)) return;
        db.run("UPDATE config SET target_name = ? WHERE id = 1", [name.trim()], () => {
            sendState(io);
        });
    });

    socket.on('clear_messages', () => {
        if (!adminSockets.has(socket.id)) return;
        db.get("SELECT target_name FROM config WHERE id = 1", (err, config) => {
            db.run("DELETE FROM messages WHERE target_name = ?", [config.target_name], () => {
                sendState(io);
            });
        });
    });

    socket.on('submit_message', (message) => {
        const text = (message || '').trim();
        if (!text) return;
        db.get("SELECT target_name FROM config WHERE id = 1", (err, config) => {
            db.run("INSERT INTO messages (target_name, message) VALUES (?, ?)", [config.target_name, text], () => {
                socket.emit('submit_ok');
                sendState(io);
            });
        });
    });

    socket.on('disconnect', () => adminSockets.delete(socket.id));
});

server.listen(PORT, '0.0.0.0', () => console.log(`Running on port ${PORT}`));
