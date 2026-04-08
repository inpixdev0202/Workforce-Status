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

    console.log('--- ALLOCATIONS FOR PARK (ID 7) AND YANG (ID 8) ---');
    const res = db.exec(`
    SELECT assignment_id, COUNT(*) as count, MIN(period_date) as start, MAX(period_date) as end, SUM(value) as total
    FROM project_allocations
    WHERE assignment_id IN (7, 8)
    GROUP BY assignment_id
  `);

    if (res.length > 0) {
        console.log('Columns:', res[0].columns);
        console.log('Values:', res[0].values);
    } else {
        console.log('No allocations found for assignments 7, 8.');
    }

    db.close();
}

check().catch(console.error);
