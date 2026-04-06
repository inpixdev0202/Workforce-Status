import { get, query, initializeDatabase } from './db.js';

async function checkReports() {
    await initializeDatabase();
    try {
        const dates = ['2026-03-27', '2026-04-03', '2026-04-10'];
        for (const date of dates) {
            const row = await get("SELECT * FROM project_reports WHERE week_date = ?", [date]);
            if (row) {
                const data = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
                const rows = Array.isArray(data) ? data : (data.rows || []);
                const shinhan = rows.find(r => r.projectName && r.projectName.includes('신한은행'));
                console.log(`[${date}] Total rows: ${rows.length}. Shinhan SOL exists: ${shinhan ? 'YES' : 'NO'}`);
                if (shinhan) {
                    console.log(`   -> Name: ${shinhan.projectName}, Category: ${shinhan.category}, Progress: ${shinhan.progress}`);
                }
            } else {
                console.log(`[${date}] No report saved for this week.`);
            }
        }
    } catch (e) {
        console.error("Query error:", e.message);
    }
    process.exit(0);
}

checkReports();
