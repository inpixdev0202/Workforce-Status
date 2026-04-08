import pg from 'pg';
const { Pool } = pg;

// EXACT STRING FROM VERCEL, but simplified options for local compatibility
const rawUrl = "postgresql://neondb_owner:npg_xXsBYc7PG0lH@ep-small-sun-a12wz5x8-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function run() {
    console.log('--- Final Key Verification ---');
    const pool = new Pool({ connectionString: rawUrl, ssl: { rejectUnauthorized: false } });
    try {
        const time = await pool.query('SELECT NOW()');
        console.log('✅ Connection Success! Server time:', time.rows[0].now);
        const count = await pool.query('SELECT count(*) FROM users');
        console.log('📊 DATA VERIFIED: User count is', count.rows[0].count);
        console.log('🚀 WE FOUND THE DATA!');
    } catch (e) {
        console.log('❌ Still Failed:', e.message);
        console.log('Detail:', e.detail);
    } finally {
        await pool.end();
    }
}

run();
