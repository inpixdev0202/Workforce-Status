import db from './db.js';

async function verify() {
    try {
        await db.initializeDatabase();
        const todayStr = new Date().toISOString().split('T')[0];

        const oldTotal = db.get('SELECT COUNT(*) as count FROM project_assignments').count;

        const newTotal = db.get(`
            SELECT COUNT(*) as count 
            FROM project_assignments pa
            JOIN projects p ON pa.project_id = p.id
            WHERE p.status = 'active'
              AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL)
              AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL)
        `, [todayStr, todayStr]).count;

        console.log('--- Active Assignments Verification ---');
        console.log('Old Count (All):', oldTotal);
        console.log('New Count (Active Today):', newTotal);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

verify();
