
import { initializeDatabase, query } from './db.js';

async function diagnose() {
    await initializeDatabase();

    // Find employee named 'Shin Jinho' (or similar) or just list all assignments to find ID 4
    console.log('--- Inspecting Assignment ID 4 ---');
    const assign4 = query('SELECT * FROM project_assignments WHERE id = 4');
    console.log('Assignment 4:', assign4);

    if (assign4.length > 0) {
        const a = assign4[0];
        console.log('Type of start_date:', typeof a.input_start_date);
        console.log('Value of start_date:', a.input_start_date);
        console.log('Type of end_date:', typeof a.input_end_date);
        console.log('Value of end_date:', a.input_end_date);
    }

    // specific search for Shin Jinho if ID 4 isn't him
    console.log('--- Searching for Shin Jinho ---');
    const employee = query("SELECT * FROM employees WHERE name LIKE '%신진호%'");
    console.log('Employee:', employee);

    if (employee.length > 0) {
        const empId = employee[0].id;
        const assignments = query('SELECT * FROM project_assignments WHERE employee_id = ?', [empId]);
        console.log(`Assignments for Shin Jinho (ID ${empId}):`, assignments);

        for (const a of assignments) {
            const allocs = query('SELECT * FROM project_allocations WHERE assignment_id = ? AND period_date LIKE "2026-05%"', [a.id]);
            console.log(`Allocations for Assignment ${a.id} in May 2026:`, allocs);
        }
    }
}

diagnose();
