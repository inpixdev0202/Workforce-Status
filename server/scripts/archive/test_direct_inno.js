import pg from 'pg';
const { Client } = pg;

// DIRECT HOST (No pooler)
const config = {
    user: 'inno_admin',
    password: 'npg_lLf1PiMZxvb3',
    host: 'ep-falling-rain-a1gdu0br.ap-southeast-1.aws.neon.tech',
    database: 'neondb',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    },
};

async function run() {
    console.log('--- Direct Host inno_admin Verification ---');
    const client = new Client(config);
    try {
        await client.connect();
        console.log('✅ [DIRECT-INNO] Success! Connection established.');
        const res = await client.query('SELECT NOW()');
        console.log('Server time:', res.rows[0].now);
    } catch (e) {
        console.log('❌ [DIRECT-INNO] Failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
