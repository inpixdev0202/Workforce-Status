import db from './db.js';
import fs from 'fs';

async function list() {
    await db.initializeDatabase();
    const res = db.query(`
    SELECT pa.*, e.name as employee_name
    FROM project_assignments pa
    LEFT JOIN employees e ON pa.employee_id = e.id
    WHERE pa.project_id = 1
  `);
    fs.writeFileSync('project1_assignments.json', JSON.stringify(res, null, 2));
    console.log('Saved project1_assignments.json');
}

list().catch(console.error);
