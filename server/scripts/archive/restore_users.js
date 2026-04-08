import Database from 'better-sqlite3';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const sqlite = new Database(join(__dirname, 'database.db'), { readonly: true });
const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function restoreUsers() {
    try {
        console.log('--- Cleaning up Neon Users ---');
        // Delete all users in Neon to start fresh
        // Cascading might be an issue if there are references, but usually not for users in this app
        await pool.query('DELETE FROM users');
        
        console.log('--- Fetching SQLite Users ---');
        const users = sqlite.prepare('SELECT * FROM users').all();
        console.log(`Found ${users.length} users in SQLite.`);

        const columns = ['id', 'name', 'email', 'password_hash', 'role', 'group_id', 'permissions', 'created_at'];

        for (const user of users) {
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map(col => user[col]);
            const colNames = columns.join(', ');
            
            await pool.query(
                `INSERT INTO users (${colNames}) VALUES (${placeholders})`,
                values
            );
            console.log(`Restored: ${user.email} (id: ${user.id})`);
        }

        console.log('--- Updating Sequence ---');
        await pool.query(`SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE((SELECT MAX(id) FROM users), 1), true)`);
        
        console.log('🎉 User restoration finished!');
    } catch (err) {
        console.error('Restoration Failed:', err);
    } finally {
        await pool.end();
        sqlite.close();
    }
}

restoreUsers();
