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

async function verifyLogin() {
    const email = 'inno@inpix.com';
    const password = '@inpix1234';

    try {
        const res = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (res.rows.length === 0) {
            console.log(`❌ User ${email} not found in database.`);
            return;
        }

        const user = res.rows[0];
        console.log(`✅ User found: ${user.name} (${user.email})`);
        console.log(`Hash in DB: ${user.password_hash}`);

        const isValid = await bcrypt.compare(password, user.password_hash);
        if (isValid) {
            console.log('✨ Password Match! Login should work.');
        } else {
            console.log('❌ Password Mismatch! The hash in DB does not match "@inpix1234".');
        }
    } catch (err) {
        console.error('Error during verification:', err);
    } finally {
        await pool.end();
    }
}

verifyLogin();
