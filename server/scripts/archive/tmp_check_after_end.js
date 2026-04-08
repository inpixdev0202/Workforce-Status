import { query, initializeDatabase } from './db.js';

async function check() {
    await initializeDatabase();

    const assignmentId = 147;
    const assignment = query("SELECT * FROM project_assignments WHERE id = ?", [assignmentId])[0];
    console.log('Current Assignment:', assignment);

    if (assignment) {
        const afterEnd = query(`
            SELECT * FROM project_allocations 
            WHERE assignment_id = ? AND period_date > '2026-03-31'
            ORDER BY period_date ASC
        `, [assignmentId]);

        console.log('\n--- Allocations AFTER 2026-03-31 ---');
        console.log('Count:', afterEnd.length);
        afterEnd.slice(0, 10).forEach(a => console.log(`  - ${a.period_date}: ${a.value}`));
    }
}

check();
