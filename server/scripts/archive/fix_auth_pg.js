import pkg from 'pg';
const { Pool } = pkg;
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixAuth() {
    try {
        const email = 'admin@inpix.com';
        const password = 'admin123';
        const salt = await bcrypt.genSalt(10);
        const hash = await bcrypt.hash(password, salt);

        const res = await pool.query('UPDATE users SET password_hash = $1 WHERE email = $2 RETURNING id', [hash, email]);
        
        if (res.rowCount > 0) {
            console.log(`Successfully updated password for ${email} to "admin123"`);
        } else {
            console.log(`User ${email} not found. Creating...`);
            await pool.query('INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)', 
                ['System Admin', email, hash, 'Admin']);
            console.log(`Successfully created user ${email} with password "admin123"`);
        }
        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixAuth();
