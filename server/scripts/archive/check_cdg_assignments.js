import Database from 'better-sqlite3';

const db = new Database('database.db');
const cdgId = db.prepare('SELECT id FROM groups WHERE name = ?').get('CDG').id;

const employees = db.prepare(`SELECT id, name FROM employees WHERE group_id = ? AND status='active' AND (employment_type='Regular' OR employment_type='정규직' OR employment_type='Permanent')`).all(cdgId);

const assignments = db.prepare(`
    SELECT DISTINCT pas.employee_id
    from project_assignments pas
    JOIN projects p ON pas.project_id = p.id
    JOIN employees e ON pas.employee_id = e.id
    WHERE e.group_id = ? AND p.type != 'Leave'
`).all(cdgId);

const assignedIds = new Set(assignments.map(a => a.employee_id));

console.log(`Total Regulars: ${employees.length}`);
console.log(`Regulars with ANY non-leave assignment: ${assignedIds.size}`);

const unassigned = employees.filter(e => !assignedIds.has(e.id));
console.log(`Unassigned Regulars: ${unassigned.map(e => e.name).join(', ')}`);
