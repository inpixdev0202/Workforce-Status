import { query, initializeDatabase } from './db.js';

async function checkAllocations() {
    await initializeDatabase();

    // Find Seo Sun-hee
    const seo = query("SELECT * FROM employees WHERE name = '서선희'")[0];
    if (!seo) {
        console.log('Seo Sun-hee not found');
        return;
    }
    console.log('Employee:', seo.name, '(ID:', seo.id, ')');

    // Find her assignments
    const assignments = query(`
        SELECT pa.*, p.name as project_name, p.type as project_type
        FROM project_assignments pa
        JOIN projects p ON pa.project_id = p.id
        WHERE pa.employee_id = ?
    `, [seo.id]);

    console.log('\n--- Assignments ---');
    assignments.forEach(a => {
        console.log(`ID: ${a.id}, Project: ${a.project_name}, Type: ${a.project_type}, Dates: ${a.input_start_date} ~ ${a.input_end_date}`);

        // Check allocations for this assignment
        const allocations = query(`
            SELECT * FROM project_allocations 
            WHERE assignment_id = ? 
            ORDER BY period_date ASC
        `, [a.id]);

        if (allocations.length > 0) {
            console.log(' Allocations found:', allocations.length);
            allocations.slice(0, 5).forEach(al => console.log(`   - ${al.period_date}: ${al.value}`));
            if (allocations.length > 5) console.log('   ...');
        } else {
            console.log(' No allocations found for this assignment.');
        }
    });

}

checkAllocations();
