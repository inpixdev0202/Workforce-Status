import db from './db.js';

async function list() {
    await db.initializeDatabase();
    const res = db.query('SELECT pa.*, e.name FROM project_assignments pa JOIN employees e ON pa.employee_id = e.id WHERE pa.project_id = 1 ORDER BY pa.id DESC');
    console.log(JSON.stringify(res, null, 2));
}

list().catch(console.error);
