import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkCounts() {
    try {
        const tables = ['groups', 'employees', 'projects', 'project_assignments', 'project_allocations', 'users'];
        for (const table of tables) {
            const res = await pool.query(`SELECT COUNT(*) as count FROM ${table}`);
            console.log(`${table}: ${res.rows[0].count} rows`);
        }
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkCounts();
