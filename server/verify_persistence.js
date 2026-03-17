import db from './db.js';

async function verify() {
    await db.initializeDatabase();

    console.log('--- DB STATE BEFORE ---');
    const before = db.query('SELECT COUNT(*) as count FROM project_allocations WHERE assignment_id = 10');
    console.log('Allocations for ID 10:', before[0].count);

    console.log('--- RUNNING MANUAL BATCH INSERT ---');
    // Simulate what triggerAutoAllocation does
    const updates = [
        { assignment_id: 10, date: '2026-03-02', value: '1.0' },
        { assignment_id: 10, date: '2026-03-09', value: '0.8' }
    ];

    db.run('BEGIN TRANSACTION');
    for (const u of updates) {
        db.run('INSERT OR REPLACE INTO project_allocations (assignment_id, period_date, value) VALUES (?, ?, ?)', [u.assignment_id, u.date, u.value]);
    }
    db.run('COMMIT');

    console.log('--- DB STATE AFTER ---');
    const after = db.query('SELECT * FROM project_allocations WHERE assignment_id = 10 AND period_date LIKE "2026-03-%"');
    console.log('New Allocations:', after);
}

verify().catch(console.error);
