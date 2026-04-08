import pg from 'pg';
const { Client } = pg;

// DIRECT HOST (removed -pooler)
const config = {
    user: 'neondb_owner',
    password: 'npg_kZg4AmfJsOt6',
    host: 'ep-odd-shadow-a1sur19o.ap-southeast-1.aws.neon.tech',
    database: 'neondb',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    },
};

async function run() {
    console.log('--- Direct Host Verification ---');
    const client = new Client(config);
    try {
        await client.connect();
        console.log('✅ [DIRECT] Success! Connection established.');
        const res = await client.query('SELECT NOW()');
        console.log('Server time:', res.rows[0].now);
    } catch (e) {
        console.log('❌ [DIRECT] Still Failed:', e.message);
    } finally {
        await client.end();
    }
}

run();
