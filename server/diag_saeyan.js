import db from './db.js';

async function diagnose() {
    await db.initializeDatabase();
    console.log('--- FINDING EMPLOYEE: 임새얀 ---');
    const employees = db.query('SELECT * FROM employees WHERE name = "임새얀"');
    console.log('Employees:', JSON.stringify(employees, null, 2));

    if (employees.length > 0) {
        const ids = employees.map(e => e.id);
        const assignments = db.query(`
      SELECT pa.*, p.name as project_name 
      FROM project_assignments pa 
      JOIN projects p ON pa.project_id = p.id 
      WHERE pa.employee_id IN (${ids.join(',')})
    `);
        console.log('Assignments for these IDs:', JSON.stringify(assignments, null, 2));
    }
}

diagnose().catch(console.error);
