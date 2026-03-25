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
    console.log(`Migrating table: ${tableName}`);
    const rows = sqlite.prepare(`SELECT * FROM ${tableName}`).all();
    console.log(`Found ${rows.length} rows in ${tableName}`);
    
    if (rows.length === 0) return;

    for (const row of rows) {
        try {
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            // Handle missing columns from sqlite fallback gracefully
            const values = columns.map(col => row[col] !== undefined ? row[col] : null);
            const colNames = columns.join(', ');
            await pool.query(
                `INSERT INTO ${tableName} (${colNames}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
            );
        } catch (e) {
            console.error(`Failed to insert row into ${tableName}:`, row.id || row.week_date, e.message);
        }
    }
}

async function runMigration() {
    try {
        console.log('Testing PostgreSQL Connection...');
        await pool.query('SELECT NOW()');
        console.log('PostgreSQL connected.');

        // Initialize Postgres schema completely first by calling the new db adapter
        console.log('Ensuring Postgres Schema...');
        const { initializeDatabase } = await import('./db.js');
        await initializeDatabase();
        
        await migrateTable('groups', ['id', 'name', 'color', 'display_order', 'created_at']);
        
        await migrateTable('employees', [
            'id', 'group_id', 'name', 'position', 'skill_level', 'employment_type', 
            'join_date', 'retirement_date', 'contact_email', 'contact_phone', 
            'status', 'notes', 'exclude_from_stats', 'job_role', 'created_at', 'updated_at'
        ]);

        await migrateTable('users', ['id', 'name', 'email', 'password_hash', 'role', 'group_id', 'permissions', 'created_at']);
        
        await migrateTable('attendance', ['id', 'employee_id', 'date', 'status', 'hours', 'notes', 'created_at']);
        
        await migrateTable('projects', [
            'id', 'name', 'start_date', 'end_date', 'status', 'note', 'display_order', 'type', 'pd', 'pm', 'created_at'
        ]);

        await migrateTable('project_assignments', [
            'id', 'project_id', 'employee_id', 'role', 'input_start_date', 'input_end_date', 'display_order', 'work_location', 'created_at'
        ]);

        await migrateTable('project_allocations', [
            'id', 'assignment_id', 'period_date', 'value', 'created_at'
        ]);

        await migrateTable('integrations', ['id', 'name', 'description', 'url', 'icon_emoji', 'display_order', 'created_at']);

        await migrateTable('project_reports', ['week_date', 'data_json', 'updated_at']);

        // Since we explicitly inserted IDs into SERIAL columns, the Postgres sequence generator might be out of sync.
        // We must update the sequence for each table to the MAX(id) + 1.
        console.log('Updating Postgres sequences (SERIAL)...');
        const tablesWithSerial = ['groups', 'employees', 'users', 'attendance', 'projects', 'project_assignments', 'project_allocations', 'integrations'];
        for (const table of tablesWithSerial) {
            await pool.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id)+1 FROM "${table}"), 1), false)`);
            console.log(`Updated sequence for ${table}`);
        }

        console.log('🎉 Migration completely finished!');
    } catch (e) {
        console.error('Migration Error:', e);
    } finally {
        pool.end();
        sqlite.close();
    }
}

runMigration();
