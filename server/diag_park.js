import db from './db.js';

async function diagnose() {
    await db.initializeDatabase();
    console.log('--- FINDING EMPLOYEE: 박문홍 ---');
    const employees = db.query('SELECT * FROM employees WHERE name = "박문홍"');
    console.log('Employee:', employees);

    if (employees.length > 0) {
        const empId = employees[0].id;
        const assignments = db.query(`
      SELECT pa.*, p.name as project_name 
      FROM project_assignments pa 
      JOIN projects p ON pa.project_id = p.id 
      WHERE pa.employee_id = ?
    `, [empId]);
        console.log('Assignments:', assignments);
    }
}

diagnose().catch(console.error);
