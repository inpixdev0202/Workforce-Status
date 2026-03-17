import db from './db.js';

async function addPDG() {
    try {
        await db.initializeDatabase();

        const name = 'PDG';
        const color = '#14B8A6';
        const order = 8;

        const exists = db.get('SELECT id FROM groups WHERE name = ?', [name]);
        if (!exists) {
            db.run('INSERT INTO groups (name, color, display_order) VALUES (?, ?, ?)', [name, color, order]);
            console.log(`✅ Group added: ${name}`);
        } else {
            console.log(`ℹ️ Group already exists: ${name}`);
        }

        db.saveDatabase();
        console.log('✨ Group processed successfully.');
    } catch (err) {
        console.error('❌ Error adding group:', err);
    }
}

addPDG();
