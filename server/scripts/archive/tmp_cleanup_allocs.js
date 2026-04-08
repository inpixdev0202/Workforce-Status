import { query, run, initializeDatabase } from './db.js';

async function fix() {
    await initializeDatabase();

    const assignmentId = 147;
    const newEnd = '2026-03-31';

    console.log(`--- Fixing Assignment ${assignmentId} ---`);

    // 1. Update assignment end date
    run("UPDATE project_assignments SET input_end_date = ? WHERE id = ?", [newEnd, assignmentId]);
    console.log(`Updated end date to ${newEnd}`);

    // 2. Delete allocations beyond the new end date
    const deletedCount = run("DELETE FROM project_allocations WHERE assignment_id = ? AND period_date > ?", [assignmentId, newEnd]).changes;
    console.log(`Deleted ${deletedCount} allocations after ${newEnd}`);

    // 3. Verify
    const remaining = query("SELECT COUNT(*) as count FROM project_allocations WHERE assignment_id = ?", [assignmentId])[0].count;
    console.log(`Remaining allocations: ${remaining}`);
}

fix();
