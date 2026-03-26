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

async function checkUsers() {
    try {
        const res = await pool.query('SELECT name, email, role FROM users');
        console.log('--- USERS IN DATABASE ---');
        console.table(res.rows);
        await pool.end();
    } catch (err) {
        console.error('Error checking users:', err);
        process.exit(1);
    }
}

checkUsers();
