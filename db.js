const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists so Docker volume can mount it
const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.resolve(dataDir, 'prank.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // Table to store the groups and the target HR person
    db.run(`CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_name TEXT,
        group_code TEXT UNIQUE,
        hr_name TEXT
    )`);

    // Table to store the submitted survey results
    db.run(`CREATE TABLE IF NOT EXISTS votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_code TEXT,
        username TEXT,
        pin TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Initialize 5 default groups automatically
    const defaultGroups = [
        { name: 'Engineering', code: 'ENG2024', hr: 'Sarah from HR' },
        { name: 'Marketing', code: 'MKT2024', hr: 'Toby from HR' },
        { name: 'Sales', code: 'SALES99', hr: 'Linda from HR' },
        { name: 'Operations', code: 'OPS001', hr: 'Michael from HR' },
        { name: 'Executive', code: 'EXEC55', hr: 'David from HR' }
    ];

    db.get("SELECT COUNT(*) as count FROM groups", (err, row) => {
        if (row && row.count === 0) {
            console.log("Initializing database with 5 default groups...");
            const stmt = db.prepare("INSERT INTO groups (group_name, group_code, hr_name) VALUES (?, ?, ?)");
            defaultGroups.forEach(g => stmt.run(g.name, g.code, g.hr));
            stmt.finalize();
        }
    });
});

module.exports = db;
