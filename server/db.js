import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Force node-postgres to return DATE (OID 1082) values as strings
// This avoids timezone shifting and mismatch with the frontend expectations
pg.types.setTypeParser(1082, function(val) {
    return val;
});

// Force BigInt (OID 20) and Numeric (OID 1700) to be returned as numbers
// The app doesn't handle numbers large enough to overflow MAX_SAFE_INTEGER
pg.types.setTypeParser(20, function(val) {
    return parseInt(val, 10);
});
pg.types.setTypeParser(1700, function(val) {
    return parseFloat(val);
});

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.FINAL_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
});

export const initializeDatabase = async () => {
    console.log('🔗 SYSTEM: Attempting to connect to Neon PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ SYSTEM: Connected to Neon PostgreSQL successfully.');
    client.release();
};

const formatQuery = (text) => {
    // Convert ? placeholders to $1, $2... for PostgreSQL
    let count = 0;
    return text.replace(/\?/g, () => `$${++count}`);
};

export const query = async (text, params) => {
    const formattedQuery = formatQuery(text);
    const res = await pool.query(formattedQuery, params);
    return res.rows;
};

export const get = async (text, params) => {
    const formattedQuery = formatQuery(text);
    const res = await pool.query(formattedQuery, params);
    return res.rows[0];
};

export const run = async (text, params) => {
    const formattedQuery = formatQuery(text);
    return await pool.query(formattedQuery, params);
};

export const getDB = () => pool;

export const saveDatabase = () => {};

export default {
    initializeDatabase,
    query,
    get,
    run,
    getDB,
    saveDatabase
};
