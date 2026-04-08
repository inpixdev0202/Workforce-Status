import Database from 'better-sqlite3';

const db = new Database('database.db');

const cdgGroup = db.prepare('SELECT id FROM groups WHERE name = ?').get('CDG');

const employees = db.prepare(`SELECT id, name, employment_type FROM employees WHERE group_id = ? AND status = 'active'`).all(cdgGroup.id);
const regulars = employees.filter(e => e.employment_type === 'Regular' || e.employment_type === '정규직' || e.employment_type === 'Permanent');

const allocations = db.prepare(`
    SELECT pa.period_date, pa.value, p.type, e.id as emp_id, e.name
    FROM project_allocations pa
    JOIN project_assignments pas ON pa.assignment_id = pas.id
    JOIN projects p ON pas.project_id = p.id
    JOIN employees e ON pas.employee_id = e.id
    WHERE e.group_id = ? AND pa.period_date IN ('2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13')
`).all(cdgGroup.id);

console.log(`Total Regulars in CDG: ${regulars.length}`);

let idleCount = 0;
let headcount = 0;
let idleNames = [];
let leaveNames = [];

regulars.forEach(emp => {
    let sumTotal = 0;
    let sumLeave = 0;

    allocations.filter(a => a.emp_id === emp.id).forEach(a => {
        if (a.type === 'Leave') sumLeave += parseFloat(a.value || 0);
        else sumTotal += parseFloat(a.value || 0);
    });

    if (sumLeave >= 0.1) {
        leaveNames.push(emp.name);
        return; // Exclude from headcount
    }

    headcount++;
    if (sumTotal < 0.1) {
        idleCount++;
        idleNames.push(emp.name);
    }
});

console.log(`Headcount (excluding leave): ${headcount}`);
console.log(`Leave Employees (Excluded): ${leaveNames.join(', ')}`);
console.log(`Idle Count: ${idleCount}`);
console.log(`Idle Employees: ${idleNames.join(', ')}`);
console.log(`Rate: ${(idleCount / headcount * 100).toFixed(1)}%`);
