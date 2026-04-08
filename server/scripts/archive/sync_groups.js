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

async function run() {
    try {
        await pool.query('SELECT NOW()');
        const sqliteGroups = sqlite.prepare('SELECT * FROM groups').all();
        const { rows: neonGroups } = await pool.query('SELECT id FROM groups');
        const neonGroupIds = new Set(neonGroups.map(r => r.id));
        
        console.log('SQLite groups:', sqliteGroups.map(g => `${g.id}:${g.name}`));
        console.log('Neon group IDs:', [...neonGroupIds]);
        
        // Insert missing groups
        for (const g of sqliteGroups) {
            if (!neonGroupIds.has(g.id)) {
                console.log(`Adding missing group: ${g.id} - ${g.name}`);
                await pool.query(
                    'INSERT INTO groups (id, name, color, display_order) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
                    [g.id, g.name, g.color, g.display_order]
                );
            }
        }
        
        // Update sequence
        await pool.query(`SELECT setval(pg_get_serial_sequence('groups', 'id'), COALESCE((SELECT MAX(id) FROM groups), 1), true)`);
        
        const { rows: finalGroups } = await pool.query('SELECT id, name FROM groups ORDER BY id');
        console.log('Final Neon groups:', finalGroups);

        await pool.end();
        sqlite.close();
    } catch (err) {
        console.error(err);
    }
}

run();
