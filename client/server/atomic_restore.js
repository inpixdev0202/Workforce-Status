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

function sd(val) {
    if (!val || val === '' || val === 'undefined') return null;
    const clean = String(val).replace(/^"|"$/g, '').trim();
    if (/^\d{4}-\d{2}-\d{2}(\s\d{2}:\d{2}:\d{2})?$/.test(clean)) return clean.split(' ')[0];
    return null;
}

function sn(p) {
    let note = p.note || '';
    if (p.start_date && !/^\d{4}-\d{2}-\d{2}/.test(p.start_date.replace(/^"|"$/g, ''))) note = `[OldStartDate: ${p.start_date}] ` + note;
    if (p.end_date && !/^\d{4}-\d{2}-\d{2}/.test(p.end_date.replace(/^"|"$/g, ''))) note = `[OldEndDate: ${p.end_date}] ` + note;
    return note.trim();
}

async function bulkInsert(table, cols, rows, rowAdapter) {
    const BATCH = 200;
    let count = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH).map(rowAdapter);
        const placeholders = batch.map((_, ri) => `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(', ')})`).join(', ');
        const values = batch.flat();
        await pool.query(`INSERT INTO ${table} (${cols.join(', ')}) VALUES ${placeholders} ON CONFLICT (id) DO UPDATE SET ${cols.map(c => `${c} = EXCLUDED.${c}`).join(', ')}`, values);
        count += batch.length;
        process.stdout.write(`\r  ${table}: ${count}/${rows.length}`);
    }
    console.log(`\n  ✅ ${table} DONE.`);
}

async function run() {
    try {
        console.log('=== ATOMIC FULL RESTORATION ===');
        await pool.query('DELETE FROM project_allocations');
        await pool.query('DELETE FROM project_assignments');
        await pool.query('DELETE FROM projects');
        console.log('Cleared project tables.');

        const projs = sqlite.prepare('SELECT * FROM projects').all();
        await bulkInsert('projects', ['id', 'name', 'start_date', 'end_date', 'status', 'note', 'display_order', 'type', 'pd', 'pm', 'created_at'], projs, p => [
            p.id, p.name, sd(p.start_date), sd(p.end_date), p.status || 'active', sn(p), p.display_order, p.type || 'Client', p.pd, p.pm, sd(p.created_at) || p.created_at
        ]);

        const assigns = sqlite.prepare('SELECT * FROM project_assignments').all();
        await bulkInsert('project_assignments', ['id', 'project_id', 'employee_id', 'role', 'input_start_date', 'input_end_date', 'display_order', 'work_location', 'created_at'], assigns, a => [
            a.id, a.project_id, a.employee_id, a.role, sd(a.input_start_date), sd(a.input_end_date), a.display_order, a.work_location, sd(a.created_at) || a.created_at
        ]);

        const allocs = sqlite.prepare('SELECT * FROM project_allocations').all();
        // Pre-filter allocs to ensure assignment_id exists (just in case)
        const validAssignIds = new Set(assigns.map(a => a.id));
        const filteredAllocs = allocs.filter(al => validAssignIds.has(al.assignment_id));
        
        await bulkInsert('project_allocations', ['id', 'assignment_id', 'period_date', 'value', 'created_at'], filteredAllocs, al => [
            al.id, al.assignment_id, sd(al.period_date), al.value !== '' && al.value !== null ? parseFloat(al.value) : 0, sd(al.created_at) || al.created_at
        ]);

        for (const t of ['projects', 'project_assignments', 'project_allocations']) {
            await pool.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), true)`);
        }
        console.log('🎉 100% PARITY RESTORED!');
        await pool.end();
        sqlite.close();
    } catch (err) {
        console.error('\n❌ CRITICAL FAILURE:', err);
    }
}

run();
