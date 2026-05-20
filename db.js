const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, 'prank.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Single config row to store the HR target
    db.run(`CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY,
        hr_name TEXT
    )`);

    // Users table for the Netflix-style profiles
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        pin TEXT,
        has_voted BOOLEAN DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Initialize config if empty
    db.get("SELECT COUNT(*) as count FROM config", (err, row) => {
        if (row && row.count === 0) {
            db.run("INSERT INTO config (id, hr_name) VALUES (1, 'The HR Department')");
        }
    });
});

module.exports = db;
