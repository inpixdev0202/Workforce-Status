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
    console.log(`\n📦 Migrating table: ${tableName}`);
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    console.log(`- Found ${rows.length} rows in SQLite`);
    
    if (rows.length === 0) return;

    let successCount = 0;
    let failCount = 0;

    for (const row of rows) {
        try {
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map(col => row[col] !== undefined ? row[col] : null);
            const colNames = columns.join(', ');
            await pool.query(
                `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
            );
            successCount++;
        } catch (e) {
            failCount++;
            // Only log first 5 errors to avoid spamming
            if (failCount <= 5) {
                console.error(`- Error in ${tableName} (ID: ${row.id || row.week_date}): ${e.message}`);
            }
        }
    }
    console.log(`- Success: ${successCount}, Failed: ${failCount}`);
}

async function runMigration() {
    try {
        console.log('🚀 Starting Robust Migration to Neon...');
        await pool.query('SELECT NOW()');
        console.log('✅ Connected to Postgres.');

        // 1. Initialize Schema
        console.log('🛠️ Ensuring table structures exist...');
        const { initializeDatabase } = await import('./db.js');
        await initializeDatabase();

        // 2. Clear existing data (in reverse order of dependencies)
        console.log('🧹 Clearing fresh database for a clean start...');
        const tablesToClear = ['project_allocations', 'project_assignments', 'attendance', 'users', 'projects', 'employees', 'groups', 'integrations', 'project_reports'];
        for (const table of tablesToClear) {
            await pool.query(`DELETE FROM "${table}"`);
        }

        // 3. Migrate data in correct dependency order
        // Level 0 (No dependencies)
        await migrateTable('groups', ['id', 'name', 'color', 'display_order', 'created_at']);
        await migrateTable('integrations', ['id', 'name', 'description', 'url', 'icon_emoji', 'display_order', 'created_at']);
        await migrateTable('project_reports', ['week_date', 'data_json', 'updated_at']);

        // Level 1
        await migrateTable('employees', [
            'id', 'group_id', 'name', 'position', 'skill_level', 'employment_type', 
            'join_date', 'retirement_date', 'contact_email', 'contact_phone', 
            'status', 'notes', 'exclude_from_stats', 'job_role', 'created_at', 'updated_at'
        ]);
        await migrateTable('projects', [
            'id', 'name', 'start_date', 'end_date', 'status', 'note', 'display_order', 'type', 'pd', 'pm', 'created_at'
        ]);

        // Level 2 (Depends on groups, employees)
        await migrateTable('users', ['id', 'name', 'email', 'password_hash', 'role', 'group_id', 'permissions', 'created_at']);
        await migrateTable('attendance', ['id', 'employee_id', 'date', 'status', 'hours', 'notes', 'created_at']);

        // Level 3 (Depends on projects, employees)
        await migrateTable('project_assignments', [
            'id', 'project_id', 'employee_id', 'role', 'input_start_date', 'input_end_date', 'display_order', 'work_location', 'created_at'
        ]);

        // Level 4 (Depends on assignments)
        await migrateTable('project_allocations', [
            'id', 'assignment_id', 'period_date', 'value', 'created_at'
        ]);

        // 4. Update Sequences
        console.log('\n🔄 Synchronizing ID generators (SERIAL sequences)...');
        const tablesWithSerial = ['groups', 'employees', 'users', 'attendance', 'projects', 'project_assignments', 'project_allocations', 'integrations'];
        for (const table of tablesWithSerial) {
            await pool.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1), true)`);
            console.log(`- Updated sequence for: ${table}`);
        }

        console.log('\n✨ 🎉 DATA MIGRATION COMPLETE! 🎉 ✨');
        console.log('You can now log in to the application.');

    } catch (e) {
        console.error('❌ Migration Critical Error:', e);
    } finally {
        pool.end();
        sqlite.close();
    }
}

runMigration();
