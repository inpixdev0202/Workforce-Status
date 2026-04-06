import db from './db.js';

async function verify() {
    try {
        await db.initializeDatabase();
        const todayStr = new Date().toISOString().split('T')[0];

        const countAllActive = db.get(`
            SELECT COUNT(*) as count 
            FROM project_assignments pa
            JOIN projects p ON pa.project_id = p.id
            WHERE p.status = 'active'
              AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL)
              AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL)
        `, [todayStr, todayStr]).count;

        const countClientOnly = db.get(`
            SELECT COUNT(*) as count 
            FROM project_assignments pa
            JOIN projects p ON pa.project_id = p.id
            WHERE p.status = 'active'
              AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL)
              AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL)
              AND p.type = 'Client'
        `, [todayStr, todayStr]).count;

        console.log('--- Active Assignments Verification (Client Only) ---');
        console.log('Active Today (Any Type):', countAllActive);
        console.log('Active Today (Client Only):', countClientOnly);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

verify();
