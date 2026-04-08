import Database from 'better-sqlite3';
import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const sqlite = new Database(join(__dirname, '../database.db'), { readonly: true });
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

async function migrateTable(tableName, columns, pkName = 'id') {
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    console.log(`\nMigrating ${tableName}: ${rows.length} rows...`);
    if (rows.length === 0) {
        console.log(`  ℹ️ No data to migrate for ${tableName}`);
        return 0;
    }
    
    let success = 0, failed = 0;
    for (const row of rows) {
        try {
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const values = columns.map(col => {
                const val = row[col];
                // Convert empty strings to null for PG compatibility (especially for dates/numbers)
                if (val === "" || val === undefined) return null;
                return val;
            });
            await pool.query(
                `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${pkName}) DO UPDATE SET ${columns.filter(c => c !== pkName).map((c, i) => `${c} = EXCLUDED.${c}`).join(', ')}`,
                values
            );
            success++;
        } catch (e) {
            console.error(`  ❌ Failed row in ${tableName}:`, e.message);
            failed++;
        }
    }
    console.log(`  ✅ Processed: ${success}, ⚠️ Errors: ${failed}`);
    return success;
}

async function run() {
    try {
        console.log('=== Starting Full Database Migration: SQLite -> Neon PostgreSQL ===');
        await pool.query('SELECT NOW()');
        
        // 1. Groups
        await migrateTable('groups', ['id', 'name', 'color', 'display_order', 'created_at']);
        
        // 2. Users (Crucial for Login)
        await migrateTable('users', ['id', 'name', 'email', 'password_hash', 'role', 'group_id', 'permissions', 'created_at']);

        // 3. Employees
        await migrateTable('employees', [
            'id', 'group_id', 'name', 'position', 'skill_level', 'employment_type',
            'join_date', 'retirement_date', 'contact_email', 'contact_phone',
            'status', 'notes', 'exclude_from_stats', 'job_role', 'created_at', 'updated_at'
        ]);

        // 4. Projects
        await migrateTable('projects', [
            'id', 'name', 'start_date', 'end_date', 'status', 'note',
            'display_order', 'type', 'pd', 'pm', 'created_at'
        ]);

        // 5. Project Assignments
        await migrateTable('project_assignments', [
            'id', 'project_id', 'employee_id', 'role', 'input_start_date',
            'input_end_date', 'display_order', 'work_location', 'created_at'
        ]);

        // 6. Project Allocations
        await migrateTable('project_allocations', [
            'id', 'assignment_id', 'period_date', 'value', 'created_at'
        ]);

        // 7. Attendance
        await migrateTable('attendance', [
            'id', 'employee_id', 'date', 'status', 'hours', 'notes', 'created_at'
        ]);

        // 8. Integrations
        await migrateTable('integrations', [
            'id', 'name', 'description', 'url', 'icon_emoji', 'display_order', 'created_at'
        ]);

        // 9. Project Reports
        await migrateTable('project_reports', ['week_date', 'data_json', 'updated_at'], 'week_date');

        // Sync Sequences (Crucial for SERIAL IDs in PG)
        console.log('\n🔄 Syncing PostgreSQL sequences...');
        const tablesWithSerial = [
            'groups', 'users', 'employees', 'projects', 'project_assignments', 
            'project_allocations', 'attendance', 'integrations'
        ];
        
        for (const t of tablesWithSerial) {
            try {
                await pool.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), true)`);
                console.log(`  ✅ Sequence synced for ${t}`);
            } catch (e) {
                console.error(`  ⚠️ Failed to sync sequence for ${t}:`, e.message);
            }
        }

        console.log('\n🎉 ALL DATA MIGRATED SUCCESSFULLY!');
    } catch (err) {
        console.error('\n❌ Critical Migration Error:', err);
    } finally {
        await pool.end();
        sqlite.close();
    }
}

run();
