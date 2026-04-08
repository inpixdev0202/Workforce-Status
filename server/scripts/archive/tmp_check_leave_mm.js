import { query, initializeDatabase } from './db.js';

async function check() {
    await initializeDatabase();

    console.log('--- Assignments in Leave/Annual Projects ---');
    const assignments = query(`
        SELECT pa.id as assignment_id, e.name as employee_name, p.name as project_name, 
               pa.input_start_date, pa.input_end_date, p.type as project_type
        FROM project_assignments pa
        JOIN projects p ON pa.project_id = p.id
        JOIN employees e ON pa.employee_id = e.id
        WHERE p.type IN ('Leave', 'Annual')
    `);

    for (const a of assignments) {
        const allocations = query("SELECT COUNT(*) as count FROM project_allocations WHERE assignment_id = ?", [a.assignment_id])[0].count;
        console.log(`Employee: ${a.employee_name}, Project: ${a.project_name}, Dates: ${a.input_start_date} ~ ${a.input_end_date}, MM Records: ${allocations}`);
        if (allocations > 0) {
            const samples = query("SELECT * FROM project_allocations WHERE assignment_id = ? LIMIT 3", [a.assignment_id]);
            samples.forEach(s => console.log(`  - ${s.period_date}: ${s.value}`));
        }
    }
}

check();
