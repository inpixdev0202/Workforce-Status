
import { initializeDatabase, query } from './db.js';

async function testMatrix() {
    await initializeDatabase();

    // Simulate what GET /matrix does
    // 1. Get Groups (omitted)
    // 2. Get Projects (omitted)
    // 3. Get Allocations
    const allocations = query('SELECT * FROM project_allocations');

    // 4. Get Assignments
    const assignments = query(`
        SELECT pa.*, p.name as project_name, 
               e.name as employee_name, e.position as employee_position,
               e.group_id
        FROM project_assignments pa
        JOIN projects p ON pa.project_id = p.id
        JOIN employees e ON pa.employee_id = e.id
        WHERE e.name LIKE '%신진호%'
    `);

    console.log(`Found ${assignments.length} assignments for Shin Jinho.`);

    // Map allocations like the API does
    const projectsMap = {}; // simplified

    // Check specific assignment
    const targetAssign = assignments.find(a => a.project_name.includes('Titan') || a.id === 23); // assuming ID 23

    if (targetAssign) {
        console.log(`Checking Assignment ID: ${targetAssign.id}`);

        const assignAllocations = allocations.filter(a => a.assignment_id === targetAssign.id);
        const allocMap = {};
        assignAllocations.forEach(a => {
            allocMap[a.period_date] = a.value;
        });

        console.log('Allocations Map:', allocMap);
        console.log('Value for 2026-05-04:', allocMap['2026-05-04']);
    } else {
        console.log('Target assignment not found in simulation.');
    }
}

testMatrix();
