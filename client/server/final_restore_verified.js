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
    if (p.start_date && !/^\d{4}-\d{2}-\d{2}/.test(String(p.start_date).replace(/^"|"$/g, ''))) note = `[OldStart: ${p.start_date}] ` + note;
    if (p.end_date && !/^\d{4}-\d{2}-\d{2}/.test(String(p.end_date).replace(/^"|"$/g, ''))) note = `[OldEnd: ${p.end_date}] ` + note;
    return note.trim();
}

async function run() {
    try {
        console.log('=== NON-TRANSACTIONAL VERIFIED RESTORE ===');
        
        const projs = sqlite.prepare('SELECT * FROM projects').all();
        console.log(`Inserting ${projs.length} projects...`);
        for (const p of projs) {
            try {
                const res = await pool.query(
                    `INSERT INTO projects (id, name, start_date, end_date, status, note, display_order, type, pd, pm, created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
                     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, note = EXCLUDED.note`,
                    [p.id, p.name, sd(p.start_date), sd(p.end_date), p.status || 'active', sn(p), p.display_order, p.type || 'Client', p.pd, p.pm, sd(p.created_at) || p.created_at]
                );
                if (p.id === 1) console.log('  --- Project 1 Inserted/Updated ---');
            } catch (err) {
                console.log(`  ❌ Project ${p.id} FAILED: ${err.message}`);
            }
        }

        // Verify Project 1 exists in DB before assignments
        const check = await pool.query('SELECT id FROM projects WHERE id = 1');
        console.log(`Verification - Project 1 exists in Neon: ${check.rows.length > 0}`);

        const assigns = sqlite.prepare('SELECT * FROM project_assignments').all();
        console.log(`Inserting ${assigns.length} assignments...`);
        let aSuccess = 0;
        for (const a of assigns) {
            try {
                await pool.query(
                    `INSERT INTO project_assignments (id, project_id, employee_id, role, input_start_date, input_end_date, display_order, work_location, created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
                     ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role`,
                    [a.id, a.project_id, a.employee_id, a.role, sd(a.input_start_date), sd(a.input_end_date), a.display_order, a.work_location, sd(a.created_at) || a.created_at]
                );
                aSuccess++;
            } catch (err) {
                console.log(`  ❌ Assignment ${a.id} (Proj: ${a.project_id}) FAILED: ${err.message}`);
            }
        }
        console.log(`  ✅ Assignments: ${aSuccess}/${assigns.length}`);

        // Allocations in bulk
        const allocs = sqlite.prepare('SELECT * FROM project_allocations').all();
        const { rows: neonAssigns } = await pool.query('SELECT id FROM project_assignments');
        const neonAssignIds = new Set(neonAssigns.map(r => r.id));
        const filteredAllocs = allocs.filter(al => neonAssignIds.has(al.assignment_id));
        console.log(`Inserting ${filteredAllocs.length} valid allocations...`);

        const BATCH = 500;
        for (let i = 0; i < filteredAllocs.length; i += BATCH) {
            const batch = filteredAllocs.slice(i, i + BATCH);
            const placeholders = batch.map((_, ri) => `($${ri * 5 + 1}, $${ri * 5 + 2}, $${ri * 5 + 3}, $${ri * 5 + 4}, $${ri * 5 + 5})`).join(', ');
            const values = batch.flatMap(al => [al.id, al.assignment_id, sd(al.period_date), al.value !== '' && al.value !== null ? parseFloat(al.value) : 0, sd(al.created_at) || al.created_at]);
            await pool.query(`INSERT INTO project_allocations (id, assignment_id, period_date, value, created_at) VALUES ${placeholders} ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`, values);
            process.stdout.write(`\r  Allocations: ${i + batch.length}/${filteredAllocs.length}`);
        }

        console.log('\nSyncing sequences...');
        for (const t of ['projects', 'project_assignments', 'project_allocations']) {
            await pool.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), true)`);
        }
        console.log('🎉 RESTORE COMPLETE!');
        await pool.end();
        sqlite.close();
    } catch (err) {
        console.error('\n❌ SCRIPT FAILURE:', err);
    }
}

run();
