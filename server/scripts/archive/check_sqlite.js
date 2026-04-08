import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'database.db'), { readonly: true });

function checkTable(name) {
    const count = db.prepare(`SELECT count(*) as count FROM ${name}`).get().count;
    console.log(`${name}: ${count} rows`);
}

console.log('--- SQLite Row Counts ---');
['groups', 'employees', 'users', 'attendance', 'projects', 'project_assignments', 'project_allocations', 'integrations', 'project_reports'].forEach(checkTable);

console.log('\n--- Checking for Orphan Assignments ---');
const orphans = db.prepare(`
    SELECT id, project_id, employee_id 
    FROM project_assignments 
    WHERE project_id NOT IN (SELECT id FROM projects)
    OR employee_id NOT IN (SELECT id FROM employees)
`).all();
console.log(`Orphan assignments found: ${orphans.length}`);
if (orphans.length > 0) {
    console.log('Sample orphans:', orphans.slice(0, 5));
}
db.close();
