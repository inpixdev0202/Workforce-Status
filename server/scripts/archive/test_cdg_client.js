import Database from 'better-sqlite3';

const db = new Database('database.db');
const cdgId = db.prepare('SELECT id FROM groups WHERE name = ?').get('CDG').id;
const dates = ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'];

const clientAllocations = db.prepare(`
    SELECT DISTINCT e.name
    FROM project_allocations pa
    JOIN project_assignments pas ON pa.assignment_id = pas.id
    JOIN projects p ON pas.project_id = p.id
    JOIN employees e ON pas.employee_id = e.id
    WHERE e.group_id = ? AND p.type = 'Client' AND pa.period_date IN (?, ?, ?, ?, ?)
    AND e.employment_type = '정규직' AND e.status = 'active'
`).all(cdgId, ...dates);

console.log(`People with ANY Client allocation: ${clientAllocations.length}`);
console.log(clientAllocations.map(a => a.name).join(', '));
