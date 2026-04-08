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
    console.log(`\nMigrating ${tableName}: ${rows.length} rows...`);
    if (rows.length === 0) return 0;
    let success = 0, failed = 0;
    for (const row of rows) {
        try {
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map(col => row[col] !== undefined ? row[col] : null);
            await pool.query(
                `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
                values
            );
            success++;
        } catch (e) {
            failed++;
        }
    }
    console.log(`  ✅ Inserted: ${success}, ⚠️ Skipped (FK/conflict): ${failed}`);
    return success;
}

async function run() {
    try {
        console.log('=== Full database re-migration ===');
        await pool.query('SELECT NOW()');
        console.log('Connected to Neon.');

        // Clear in reverse FK order
        console.log('\nClearing tables...');
        await pool.query('DELETE FROM project_allocations');
        await pool.query('DELETE FROM project_assignments');
        await pool.query('DELETE FROM projects');
        await pool.query('DELETE FROM attendance');
        await pool.query('DELETE FROM employees');
        console.log('All related tables cleared.');

        // Migrate in FK order
        await migrateTable('employees', [
            'id', 'group_id', 'name', 'position', 'skill_level', 'employment_type',
            'join_date', 'retirement_date', 'contact_email', 'contact_phone',
            'status', 'notes', 'exclude_from_stats', 'job_role', 'created_at', 'updated_at'
        ]);

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

        await migrateTable('attendance', [
            'id', 'employee_id', 'date', 'status', 'hours', 'notes', 'created_at'
        ]);

        // Sync sequences
        console.log('\nSyncing sequences...');
        for (const t of ['employees', 'projects', 'project_assignments', 'project_allocations', 'attendance']) {
            await pool.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), true)`);
        }

        // Final counts
        console.log('\n=== Final counts ===');
        for (const t of ['employees', 'projects', 'project_assignments', 'project_allocations', 'attendance', 'users']) {
            const res = await pool.query(`SELECT COUNT(*) as c FROM ${t}`);
            console.log(`${t}: ${res.rows[0].c} rows`);
        }

        console.log('\n🎉 Full migration complete!');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await pool.end();
        sqlite.close();
    }
}

run();
