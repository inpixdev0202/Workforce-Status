const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const db = new Database(dbPath);

console.log('--- Checking Employee: 정하빈 ---');
const employee = db.prepare("SELECT * FROM employees WHERE name LIKE '%정하빈%'").get();
if (!employee) {
    console.log('Employee not found');
} else {
    console.log('Employee:', employee);

    console.log('\n--- Checking Assignments ---');
    const assignments = db.prepare(`
        SELECT pa.*, p.name as project_name 
        FROM project_assignments pa 
        JOIN projects p ON pa.project_id = p.id 
        WHERE pa.employee_id = ?
    `).all(employee.id);
    console.log('Assignments:', JSON.stringify(assignments, null, 2));
}

db.close();
