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
    return val;
}

async function run() {
    try {
        const { rows: neonProjs } = await pool.query('SELECT id FROM projects');
        const neonProjIds = new Set(neonProjs.map(r => r.id));
        const allSqliteProjs = sqlite.prepare('SELECT * FROM projects').all();
        const missingProjs = allSqliteProjs.filter(p => !neonProjIds.has(p.id));

        console.log(`Inserting ${missingProjs.length} missing projects...`);
        for (const p of missingProjs) {
            try {
                await pool.query(
                    'INSERT INTO projects (id, name, start_date, end_date, status, note, display_order, type, pd, pm, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
                    [p.id, p.name, sd(p.start_date), sd(p.end_date), p.status, p.note, p.display_order, p.type, p.pd, p.pm, sd(p.created_at)]
                );
                console.log(`  ✅ Project ${p.id}: ${p.name}`);
            } catch (err) {
                console.log(`  ❌ Project ${p.id} FAILED: ${err.message}`);
            }
        }

        const { rows: neonAssigns } = await pool.query('SELECT id FROM project_assignments');
        const neonAssignIds = new Set(neonAssigns.map(r => r.id));
        const allSqliteAssigns = sqlite.prepare('SELECT * FROM project_assignments').all();
        const missingAssigns = allSqliteAssigns.filter(a => !neonAssignIds.has(a.id));

        console.log(`\nInserting ${missingAssigns.length} missing assignments...`);
        for (const a of missingAssigns) {
            try {
                await pool.query(
                    'INSERT INTO project_assignments (id, project_id, employee_id, role, input_start_date, input_end_date, display_order, work_location, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
                    [a.id, a.project_id, a.employee_id, a.role, sd(a.input_start_date), sd(a.input_end_date), a.display_order, a.work_location, sd(a.created_at)]
                );
                console.log(`  ✅ Assignment ${a.id}`);
            } catch (err) {
                console.log(`  ❌ Assignment ${a.id} FAILED: ${err.message}`);
            }
        }

        // Final Count
        const fp = await pool.query('SELECT count(*) FROM projects');
        const fa = await pool.query('SELECT count(*) FROM project_assignments');
        console.log(`\nFinal Counts - Projects: ${fp.rows[0].count}, Assignments: ${fa.rows[0].count}`);

        await pool.end();
        sqlite.close();
    } catch (err) {
        console.error(err);
    }
}

run();
