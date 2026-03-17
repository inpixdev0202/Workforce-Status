import Database from 'better-sqlite3';

const db = new Database('database.db');
const cdgId = db.prepare('SELECT id FROM groups WHERE name = ?').get('CDG').id;
const dates = ['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'];

const employees = db.prepare(`
    SELECT e.id, e.name 
    FROM employees e
    WHERE e.group_id = ? AND e.status='active' 
    AND (e.employment_type='Regular' OR e.employment_type='정규직' OR e.employment_type='Permanent')
`).all(cdgId);

// Filter out totally unassigned employees (mimicking ProjectStatus.jsx empTotals mapping)
const unassignedIds = db.prepare(`
    SELECT e.id
    FROM employees e
    LEFT JOIN project_assignments pas ON e.id = pas.employee_id
    WHERE e.group_id = ? AND pas.id IS NULL
`).all(cdgId).map(x => x.id);

const assignedEmployees = employees.filter(e => !unassignedIds.includes(e.id));
console.log(`Assigned Regulars in CDG: ${assignedEmployees.length}`); // Should be 18

const allocations = db.prepare(`
    SELECT pa.period_date, pa.value, p.type, e.id as emp_id
    FROM project_allocations pa
    JOIN project_assignments pas ON pa.assignment_id = pas.id
    JOIN projects p ON pas.project_id = p.id
    JOIN employees e ON pas.employee_id = e.id
    WHERE e.group_id = ? AND pa.period_date IN (?, ?, ?, ?, ?)
`).all(cdgId, ...dates);

let activeRegularCount = 0;
let zeroCount = 0;
let leaveNames = [];
let zeroNames = [];

assignedEmployees.forEach(emp => {
    let sumWork = 0;
    let sumLeave = 0;

    allocations.filter(a => a.emp_id === emp.id).forEach(a => {
        if (a.type === 'Leave') sumLeave += parseFloat(a.value || 0);
        else sumWork += parseFloat(a.value || 0);
    });

    if (sumLeave >= 0.1) {
        leaveNames.push(emp.name);
        return; // Exclude entirely if on leave
    }

    activeRegularCount++;

    if (sumWork < 0.1) {
        zeroCount++;
        zeroNames.push(emp.name);
    }
});

console.log(`Active Regular Count: ${activeRegularCount}`);
console.log(`Leave Count: ${leaveNames.length} (${leaveNames.join(', ')})`);
console.log(`Zero Count: ${zeroCount} (${zeroNames.join(', ')})`);
console.log(`Math: ${zeroCount} / ${activeRegularCount} = ${(zeroCount / activeRegularCount * 100).toFixed(1)}%`);
