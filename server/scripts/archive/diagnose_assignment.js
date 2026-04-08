import db from './db.js';

async function diagnose() {
    await db.initializeDatabase();

    console.log('--- FINDING EMPLOYEE: 김가연 ---');
    const employees = db.query('SELECT * FROM employees WHERE name = ?', ['김가연']);
    console.log('Employee Results:', employees);

    if (employees.length > 0) {
        const empId = employees[0].id;
        console.log(`--- ASSIGNMENTS FOR ID ${empId} ---`);
        const assignments = db.query(`
      SELECT pa.*, p.name as project_name 
      FROM project_assignments pa 
      JOIN projects p ON pa.project_id = p.id 
      WHERE pa.employee_id = ?
    `, [empId]);
        console.log('Assignments:', assignments);
    } else {
        console.log('Employee 김가연 not found.');
    }
}

diagnose().catch(console.error);
