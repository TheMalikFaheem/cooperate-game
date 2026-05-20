const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const db = require('./db'); // Import the SQLite database

const app = express();
// Trust proxy to get the real IP if hosted behind a reverse proxy (like Nginx)
app.set('trust proxy', true);
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 4000;

app.use(express.static(path.join(__dirname, 'public')));

// Network IP locking state
let adminIp = null;
let adminSocketId = null;

io.on('connection', (socket) => {
    const rawIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    const clientIp = rawIp.split(',')[0].trim();
    
    console.log(`Connection attempt from IP: ${clientIp}`);

    // IP LOCKING LOGIC
    if (!adminIp) {
        adminIp = clientIp;
        adminSocketId = socket.id;
        console.log(`Admin locked to IP: ${adminIp}`);
        socket.emit('admin_status', true);
        sendAdminDashboard(socket);
    } else {
        // Enforce network lock (allowing local dev IPs for testing)
        if (clientIp !== adminIp && clientIp !== '::1' && clientIp !== '127.0.0.1') {
            console.log(`Blocked unauthorized IP: ${clientIp}`);
            socket.emit('access_denied', 'Access Denied: Must be on the company local network to access this internal portal.');
            socket.disconnect(true);
            return;
        }
        socket.emit('admin_status', false);
    }

    // --- PRANK LOGIC (Database Integrated) ---
    
    // Victim joins the survey
    socket.on('join_game', (data) => {
        const { groupCode, username, pin } = data;
        
        // Check database to see if groupCode exists
        db.get("SELECT hr_name FROM groups WHERE group_code = ?", [groupCode], (err, row) => {
            if (err || !row) {
                socket.emit('system_message', { type: 'error', text: 'Invalid Secret Group Code.' });
                return;
            }

            console.log(`${username} joined group ${groupCode}.`);
            
            // Allow them in and send the dynamic HR name for that specific group!
            socket.emit('join_success', { hrName: row.hr_name });
            
            // Send live update to Admin
            if (adminSocketId) {
                io.to(adminSocketId).emit('system_message', { type: 'info', text: `${username} just started the survey for group ${groupCode}.` });
            }
        });
    });

    // Victim completes the survey
    socket.on('quiz_finished', (data) => {
        const { groupCode, username, pin } = data;
        
        // Save the vote to the database
        db.run("INSERT INTO votes (group_code, username, pin) VALUES (?, ?, ?)", [groupCode, username, pin], function(err) {
            if (!err) {
                // Fetch the HR name again to show in the Admin alert
                db.get("SELECT hr_name FROM groups WHERE group_code = ?", [groupCode], (err, row) => {
                    if (row && adminSocketId) {
                        io.to(adminSocketId).emit('system_message', { 
                            type: 'success', 
                            text: `🎯 GOT 'EM! ${username} (Group: ${groupCode}) just voted to fire ${row.hr_name}!` 
                        });
                        // Refresh the admin dashboard with the new DB data
                        sendAdminDashboard(io.to(adminSocketId));
                    }
                });
            }
        });
    });

    socket.on('disconnect', () => {
        if (socket.id === adminSocketId) {
             console.log('Admin disconnected.');
             // Note: IP lock remains active, so only people on this IP can join
        }
    });
});

// Helper function to send the full database state to the Admin UI
function sendAdminDashboard(socketTarget) {
    db.all("SELECT * FROM groups", (err, groups) => {
        if (err) return;
        db.all("SELECT * FROM votes ORDER BY timestamp DESC LIMIT 20", (err, votes) => {
            if (err) return;
            socketTarget.emit('dashboard_update', { groups, votes });
        });
    });
}

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
