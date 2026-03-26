import Database from 'better-sqlite3';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const sqlite = new Database(join(__dirname, 'database.db'), { readonly: true });
const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        const rows = sqlite.prepare('SELECT * FROM project_allocations WHERE assignment_id = 34').all();
        console.log(`Found ${rows.length} rows in SQLite for assignment 34.`);
        
        for (const row of rows) {
            try {
                await pool.query(
                    'INSERT INTO project_allocations (id, assignment_id, period_date, value, created_at) VALUES ($1, $2, $3, $4, $5)',
                    [row.id, row.assignment_id, row.period_date, row.value, row.created_at]
                );
                console.log(`  ✅ Inserted allocation ${row.id}`);
            } catch (err) {
                console.log(`  ❌ Failed allocation ${row.id}: ${err.message}`);
                console.log('     Data:', JSON.stringify(row));
            }
        }
        await pool.end();
        sqlite.close();
    } catch (err) {
        console.error(err);
    }
}

run();
