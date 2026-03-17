import { query, run, initializeDatabase } from './db.js';
import { eachWeekOfInterval, startOfWeek, format, parseISO } from 'date-fns';

async function populateAllocations() {
    await initializeDatabase();

    const assignmentId = 147;
    const assignment = query("SELECT * FROM project_assignments WHERE id = ?", [assignmentId])[0];

    if (!assignment || !assignment.input_start_date || !assignment.input_end_date) {
        console.log('Assignment dates not set');
        return;
    }

    const start = startOfWeek(parseISO(assignment.input_start_date), { weekStartsOn: 1 });
    const end = parseISO(assignment.input_end_date);

    const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 1 });

    console.log(`--- Populating ${weeks.length} weeks for Assignment ${assignmentId} ---`);

    run('BEGIN TRANSACTION');
    try {
        for (const week of weeks) {
            const dateStr = format(week, 'yyyy-MM-dd');
            // Check existing
            const existing = query("SELECT id FROM project_allocations WHERE assignment_id = ? AND period_date = ?", [assignmentId, dateStr])[0];

            if (!existing) {
                run("INSERT INTO project_allocations (assignment_id, period_date, value) VALUES (?, ?, ?)", [assignmentId, dateStr, '1.0']);
            }
        }
        run('COMMIT');
        console.log('Done.');
    } catch (e) {
        run('ROLLBACK');
        console.error(e);
    }
}

populateAllocations();
