import db from './db.js';

async function investigate() {
    try {
        await db.initializeDatabase();

        const p0 = db.get("SELECT * FROM projects WHERE id = 0");
        console.log('Project ID 0:', JSON.stringify(p0, null, 2));

        const p1 = db.get("SELECT * FROM projects WHERE id = 1");
        console.log('Project ID 1:', JSON.stringify(p1, null, 2));

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

investigate();
