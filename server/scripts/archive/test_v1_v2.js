import pg from 'pg';
const { Pool } = pg;

const v1 = "postgresql://neondb_owner:npg_xXsBYc7PG0lH@ep-small-sun-a12wz5x8-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";
const v2 = "postgresql://neondb_owner:npg_xXsBYc7PG01H@ep-small-sun-a12wz5x8-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require";

async function tryConn(url, name) {
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    try {
        await pool.query('SELECT 1');
        console.log(`✅ [${name}] Success! Password is correct.`);
        const res = await pool.query('SELECT count(*) FROM users');
        console.log(`📊 [${name}] User count:`, res.rows[0].count);
        return true;
    } catch (e) {
        console.log(`❌ [${name}] Failed:`, e.message);
        return false;
    } finally {
        await pool.end();
    }
}

async function run() {
    console.log('--- Starting Authentication Test ---');
    const s1 = await tryConn(v1, 'Version with lowercase L');
    const s2 = await tryConn(v2, 'Version with number 1');
    console.log('--- Test Finished ---');
}

run();
