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

async function migrateTable(tableName, columns) {
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    console.log(`Migrating ${tableName}: ${rows.length} rows...`);

    if (rows.length === 0) return;

    await pool.query(`DELETE FROM ${tableName}`);
    console.log(`  Cleared existing ${tableName} data.`);

    for (const row of rows) {
        try {
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map(col => row[col] !== undefined ? row[col] : null);
            const colNames = columns.join(', ');
            await pool.query(
                `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders})`,
                values
            );
        } catch (e) {
            console.error(`  Failed to insert row into ${tableName}:`, row.id, e.message);
        }
    }
    console.log(`  Done: ${tableName}`);
}

async function run() {
    try {
        console.log('=== Starting targeted migration ===');
        await pool.query('SELECT NOW()');
        console.log('Connected to Neon.');

        // Reset foreign key dependent tables in order
        await pool.query('DELETE FROM project_allocations');
        await pool.query('DELETE FROM project_assignments');
        await pool.query('DELETE FROM projects');
        console.log('Cleared project-related tables.');

        await migrateTable('projects', [
            'id', 'name', 'start_date', 'end_date', 'status', 'note',
            'display_order', 'type', 'pd', 'pm', 'created_at'
        ]);

        await migrateTable('project_assignments', [
            'id', 'project_id', 'employee_id', 'role', 'input_start_date',
            'input_end_date', 'display_order', 'work_location', 'created_at'
        ]);

        await migrateTable('project_allocations', [
            'id', 'assignment_id', 'period_date', 'value', 'created_at'
        ]);

        // Sync sequences
        console.log('Syncing sequences...');
        for (const table of ['projects', 'project_assignments', 'project_allocations']) {
            await pool.query(`SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), true)`);
        }

        console.log('🎉 Migration complete!');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await pool.end();
        sqlite.close();
    }
}

run();
