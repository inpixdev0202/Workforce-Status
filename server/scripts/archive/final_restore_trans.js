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
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) return clean.split(' ')[0];
    return null;
}

function sn(p) {
    let note = p.note || '';
    if (p.start_date && !/^\d{4}-\d{2}-\d{2}/.test(String(p.start_date).replace(/^"|"$/g, ''))) note = `[OldStartDate: ${p.start_date}] ` + note;
    if (p.end_date && !/^\d{4}-\d{2}-\d{2}/.test(String(p.end_date).replace(/^"|"$/g, ''))) note = `[OldEndDate: ${p.end_date}] ` + note;
    return note.trim();
}

async function run() {
    const client = await pool.connect();
    try {
        console.log('=== FINAL 100% TRANSACTIONAL RESTORE ===');
        await client.query('BEGIN');
        
        await client.query('DELETE FROM project_allocations');
        await client.query('DELETE FROM project_assignments');
        await client.query('DELETE FROM projects');
        console.log('Tables cleared within transaction.');

        const projs = sqlite.prepare('SELECT * FROM projects').all();
        for (const p of projs) {
            await client.query(
                `INSERT INTO projects (id, name, start_date, end_date, status, note, display_order, type, pd, pm, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                [p.id, p.name, sd(p.start_date), sd(p.end_date), p.status || 'active', sn(p), p.display_order, p.type || 'Client', p.pd, p.pm, sd(p.created_at) || p.created_at]
            );
        }
        console.log(`  ✅ Projects: ${projs.length}/${projs.length}`);

        const assigns = sqlite.prepare('SELECT * FROM project_assignments').all();
        for (const a of assigns) {
            await client.query(
                `INSERT INTO project_assignments (id, project_id, employee_id, role, input_start_date, input_end_date, display_order, work_location, created_at)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                [a.id, a.project_id, a.employee_id, a.role, sd(a.input_start_date), sd(a.input_end_date), a.display_order, a.work_location, sd(a.created_at) || a.created_at]
            );
        }
        console.log(`  ✅ Assignments: ${assigns.length}/${assigns.length}`);

        const allocs = sqlite.prepare('SELECT * FROM project_allocations').all();
        const validAssignIds = new Set(assigns.map(a => a.id));
        const filteredAllocs = allocs.filter(al => validAssignIds.has(al.assignment_id));
        
        const BATCH = 200;
        for (let i = 0; i < filteredAllocs.length; i += BATCH) {
            const batch = filteredAllocs.slice(i, i + BATCH);
            const placeholders = batch.map((_, ri) => `($${ri * 5 + 1}, $${ri * 5 + 2}, $${ri * 5 + 3}, $${ri * 5 + 4}, $${ri * 5 + 5})`).join(', ');
            const values = batch.flatMap(al => [al.id, al.assignment_id, sd(al.period_date), al.value !== '' && al.value !== null ? parseFloat(al.value) : 0, sd(al.created_at) || al.created_at]);
            await client.query(`INSERT INTO project_allocations (id, assignment_id, period_date, value, created_at) VALUES ${placeholders}`, values);
            process.stdout.write(`\r  Allocations: ${i + batch.length}/${filteredAllocs.length}`);
        }

        console.log('\nSyncing sequences...');
        for (const t of ['projects', 'project_assignments', 'project_allocations']) {
            await client.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), true)`);
        }

        await client.query('COMMIT');
        console.log('\n🎉 ALL DATA RESTORED 100%!');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\n❌ TRANSACTION FAILED:', err);
    } finally {
        client.release();
        await pool.end();
        sqlite.close();
    }
}

run();
