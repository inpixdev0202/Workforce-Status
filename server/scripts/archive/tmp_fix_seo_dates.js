import { query, run, initializeDatabase } from './db.js';

async function fixAndVerify() {
    await initializeDatabase();

    const assignmentId = 147;
    const startDate = '2026-03-01';
    const endDate = '2026-12-31';

    console.log(`--- Updating Assignment ${assignmentId} with dates ${startDate} ~ ${endDate} ---`);
    run("UPDATE project_assignments SET input_start_date = ?, input_end_date = ? WHERE id = ?", [startDate, endDate, assignmentId]);

    // Check if some allocations already exist (they shouldn't)
    const count = query("SELECT COUNT(*) as count FROM project_allocations WHERE assignment_id = ?", [assignmentId])[0].count;
    console.log(`Current allocations: ${count}`);

    // I can't easily trigger the frontend's auto-allocation from here, 
    // but the frontend should do it once it sees the dates, 
    // OR the user can manually trigger it.

    const updated = query("SELECT * FROM project_assignments WHERE id = ?", [assignmentId])[0];
    console.log('Updated assignment:', updated);
}

fixAndVerify();
