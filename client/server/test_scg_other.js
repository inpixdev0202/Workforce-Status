import Database from 'better-sqlite3';

const db = new Database('database.db');
const todayStr = new Date().toISOString().split('T')[0];

const scgGroup = db.prepare('SELECT id FROM groups WHERE name = ?').get('SCG');

const groupEmployees = db.prepare(`
    SELECT e.id, e.name, e.employment_type, e.exclude_from_stats,
    (SELECT p.type FROM project_assignments pa JOIN projects p ON pa.project_id = p.id 
     WHERE pa.employee_id = e.id AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
     AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL) LIMIT 1) as current_project_type
    FROM employees e
    WHERE e.group_id = ? AND e.status = 'active'
`).all(todayStr, todayStr, scgGroup.id);

let client = [];
let bench = [];
let other = [];

groupEmployees.forEach(emp => {
    const isRegular = ['Regular', '정규직', 'Permanent'].includes(emp.employment_type);
    const isExcluded = !!emp.exclude_from_stats;
    const projectType = emp.current_project_type;

    if (isExcluded) {
        other.push(`${emp.name} (Excluded)`);
    } else if (projectType === 'Client') {
        client.push(emp.name);
    } else if (isRegular && (!projectType || projectType === 'Internal' || projectType === 'Bench')) {
        bench.push(emp.name);
    } else {
        other.push(`${emp.name} (Type: ${emp.employment_type}, Proj: ${projectType})`);
    }
});

console.log(`SCG Details:`);
console.log(`Client (${client.length}): ${client.join(', ')}`);
console.log(`Bench (${bench.length}): ${bench.join(', ')}`);
console.log(`Other (${other.length}): \n  - ${other.join('\n  - ')}`);
