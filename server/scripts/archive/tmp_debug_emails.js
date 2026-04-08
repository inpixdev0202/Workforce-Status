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

async function checkExactEmail() {
    try {
        const res = await pool.query('SELECT id, email, length(email) as len FROM users');
        console.log('--- EXACT EMAIL DUMP ---');
        res.rows.forEach(r => {
            console.log(`ID: ${r.id}, Email: [${r.email}], Length: ${r.len}`);
        });
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkExactEmail();
