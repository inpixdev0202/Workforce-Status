import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../server/.env') });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkProject() {
    try {
        const res = await pool.query("SELECT * FROM projects WHERE name LIKE '%신한은행%' OR name LIKE '%슈퍼%sol%'");
        console.log(JSON.stringify(res.rows, null, 2));
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkProject();
