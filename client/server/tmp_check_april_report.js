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

async function checkAprilReport() {
    try {
        const res = await pool.query("SELECT week_date, data_json FROM project_reports WHERE week_date = '2026-04-03'");
        if (res.rows.length > 0) {
            const data = JSON.parse(res.rows[0].data_json);
            const rows = Array.isArray(data) ? data : (data.rows || []);
            console.log(`April 3rd Report: ${rows.length} rows found.`);
            console.log("First 3 project names:");
            rows.slice(0, 3).forEach(r => console.log(`  - ${r.projectName}`));
        } else {
            console.log("April 3rd Report is EMPTY in DB.");
        }
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkAprilReport();
