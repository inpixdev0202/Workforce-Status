import { query, initializeDatabase } from './db.js';

async function check() {
    await initializeDatabase();

    const seo = query("SELECT * FROM employees WHERE name = '서선희'")[0];
    if (!seo) {
        console.log('Seo Sun-hee not found');
        return;
    }

    const assignments = query(`
        SELECT pa.*, p.name as project_name 
        FROM project_assignments pa 
        JOIN projects p ON pa.project_id = p.id 
        WHERE pa.employee_id = ?
    `, [seo.id]);

    console.log('Assignments for Seo Sun-hee:');
    assignments.forEach(a => {
        const count = query("SELECT COUNT(*) as count FROM project_allocations WHERE assignment_id = ?", [a.id])[0].count;
        console.log(`- ID: ${a.id}, Project: ${a.project_name}, Start: ${a.input_start_date}, End: ${a.input_end_date}, Allocations: ${count}`);
    });
}

check();
