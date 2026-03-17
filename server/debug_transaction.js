
import { run, get, initializeDatabase } from './db.js';

async function testBatchUpdate() {
    await initializeDatabase();

    // 1. Find a valid assignment
    const assignment = get('SELECT id FROM project_assignments LIMIT 1');
    if (!assignment) {
        console.log('No assignments found. Creating one...');
        // Create dummy if needed, but assuming seed data exists from previous context
        return;
    }
    const assignmentId = assignment.id;
    console.log(`Testing with Assignment ID: ${assignmentId}`);

    // 2. Prepare updates that might cause issues
    // Case A: Valid updates
    const updates = [
        { assignment_id: assignmentId, date: '2026-05-06', value: '0.8' },
        { assignment_id: assignmentId, date: '2026-05-07', value: '0.8' }
    ];

    console.log('--- STARTING BATCH TRANSACTION TEST ---');
    try {
        run('BEGIN TRANSACTION');

        for (const update of updates) {
            const { assignment_id, date, value } = update;
            console.log(`Processing ${date}: ${value}`);

            // Logic mirroring projects.js
            const existing = get(
                'SELECT id FROM project_allocations WHERE assignment_id = ? AND period_date = ?',
                [assignment_id, date]
            );

            if (existing) {
                run('UPDATE project_allocations SET value = ? WHERE id = ?', [value, existing.id]);
            } else {
                run(`
                    INSERT INTO project_allocations (assignment_id, period_date, value)
                    VALUES (?, ?, ?)
                `, [assignment_id, date, value]);
            }
        }

        run('COMMIT');
        console.log('--- COMMIT SUCCESS ---');
    } catch (err) {
        const fs = await import('fs');
        const errorLog = `
TIMESTAMP: ${new Date().toISOString()}
MESSAGE: ${err.message}
CODE: ${err.code}
STACK: ${err.stack}
        `;
        fs.writeFileSync('error_log.txt', errorLog);

        try {
            run('ROLLBACK');
            console.log('--- ROLLBACK SUCCESS ---');
        } catch (rbErr) {
            console.error('[ROLLBACK ERROR]', rbErr.message);
        }
    }
}

testBatchUpdate();
