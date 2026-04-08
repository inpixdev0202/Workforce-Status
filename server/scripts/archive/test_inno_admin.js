import pg from 'pg';
const { Pool } = pg;

const url = "postgresql://inno_admin:npg_lLf1PiMZxvb3@ep-falling-rain-a1gdu0br-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function run() {
    console.log('--- Testing inno_admin Account ---');
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
        const time = await pool.query('SELECT NOW()');
        console.log('✅ inno_admin Connection Success! Server time:', time.rows[0].now);
        return true;
    } catch (e) {
        console.log('❌ Still Failed:', e.message);
        return false;
    } finally {
        await pool.end();
    }
}

run();
