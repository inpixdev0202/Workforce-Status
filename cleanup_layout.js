const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(__dirname, 'server', 'database.sqlite');
const db = new Database(dbPath);

const dates = ['2026-03-13', '2026-03-20'];
const DEFAULT_COLUMN_WIDTHS = {
    projectName: 320, pd: 150, mainContractor: 150, estimatedAmount: 120,
    progress: 180, kickoff: 120, rfpInfo: 120, proposal: 120, pt: 100,
    status: 500, plan: 150, clientInfo: 200, health: 100, category: 80, manage: 60
};

dates.forEach(date => {
    const row = db.prepare('SELECT data_json FROM project_reports WHERE report_date = ?').get(date);
    if (row) {
        try {
            let data = JSON.parse(row.data_json);
            if (data.rows) {
                data.columnWidths = DEFAULT_COLUMN_WIDTHS;
                data.rowHeights = { header: 36 };
                data.rows = data.rows.map(r => ({ ...r, rowHeight: 80 }));
                db.prepare('UPDATE project_reports SET data_json = ? WHERE report_date = ?')
                  .run(JSON.stringify(data), date);
                console.log(`✅ Updated ${date} layout successfully.`);
            } else if (Array.isArray(data)) {
                // Already default effectively as it has no layout metadata
                console.log(`ℹ️ ${date} is already in legacy format (no layout metadata).`);
            }
        } catch (e) {
            console.error(`❌ Error parsing/updating ${date}:`, e.message);
        }
    } else {
        console.log(`❓ ${date} not found in DB.`);
    }
});
db.close();
