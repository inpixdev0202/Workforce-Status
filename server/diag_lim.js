import db from './db.js';

async function diagnose() {
    await db.initializeDatabase();
    console.log('--- FINDING EMPLOYEE: 임근혜 ---');
    const employees = db.query('SELECT * FROM employees WHERE name = "임근혜"');
    console.log('Employees:', JSON.stringify(employees, null, 2));

    if (employees.length > 0) {
        const empId = employees[0].id;
        const assignments = db.query(`
      SELECT pa.*, p.name as project_name 
      FROM project_assignments pa 
      JOIN projects p ON pa.project_id = p.id 
      WHERE pa.employee_id = ?
    `, [empId]);
        console.log('Assignments:', JSON.stringify(assignments, null, 2));
    } else {
        console.log('Employee not found with exact name "임근혜". Searching with LIKE...');
        const likeRes = db.query('SELECT * FROM employees WHERE name LIKE "%임%"');
        console.log('LIKE results:', JSON.stringify(likeRes, null, 2));
    }
}

diagnose().catch(console.error);
