import db from './db.js';

async function verify() {
    try {
        await db.initializeDatabase();

        // Test batch-like behavior
        const assignmentId = 4; // Kim Ga-yeon in Project 1? No, ID 10 was Kim Ga-yeon earlier.
        const res = db.query('SELECT id FROM project_assignments WHERE employee_id = 4 AND project_id = 1');
        const aId = res[0]?.id || 10;

        console.log(`Verifying for assignment ID ${aId}`);

        db.run('INSERT OR REPLACE INTO project_allocations (assignment_id, period_date, value) VALUES (?, ?, ?)', [aId, '2026-04-06', '1.0']);
        db.run('INSERT OR REPLACE INTO project_allocations (assignment_id, period_date, value) VALUES (?, ?, ?)', [aId, '2026-04-13', '0.5']);

        const check = db.query('SELECT * FROM project_allocations WHERE assignment_id = ? AND period_date LIKE "2026-04-%"', [aId]);
        console.log('Results:', check);

        if (check.length >= 2) {
            console.log('✅ Persistence verified successfully');
        } else {
            console.log('❌ Persistence check failed');
        }
    } catch (err) {
        console.error('VERIFY ERROR:', err);
    } finally {
        process.exit(0);
    }
}

verify();
