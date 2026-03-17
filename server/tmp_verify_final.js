import { query, initializeDatabase } from './db.js';

async function verify() {
    await initializeDatabase();
    const assignmentId = 147;
    const allocations = query("SELECT * FROM project_allocations WHERE assignment_id = ? LIMIT 10", [assignmentId]);
    console.log(`Allocations for Assignment ${assignmentId}:`, allocations.length);
    allocations.forEach(a => console.log(`  - ${a.period_date}: ${a.value}`));
}

verify();
