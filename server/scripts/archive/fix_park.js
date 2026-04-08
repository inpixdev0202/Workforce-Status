import db from './db.js';
import { format, startOfWeek, eachWeekOfInterval, parseISO } from 'date-fns';

async function fixPark() {
    await db.initializeDatabase();

    // Park Moon-hong's assignment ID discovered earlier was 7.
    const assignmentId = 7;
    const assignment = db.get('SELECT * FROM project_assignments WHERE id = ?', [assignmentId]);

    if (!assignment) {
        console.error('Assignment not found');
        return;
    }

    const startD = parseISO(assignment.input_start_date);
    const endD = parseISO(assignment.input_end_date);

    if (isNaN(startD) || isNaN(endD)) {
        console.error('Invalid dates');
        return;
    }

    const start = startOfWeek(startD, { weekStartsOn: 1 });
    const allWeeks = eachWeekOfInterval({ start, end: endD }, { weekStartsOn: 1 });

    db.run('BEGIN TRANSACTION');
    let count = 0;
    for (const week of allWeeks) {
        const dStr = format(week, 'yyyy-MM-dd');
        db.run('INSERT OR IGNORE INTO project_allocations (assignment_id, period_date, value) VALUES (?, ?, ?)', [assignmentId, dStr, 1.0]);
        count++;
    }
    db.run('COMMIT');
    console.log(`✅ Successfully added ${count} allocations for Park Moon-hong.`);
}

fixPark().catch(console.error);
