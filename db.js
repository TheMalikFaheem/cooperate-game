const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new sqlite3.Database(path.resolve(dataDir, 'game.db'));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY,
        target_name TEXT DEFAULT 'Waiting...'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        target_name TEXT,
        message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.get("SELECT COUNT(*) as c FROM config", (err, row) => {
        if (row && row.c === 0) db.run("INSERT INTO config (id, target_name) VALUES (1, 'Waiting...')");
    });
});

module.exports = db;
