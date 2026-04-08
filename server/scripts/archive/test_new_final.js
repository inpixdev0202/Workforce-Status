import pg from 'pg';
const { Pool } = pg;

const newUrl = "postgresql://neondb_owner:npg_kZg4AmfJsOt6@ep-odd-shadow-a1sur19o-pooler.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require";

async function run() {
    console.log('--- Testing NEW Database ---');
    const pool = new Pool({ connectionString: newUrl, ssl: { rejectUnauthorized: false } });
    try {
        const time = await pool.query('SELECT NOW()');
        console.log('✅ NEW Connection Success! Server time:', time.rows[0].now);
    } catch (e) {
        console.log('❌ Still Failed:', e.message);
    } finally {
        await pool.end();
    }
}

run();
