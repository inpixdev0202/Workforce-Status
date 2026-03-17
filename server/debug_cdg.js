import Database from 'better-sqlite3';

const db = new Database('database.db');

const cdgGroup = db.prepare('SELECT id FROM groups WHERE name = ?').get('CDG');
if (!cdgGroup) {
    console.log('Group CDG not found');
    process.exit(1);
}

const employees = db.prepare(`SELECT id, name, employment_type FROM employees WHERE group_id = ? AND status = 'active'`).all(cdgGroup.id);
console.log(`Total active employees in CDG: ${employees.length}`);
console.log(employees.map(e => `${e.name} (${e.employment_type})`).join(', '));

const leaveAssigments = db.prepare(`
    SELECT e.name, p.name as proj_name, pa.period_date, pa.value
    FROM project_allocations pa
    JOIN project_assignments pas ON pa.assignment_id = pas.id
    JOIN projects p ON pas.project_id = p.id
    JOIN employees e ON pas.employee_id = e.id
    WHERE e.group_id = ? AND p.type = 'Leave' AND pa.period_date >= '2026-03-09' AND pa.period_date <= '2026-03-13'
`).all(cdgGroup.id);

console.log('\nLeave Assignments next week (Mar 9 - Mar 13):');
console.log(leaveAssigments);

const regulars = employees.filter(e => e.employment_type === 'Regular' || e.employment_type === '정규직' || e.employment_type === 'Permanent');
console.log(`\nRegular employees in CDG: ${regulars.length}`);
