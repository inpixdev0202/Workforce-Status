import sqlite3 from 'sqlite3';
import { fileURLToPath } from 'url';

const db = new sqlite3.Database('./database.db');

db.all("SELECT id, email, name, role FROM users", [], (err, rows) => {
    if (err) {
        console.error('❌ Error checking users:', err.message);
    } else {
        console.log('--- Current Local Users ---');
        rows.forEach(row => {
            console.log(`[${row.id}] ${row.name} (${row.email}) - Role: ${row.role}`);
        });
        if (rows.length === 0) {
            console.log('⚠️ No users found in local database.');
        }
    }
    db.close();
});
