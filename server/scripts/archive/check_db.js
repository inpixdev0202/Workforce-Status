import initSqlJs from 'sql.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'database.db');

async function check() {
    const SQL = await initSqlJs();
    const buffer = readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    console.log('--- RECENT ASSIGNMENTS ---');
    const res = db.exec(`
    SELECT pa.*, e.name as employee_name, g.name as group_name
    FROM project_assignments pa
    JOIN employees e ON pa.employee_id = e.id
    LEFT JOIN groups g ON e.group_id = g.id
    ORDER BY pa.id DESC
    LIMIT 5
  `);

    if (res.length > 0) {
        console.log('Columns:', res[0].columns);
        console.log('Values:', res[0].values);
    } else {
        console.log('No assignments found.');
    }

    db.close();
}

check().catch(console.error);
