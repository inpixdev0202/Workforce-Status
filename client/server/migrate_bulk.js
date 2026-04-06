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

const BATCH_SIZE = 500;

async function batchInsert(tableName, columns, rows) {
    let success = 0, failed = 0;
    
    // Get valid assignment_ids for FK checking
    let validIds = null;
    if (tableName === 'project_allocations') {
        const res = await pool.query('SELECT id FROM project_assignments');
        validIds = new Set(res.rows.map(r => r.id));
    }
    
    const validRows = rows.filter(row => {
        if (validIds && !validIds.has(row.assignment_id)) {
            failed++;
            return false;
        }
        return true;
    });

    // Insert in batches
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
        const batch = validRows.slice(i, i + BATCH_SIZE);
        try {
            const valuePlaceholders = batch.map((_, ri) => 
                `(${columns.map((_, ci) => `$${ri * columns.length + ci + 1}`).join(', ')})`
            ).join(', ');
            const values = batch.flatMap(row => columns.map(col => row[col] !== undefined ? row[col] : null));
            await pool.query(
                `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${valuePlaceholders}`,
                values
            );
            success += batch.length;
            if (tableName === 'project_allocations') {
                process.stdout.write(`\r  Inserting... ${i + batch.length}/${validRows.length}`);
            }
        } catch (e) {
            // If batch fails, try one by one
            for (const row of batch) {
                try {
                    const placeholders = columns.map((_, ci) => `$${ci + 1}`).join(', ');
                    const values = columns.map(col => row[col] !== undefined ? row[col] : null);
                    await pool.query(`INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`, values);
                    success++;
                } catch (e2) {
                    failed++;
                }
            }
        }
    }
    console.log(`\n  ✅ Inserted: ${success}, ⚠️ Skipped: ${failed}`);
    return success;
}

async function run() {
    try {
        console.log('=== Fast Bulk Migration ===');
        await pool.query('SELECT NOW()');
        console.log('Connected to Neon.');

        // Check current counts
        const counts = {};
        for (const t of ['employees', 'projects', 'project_assignments', 'project_allocations']) {
            const res = await pool.query(`SELECT COUNT(*) as c FROM ${t}`);
            counts[t] = parseInt(res.rows[0].c);
        }
        console.log('\nCurrent counts:', counts);

        // Clear and re-migrate what's missing or wrong
        await pool.query('DELETE FROM project_allocations');
        await pool.query('DELETE FROM project_assignments');
        await pool.query('DELETE FROM projects');
        await pool.query('DELETE FROM employees');
        console.log('Cleared tables.');

        // Insert employees
        console.log('\nMigrating employees...');
        const employees = sqlite.prepare('SELECT * FROM employees').all();
        await batchInsert('employees', [
            'id', 'group_id', 'name', 'position', 'skill_level', 'employment_type',
            'join_date', 'retirement_date', 'contact_email', 'contact_phone',
            'status', 'notes', 'exclude_from_stats', 'job_role', 'created_at', 'updated_at'
        ], employees);

        console.log('\nMigrating projects...');
        const projects = sqlite.prepare('SELECT * FROM projects').all();
        await batchInsert('projects', [
            'id', 'name', 'start_date', 'end_date', 'status', 'note',
            'display_order', 'type', 'pd', 'pm', 'created_at'
        ], projects);

        console.log('\nMigrating project_assignments...');
        const assignments = sqlite.prepare('SELECT * FROM project_assignments').all();
        await batchInsert('project_assignments', [
            'id', 'project_id', 'employee_id', 'role', 'input_start_date',
            'input_end_date', 'display_order', 'work_location', 'created_at'
        ], assignments);

        console.log('\nMigrating project_allocations (bulk)...');
        const allocations = sqlite.prepare('SELECT * FROM project_allocations').all();
        await batchInsert('project_allocations', [
            'id', 'assignment_id', 'period_date', 'value', 'created_at'
        ], allocations);

        // Sync sequences
        console.log('\nSyncing sequences...');
        for (const t of ['employees', 'projects', 'project_assignments', 'project_allocations']) {
            await pool.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), true)`);
        }

        // Final counts
        console.log('\n=== Final counts ===');
        for (const t of ['employees', 'projects', 'project_assignments', 'project_allocations', 'users']) {
            const res = await pool.query(`SELECT COUNT(*) as c FROM ${t}`);
            console.log(`  ${t}: ${res.rows[0].c}`);
        }

        console.log('\n🎉 Fast bulk migration complete!');
    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await pool.end();
        sqlite.close();
    }
}

run();
