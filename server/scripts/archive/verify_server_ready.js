import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Force load exactly from server/.env
dotenv.config({ path: '.env' });

const { Pool } = pg;

async function run() {
    console.log('--- Server Readiness Final Check ---');
    console.log('Target URL prefix:', process.env.DATABASE_URL?.substring(0, 40));
    
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        const res = await pool.query("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'");
        console.log('✅ Found tables:', res.rows.map(r => r.tablename).join(', '));
        
        if (!res.rows.find(r => r.tablename === 'users')) {
            console.log('⚠️ USERS table missing. App likely needs a refresh/seed.');
        } else {
            console.log('🚀 DB is ONLINE and READY for login!');
        }
    } catch (e) {
        console.log('❌ Server Check Failed:', e.message);
    } finally {
        await pool.end();
    }
}

run();
