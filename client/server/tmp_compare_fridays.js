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

async function checkRowCounts() {
    try {
        const dates = ['2026-03-27', '2026-04-03'];
        for (const date of dates) {
            const res = await pool.query("SELECT week_date, data_json FROM project_reports WHERE week_date = $1", [date]);
            if (res.rows.length > 0) {
                const data = JSON.parse(res.rows[0].data_json);
                const rows = Array.isArray(data) ? data : (data.rows || []);
                console.log(`Date: ${date} -> Total Rows: ${rows.length}`);
            } else {
                console.log(`Date: ${date} -> Report NOT found in DB.`);
            }
        }
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRowCounts();
