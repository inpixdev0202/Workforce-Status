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

async function migrateTableBatch(tableName, columns) {
    console.log(`\n📦 Fast Migrating: ${tableName}`);
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    console.log(`- Total ${rows.length} rows to move`);
    
    if (rows.length === 0) return;

    let successCount = 0;
    let failCount = 0;
    let firstError = null;

    for (const row of rows) {
        try {
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map(col => row[col] !== undefined ? row[col] : null);
            await pool.query(`INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`, values);
            successCount++;
        } catch (e) {
            failCount++;
            if (!firstError) firstError = e.message;
        }
    }
    
    if (firstError) console.error(`- First Error in ${tableName}: ${firstError}`);
    console.log(`- Final Status: Success ${successCount}, Failed ${failCount}`);
}

async function run() {
    try {
        console.log('🚀 Starting Debug Migration...');
        await pool.query('SELECT NOW()');
        
        // Clean start
        const tablesToClear = ['project_allocations', 'project_assignments', 'attendance', 'users', 'projects', 'employees', 'groups', 'integrations', 'project_reports'];
        for (const table of tablesToClear) await pool.query(`DELETE FROM "${table}"`);

        await migrateTableBatch('groups', ['id', 'name', 'color', 'display_order', 'created_at']);
        await migrateTableBatch('integrations', ['id', 'name', 'description', 'url', 'icon_emoji', 'display_order', 'created_at']);
        await migrateTableBatch('project_reports', ['week_date', 'data_json', 'updated_at']);
        await migrateTableBatch('employees', ['id', 'group_id', 'name', 'position', 'skill_level', 'employment_type', 'join_date', 'retirement_date', 'contact_email', 'contact_phone', 'status', 'notes', 'exclude_from_stats', 'job_role', 'created_at', 'updated_at']);
        await migrateTableBatch('projects', ['id', 'name', 'start_date', 'end_date', 'status', 'note', 'display_order', 'type', 'pd', 'pm', 'created_at']);
        await migrateTableBatch('users', ['id', 'name', 'email', 'password_hash', 'role', 'group_id', 'permissions', 'created_at']);
        await migrateTableBatch('attendance', ['id', 'employee_id', 'date', 'status', 'hours', 'notes', 'created_at']);
        await migrateTableBatch('project_assignments', ['id', 'project_id', 'employee_id', 'role', 'input_start_date', 'input_end_date', 'display_order', 'work_location', 'created_at']);
        await migrateTableBatch('project_allocations', ['id', 'assignment_id', 'period_date', 'value', 'created_at']);

        console.log('\nMigration attempted. Check success/fail counts.');
    } catch (e) { console.error(e); } finally {
        pool.end();
        sqlite.close();
    }
}
run();
