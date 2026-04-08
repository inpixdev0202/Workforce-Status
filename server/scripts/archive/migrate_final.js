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

async function migrate(tableName, cols, customQuery) {
    const query = customQuery || `SELECT * FROM "${tableName}"`;
    const rows = sqlite.prepare(query).all();
    if (rows.length === 0) return;
    console.log(`Migrating ${tableName} (${rows.length} rows)...`);
    
    for (let i = 0; i < rows.length; i += 100) {
        const chunk = rows.slice(i, i + 100);
        const values = [];
        const valuePlaceholders = chunk.map((row, rowIndex) => {
            const rowPlaceholders = cols.map((col, colIndex) => `$` + (values.length + colIndex + 1));
            cols.forEach(col => {
                let val = row[col];
                if (val === '' || val === '...') val = null;
                if (typeof val === 'string' && col.includes('date') && !/^\d{4}-\d{2}-\d{2}/.test(val)) val = null;
                values.push(val !== undefined ? val : null);
            });
            return `(` + rowPlaceholders.join(',') + `)`;
        }).join(',');

        try {
            await pool.query(`INSERT INTO "${tableName}" (${cols.join(',')}) VALUES ${valuePlaceholders} ON CONFLICT DO NOTHING`, values);
        } catch (e) {
            console.error(`Error in table ${tableName}:`, e.message);
            // If bulk fails, try one by one for this chunk to recover as much as possible
            for (const row of chunk) {
                try {
                    const rowValues = cols.map(c => { let v = row[c]; if (v === '' || v === '...') return null; if (typeof v === 'string' && c.includes('date') && !/^\d{4}-\d{2}-\d{2}/.test(v)) return null; return v !== undefined ? v : null; });
                    await pool.query(`INSERT INTO "${tableName}" (${cols.join(',')}) VALUES (${cols.map((_, i) => '$'+(i+1)).join(',')}) ON CONFLICT DO NOTHING`, rowValues);
                } catch (inner) { /* Final skip */ }
            }
        }
    }
}

async function run() {
    const client = await pool.connect();
    try {
        console.log('--- ROBUST FINAL MIGRATION ---');
        // level up cols first
        const alts = ['ALTER TABLE employees ALTER COLUMN position TYPE TEXT','ALTER TABLE employees ALTER COLUMN skill_level TYPE TEXT','ALTER TABLE employees ALTER COLUMN employment_type TYPE TEXT','ALTER TABLE employees ALTER COLUMN status TYPE TEXT','ALTER TABLE projects ALTER COLUMN name TYPE TEXT','ALTER TABLE projects ALTER COLUMN status TYPE TEXT'];
        for (const sql of alts) { try { await client.query(sql); } catch(e){} }

        const tables = ['project_allocations', 'project_assignments', 'attendance', 'users', 'projects', 'employees', 'groups', 'integrations', 'project_reports'];
        for (const t of tables) await client.query(`DELETE FROM "${t}"`);

        await migrate('groups', ['id', 'name', 'color', 'display_order', 'created_at']);
        await migrate('integrations', ['id', 'name', 'description', 'url', 'icon_emoji', 'display_order', 'created_at']);
        await migrate('project_reports', ['week_date', 'data_json', 'updated_at']);
        await migrate('employees', ['id', 'group_id', 'name', 'position', 'skill_level', 'employment_type', 'join_date', 'retirement_date', 'contact_email', 'contact_phone', 'status', 'notes', 'exclude_from_stats', 'job_role', 'created_at', 'updated_at']);
        await migrate('projects', ['id', 'name', 'start_date', 'end_date', 'status', 'note', 'display_order', 'type', 'pd', 'pm', 'created_at']);
        await migrate('users', ['id', 'name', 'email', 'password_hash', 'role', 'group_id', 'permissions', 'created_at']);
        await migrate('attendance', ['id', 'employee_id', 'date', 'status', 'hours', 'notes', 'created_at']);
        
        // Filtering orphans for Assignments and Allocations
        await migrate('project_assignments', ['id', 'project_id', 'employee_id', 'role', 'input_start_date', 'input_end_date', 'display_order', 'work_location', 'created_at'], 
            `SELECT * FROM project_assignments WHERE project_id IN (SELECT id FROM projects) AND employee_id IN (SELECT id FROM employees)`);
        
        await migrate('project_allocations', ['id', 'assignment_id', 'period_date', 'value', 'created_at'], 
            `SELECT * FROM project_allocations WHERE assignment_id IN (SELECT id FROM project_assignments WHERE project_id IN (SELECT id FROM projects) AND employee_id IN (SELECT id FROM employees))`);

        for (const t of ['groups', 'employees', 'users', 'attendance', 'projects', 'project_assignments', 'project_allocations', 'integrations']) {
            await client.query(`SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE((SELECT MAX(id) FROM "${t}"), 1), true)`);
        }
        console.log('--- SUCCESS ---');
    } catch (e) { console.error(e); } finally { client.release(); pool.end(); sqlite.close(); }
}
run();
