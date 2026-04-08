
import { getDB, saveDatabase, initializeDatabase, get } from './db.js';

async function testOptimizedBatch() {
    await initializeDatabase();
    const db = await getDB();

    console.log('--- STARTING OPTIMIZED TRANSACTION TEST ---');
    try {
        db.run('BEGIN TRANSACTION');
        console.log('Transaction Started');

        // Hardcoded updates for test
        const updates = [
            { assignment_id: 1, date: '2026-05-06', value: 0.8 },
            { assignment_id: 1, date: '2026-05-07', value: 0.8 }
        ];

        for (const update of updates) {
            const { assignment_id, date, value } = update;
            // We can use get() because it just reads, doesn't save
            const existing = get(
                'SELECT id FROM project_allocations WHERE assignment_id = ? AND period_date = ?',
                [assignment_id, date]
            );

            if (existing) {
                db.run('UPDATE project_allocations SET value = ? WHERE id = ?', [value, existing.id]);
                console.log(`Updated ${date}`);
            } else {
                db.run(`
                    INSERT INTO project_allocations (assignment_id, period_date, value)
                    VALUES (?, ?, ?)
                `, [assignment_id, date, value]);
                console.log(`Inserted ${date}`);
            }
        }

        db.run('COMMIT');
        console.log('--- COMMIT SUCCESS ---');

        saveDatabase(); // Save once at the end
        console.log('--- DATABASE SAVED ---');

    } catch (err) {
        console.error('[ERROR]', err);
        try {
            db.run('ROLLBACK');
            console.log('--- ROLLBACK SUCCESS ---');
        } catch (rbErr) {
            console.error('[ROLLBACK ERROR]', rbErr.message);
        }
    }
}

testOptimizedBatch();
