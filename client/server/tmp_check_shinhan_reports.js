import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkReports() {
    try {
        console.log("Checking reports for 2026-03-06 and 2026-04-03...");
        const res = await pool.query("SELECT week_date, data_json FROM project_reports WHERE week_date IN ('2026-03-06', '2026-04-03') ORDER BY week_date");
        
        for (const row of res.rows) {
            const data = JSON.parse(row.data_json);
            const rows = Array.isArray(data) ? data : (data.rows || []);
            const found = rows.find(r => r.projectName && r.projectName.includes("신한은행"));
            console.log(`Date: ${row.week_date}`);
            if (found) {
                console.log(`  Found project: ${JSON.stringify(found, null, 2)}`);
            } else {
                console.log(`  Project NOT found in this week's report.`);
            }
        }
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkReports();
