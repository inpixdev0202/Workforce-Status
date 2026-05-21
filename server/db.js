import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true // Returns DATE values as strings matching frontend expectations
});

export const initializeDatabase = async () => {
    console.log('🔗 SYSTEM: Attempting to connect to MySQL Database...');
    const connection = await pool.getConnection();
    console.log('✅ SYSTEM: Connected to MySQL Database successfully.');
    connection.release();
};

const transformQuery = (text) => {
    let modifiedText = text;
    let returningColumn = null;
    
    // Extract and remove RETURNING clause
    const returningMatch = modifiedText.match(/RETURNING\s+([a-zA-Z0-9_]+)/i);
    if (returningMatch) {
        returningColumn = returningMatch[1];
        modifiedText = modifiedText.replace(/RETURNING\s+[a-zA-Z0-9_]+/i, '');
    }

    // Transform PostgreSQL ON CONFLICT to MySQL ON DUPLICATE KEY UPDATE
    modifiedText = modifiedText.replace(/ON\s+CONFLICT\s*\(([^)]+)\)\s*DO\s+UPDATE\s+SET\s+([a-zA-Z0-9_]+)\s*=\s*EXCLUDED\.([a-zA-Z0-9_]+)/i, 'ON DUPLICATE KEY UPDATE $2 = VALUES($3)');

    // Escape MySQL reserved keyword 'groups'
    modifiedText = modifiedText.replace(/(?<!`)\bgroups\b(?!`)/gi, '`groups`');
    
    // Remove PostgreSQL type cast '::TEXT' or '::text'
    modifiedText = modifiedText.replace(/::text/gi, '');

    return { modifiedText, returningColumn };
};

export const query = async (text, params) => {
    const { modifiedText } = transformQuery(text);
    const [rows] = await pool.query(modifiedText, params);
    return rows;
};

export const get = async (text, params) => {
    const { modifiedText } = transformQuery(text);
    const [rows] = await pool.query(modifiedText, params);
    return rows[0];
};

export const run = async (text, params) => {
    const { modifiedText, returningColumn } = transformQuery(text);
    const [result] = await pool.execute(modifiedText, params);
    
    // Mock PostgreSQL result format for RETURNING queries
    if (returningColumn && result.insertId) {
        result.rows = [{ [returningColumn]: result.insertId }];
    } else if (!result.rows) {
        result.rows = [];
    }
    
    return result;
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
