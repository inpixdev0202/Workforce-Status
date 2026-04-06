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

function safeDate(val) {
    if (!val || val === '' || val === 'undefined') return null;
    return val;
}

async function run() {
    try {
        // Get IDs that are in SQLite but not in Neon
        const { rows: neonEmployees } = await pool.query('SELECT id FROM employees');
        const neonIds = new Set(neonEmployees.map(r => r.id));
        const allSqlite = sqlite.prepare('SELECT * FROM employees').all();
        const missing = allSqlite.filter(e => !neonIds.has(e.id));
        console.log(`Missing employees to insert: ${missing.length}`);
        
        for (const row of missing) {
            try {
                await pool.query(
                    `INSERT INTO employees (id, group_id, name, position, skill_level, employment_type, join_date, retirement_date, contact_email, contact_phone, status, notes, exclude_from_stats, job_role, created_at, updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
                    [
                        row.id, row.group_id, row.name, row.position, row.skill_level,
                        row.employment_type, safeDate(row.join_date), safeDate(row.retirement_date),
                        row.contact_email, row.contact_phone, row.status, row.notes,
                        row.exclude_from_stats, row.job_role,
                        safeDate(row.created_at), safeDate(row.updated_at)
                    ]
                );
                console.log(`  ✅ Employee: ${row.id} - ${row.name}`);
            } catch (err) {
                console.log(`  ❌ Employee ${row.id} (${row.name}): ${err.message}`);
            }
        }

        // Fix missing projects similarly
        const { rows: neonProjects } = await pool.query('SELECT id FROM projects');
        const neonProjectIds = new Set(neonProjects.map(r => r.id));
        const allProjects = sqlite.prepare('SELECT * FROM projects').all();
        const missingProjects = allProjects.filter(p => !neonProjectIds.has(p.id));
        console.log(`\nMissing projects to insert: ${missingProjects.length}`);
        
        for (const row of missingProjects) {
            try {
                await pool.query(
                    `INSERT INTO projects (id, name, start_date, end_date, status, note, display_order, type, pd, pm, created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
                    [row.id, row.name, safeDate(row.start_date), safeDate(row.end_date), row.status, row.note, row.display_order, row.type, row.pd, row.pm, safeDate(row.created_at)]
                );
                console.log(`  ✅ Project: ${row.id} - ${row.name}`);
            } catch (err) {
                console.log(`  ❌ Project ${row.id} (${row.name}): ${err.message}`);
            }
        }

        // Now try missing assignments
        const { rows: neonAssignments } = await pool.query('SELECT id FROM project_assignments');
        const neonAssignIds = new Set(neonAssignments.map(r => r.id));
        const allAssignments = sqlite.prepare('SELECT * FROM project_assignments').all();
        const missingAssignments = allAssignments.filter(a => !neonAssignIds.has(a.id));
        console.log(`\nMissing assignments to insert: ${missingAssignments.length}`);
        
        for (const row of missingAssignments) {
            try {
                await pool.query(
                    `INSERT INTO project_assignments (id, project_id, employee_id, role, input_start_date, input_end_date, display_order, work_location, created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
                    [row.id, row.project_id, row.employee_id, row.role, safeDate(row.input_start_date), safeDate(row.input_end_date), row.display_order, row.work_location, safeDate(row.created_at)]
                );
                console.log(`  ✅ Assignment: ${row.id}`);
            } catch (err) {
                console.log(`  ❌ Assignment ${row.id}: ${err.message}`);
            }
        }

        // Update sequences
        for (const t of ['employees', 'projects', 'project_assignments']) {
            await pool.query(`SELECT setval(pg_get_serial_sequence('${t}', 'id'), COALESCE((SELECT MAX(id) FROM ${t}), 1), true)`);
        }

        // Final counts
        console.log('\n=== Final counts ===');
        for (const t of ['employees', 'projects', 'project_assignments', 'project_allocations', 'users']) {
            const res = await pool.query(`SELECT COUNT(*) as c FROM ${t}`);
            console.log(`  ${t}: ${res.rows[0].c}`);
        }

        await pool.end();
        sqlite.close();
    } catch (err) {
        console.error(err);
    }
}

run();
