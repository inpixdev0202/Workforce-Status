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
        const res = await pool.query("SELECT week_date, data_json FROM project_reports WHERE week_date BETWEEN '2026-03-01' AND '2026-04-10' ORDER BY week_date");
        
        for (const row of res.rows) {
            const data = JSON.parse(row.data_json);
            const rows = Array.isArray(data) ? data : (data.rows || []);
            const foundCount = rows.filter(r => r.projectName && r.projectName.includes("신한은행")).length;
            const dateStr = new Date(row.week_date).toISOString().split('T')[0];
            console.log(`${dateStr}: ${foundCount}`);
        }
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkReports();
