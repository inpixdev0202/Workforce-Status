import Database from 'better-sqlite3';

const db = new Database('database.db');
const cdgId = db.prepare('SELECT id FROM groups WHERE name = ?').get('CDG').id;
const dates = ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'];
const employees = db.prepare(`SELECT id, name FROM employees WHERE group_id = ? AND status='active' AND (employment_type='Regular' OR employment_type='정규직' OR employment_type='Permanent')`).all(cdgId);

const allocations = db.prepare(`
    SELECT pa.period_date, pa.value, p.type, e.id as emp_id
    FROM project_allocations pa
    JOIN project_assignments pas ON pa.assignment_id = pas.id
    JOIN projects p ON pas.project_id = p.id
    JOIN employees e ON pas.employee_id = e.id
    WHERE e.group_id = ? AND pa.period_date IN (?, ?, ?, ?, ?)
`).all(cdgId, ...dates);

let working = [];
employees.forEach(emp => {
    let sumWork = 0; let sumLeave = 0;
    allocations.filter(a => a.emp_id === emp.id).forEach(a => {
        if (a.type === 'Leave') sumLeave += parseFloat(a.value || 0);
        else sumWork += parseFloat(a.value || 0);
    });
    if (sumLeave < 0.1 && sumWork > 0) working.push(emp.name);
});

console.log(`Working (>0 MM): ${working.join(', ')} (Total: ${working.length})`);
