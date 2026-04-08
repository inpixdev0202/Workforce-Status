import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

// Use environment variable from .env
const connectionString = process.env.DATABASE_URL;

console.log('Testing connection to:', connectionString ? connectionString.split('@')[1] : 'UNDEFINED');

const pool = new Pool({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function test() {
    try {
        const res = await pool.query('SELECT NOW()');
        console.log('✅ Success! Server time:', res.rows[0].now);
        
        // Check for tables
        const tables = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('📊 Tables found:', tables.rows.length);
        tables.rows.forEach(t => console.log(' -', t.table_name));
        
    } catch (e) {
        console.error('❌ Failed! Error:', e.message);
    } finally {
        await pool.end();
    }
}
test();
