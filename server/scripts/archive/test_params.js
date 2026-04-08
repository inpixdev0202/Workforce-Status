import pg from 'pg';
const { Client } = pg;

// DECONSTRUCTED URL
// URL: postgresql://neondb_owner:npg_kZg4AmfJsOt6@ep-odd-shadow-a1sur19o-pooler.ap-southeast-1.aws.neon.tech/neondb

const config = {
    user: 'neondb_owner',
    password: 'npg_kZg4AmfJsOt6',
    host: 'ep-odd-shadow-a1sur19o-pooler.ap-southeast-1.aws.neon.tech',
    database: 'neondb',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
};

async function run() {
    console.log('--- Parameter-based Verification ---');
    const client = new Client(config);
    try {
        await client.connect();
        console.log('✅ [PARAMS] Success! Connection established.');
        const res = await client.query('SELECT NOW()');
        console.log('Server time:', res.rows[0].now);
    } catch (e) {
        console.log('❌ [PARAMS] Failed:', e.message);
        console.log('Stack:', e.stack);
    } finally {
        await client.end();
    }
}

run();
