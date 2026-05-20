const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 4000;

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const sessionMiddleware = session({
    store: new SQLiteStore({ db: 'sessions.db', dir: './data' }),
    secret: process.env.SESSION_SECRET || 'guessme-super-secret-2024',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
});

app.use(sessionMiddleware);

// Share session with Socket.io
io.use((socket, next) => {
    sessionMiddleware(socket.request, socket.request.res || {}, next);
});

// ─── Auth Middleware ──────────────────────────────────────────
function requireAuth(req, res, next) {
    if (!req.session.adminId) return res.status(401).json({ error: 'Please log in first.' });
    next();
}

// ─── Helper ──────────────────────────────────────────────────
function generateSlug() {
    return crypto.randomBytes(4).toString('hex'); // e.g. "a3f2b1c4"
}

// ─── Auth Routes ─────────────────────────────────────────────
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'All fields are required.' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const hashed = await bcrypt.hash(password, 10);
    db.run("INSERT INTO admins (name, email, password) VALUES (?, ?, ?)", [name.trim(), email.trim().toLowerCase(), hashed], function(err) {
        if (err) return res.status(409).json({ error: 'Email already registered.' });
        req.session.adminId = this.lastID;
        req.session.adminName = name.trim();
        res.json({ success: true, name: name.trim() });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'All fields are required.' });

    db.get("SELECT * FROM admins WHERE email = ?", [email.trim().toLowerCase()], async (err, admin) => {
        if (!admin) return res.status(401).json({ error: 'Invalid email or password.' });
        const match = await bcrypt.compare(password, admin.password);
        if (!match) return res.status(401).json({ error: 'Invalid email or password.' });
        req.session.adminId = admin.id;
        req.session.adminName = admin.name;
        res.json({ success: true, name: admin.name });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/me', (req, res) => {
    if (!req.session.adminId) return res.json({ loggedIn: false });
    res.json({ loggedIn: true, name: req.session.adminName });
});

// ─── Room Routes ─────────────────────────────────────────────
app.get('/api/rooms', requireAuth, (req, res) => {
    db.all("SELECT r.*, (SELECT COUNT(*) FROM messages m WHERE m.room_id = r.id AND m.target_name = r.current_target) as msg_count FROM rooms r WHERE r.admin_id = ? ORDER BY r.created_at DESC", [req.session.adminId], (err, rows) => {
        res.json(rows || []);
    });
});

app.post('/api/rooms', requireAuth, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Room name is required.' });
    const slug = generateSlug();
    db.run("INSERT INTO rooms (admin_id, name, slug) VALUES (?, ?, ?)", [req.session.adminId, name.trim(), slug], function(err) {
        if (err) return res.status(500).json({ error: 'Could not create room.' });
        res.json({ id: this.lastID, name: name.trim(), slug, current_target: '', msg_count: 0 });
    });
});

app.delete('/api/rooms/:id', requireAuth, (req, res) => {
    db.run("DELETE FROM rooms WHERE id = ? AND admin_id = ?", [req.params.id, req.session.adminId], (err) => {
        db.run("DELETE FROM messages WHERE room_id = ?", [req.params.id]);
        res.json({ success: true });
    });
});

// ─── Round Management ─────────────────────────────────────────
app.patch('/api/rooms/:id/target', requireAuth, (req, res) => {
    const { target } = req.body;
    db.run("UPDATE rooms SET current_target = ? WHERE id = ? AND admin_id = ?", [target.trim(), req.params.id, req.session.adminId], () => {
        // Notify public room via socket
        io.to(`room:${req.params.id}`).emit('target_changed', { targetName: target.trim() });
        res.json({ success: true });
    });
});

app.post('/api/rooms/:id/clear', requireAuth, (req, res) => {
    db.get("SELECT current_target FROM rooms WHERE id = ? AND admin_id = ?", [req.params.id, req.session.adminId], (err, room) => {
        if (!room) return res.status(404).json({ error: 'Room not found.' });
        db.run("DELETE FROM messages WHERE room_id = ? AND target_name = ?", [req.params.id, room.current_target], () => {
            io.to(`admin:${req.params.id}`).emit('messages_cleared');
            res.json({ success: true });
        });
    });
});

// ─── Public Room Route ────────────────────────────────────────
app.get('/api/r/:slug', (req, res) => {
    db.get("SELECT id, name, current_target FROM rooms WHERE slug = ?", [req.params.slug], (err, room) => {
        if (!room) return res.status(404).json({ error: 'Room not found.' });
        res.json(room);
    });
});

app.post('/api/r/:slug/message', (req, res) => {
    const { message } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'Message cannot be empty.' });
    if (message.length > 500) return res.status(400).json({ error: 'Message too long.' });

    db.get("SELECT id, name, current_target FROM rooms WHERE slug = ?", [req.params.slug], (err, room) => {
        if (!room || !room.current_target) return res.status(400).json({ error: 'No active round.' });

        db.run("INSERT INTO messages (room_id, target_name, message) VALUES (?, ?, ?)",
            [room.id, room.current_target, message.trim()],
            function(err) {
                if (err) return res.status(500).json({ error: 'Failed to save message.' });

                // Emit to admin dashboard live
                const newMsg = {
                    id: this.lastID,
                    message: message.trim(),
                    target_name: room.current_target,
                    timestamp: new Date().toISOString()
                };
                io.to(`admin:${room.id}`).emit('new_message', newMsg);
                res.json({ success: true });
            }
        );
    });
});

// ─── Room page route (serve dashboard.html or room.html) ──────
app.get('/dashboard', (req, res) => res.sendFile(path.join(__dirname, 'public', 'dashboard.html')));
app.get('/r/:slug', (req, res) => res.sendFile(path.join(__dirname, 'public', 'room.html')));

// ─── Socket.io ───────────────────────────────────────────────
io.on('connection', (socket) => {
    // Admin joins their room's admin channel
    socket.on('admin_join_room', (roomId) => {
        const adminId = socket.request.session?.adminId;
        if (!adminId) return;
        db.get("SELECT id FROM rooms WHERE id = ? AND admin_id = ?", [roomId, adminId], (err, room) => {
            if (room) {
                socket.join(`admin:${roomId}`);
                // Send existing messages
                db.get("SELECT current_target FROM rooms WHERE id = ?", [roomId], (err, r) => {
                    if (!r) return;
                    db.all("SELECT * FROM messages WHERE room_id = ? AND target_name = ? ORDER BY timestamp DESC", [roomId, r.current_target], (err, msgs) => {
                        socket.emit('room_messages', { messages: msgs || [], targetName: r.current_target });
                    });
                });
            }
        });
    });

    // Public user joins room channel (for target_changed events)
    socket.on('public_join_room', (roomId) => {
        socket.join(`room:${roomId}`);
    });
});

server.listen(PORT, '0.0.0.0', () => console.log(`GuessME running on port ${PORT}`));
