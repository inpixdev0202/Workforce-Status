import { get } from './db.js';
(async () => {
    try {
        const row10 = await get('SELECT * FROM project_reports WHERE week_date = ?', '2026-04-10');
        console.log('--- 2026-04-10 ---');
        if (row10) {
            const data = JSON.parse(row10.data_json);
            const rows = Array.isArray(data) ? data : (data.rows || []);
            console.log(`Updated: ${row10.updated_at}, Rows: ${rows.length}`);
            // Check if there are any rows with actual progress content
            const contentRows = rows.filter(r => r.progress && r.progress !== '-' && r.progress.trim() !== '');
            console.log(`Rows with content: ${contentRows.length}`);
            if (contentRows.length > 0) {
                console.log('Sample content rows:', JSON.stringify(contentRows.slice(0, 3), null, 2));
            } else {
                console.log('All rows have progress="-" or are empty.');
            }
        } else {
            console.log('Not found');
        }
    } catch (e) {
        console.error(e);
    }
    process.exit();
})();
