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

async function run() {
    try {
        // Check which SQLite employees are missing in Neon
        const { rows: neonEmployees } = await pool.query('SELECT id FROM employees');
        const neonIds = new Set(neonEmployees.map(r => r.id));
        const sqliteEmployees = sqlite.prepare('SELECT id, name, group_id, status FROM employees').all();
        
        const missing = sqliteEmployees.filter(e => !neonIds.has(e.id));
        console.log('Missing employees from Neon:', JSON.stringify(missing));
        
        // Check which SQLite projects are missing
        const { rows: neonProjects } = await pool.query('SELECT id FROM projects');
        const neonProjectIds = new Set(neonProjects.map(r => r.id));
        const sqliteProjects = sqlite.prepare('SELECT id, name, status FROM projects').all();
        const missingProjects = sqliteProjects.filter(p => !neonProjectIds.has(p.id));
        console.log('Missing projects from Neon:', JSON.stringify(missingProjects));
        
        // Check which SQLite assignments are missing
        const { rows: neonAssignments } = await pool.query('SELECT id FROM project_assignments');
        const neonAssignIds = new Set(neonAssignments.map(r => r.id));
        const sqliteAssignments = sqlite.prepare('SELECT id, project_id, employee_id FROM project_assignments').all();
        const missingAssignments = sqliteAssignments.filter(a => !neonAssignIds.has(a.id));
        console.log('Missing assignments count:', missingAssignments.length);
        const assignmentsByProject = missingAssignments.reduce((acc, a) => { acc[a.project_id] = (acc[a.project_id]||0)+1; return acc; }, {});
        console.log('Missing assignments by project_id:', assignmentsByProject);
        
        // Try to insert missing employees individually to see errors
        console.log('\nTrying to insert missing employees...');
        for (const e of missing) {
            const row = sqlite.prepare('SELECT * FROM employees WHERE id = ?').get(e.id);
            try {
                await pool.query(
                    `INSERT INTO employees (id, group_id, name, position, skill_level, employment_type, join_date, retirement_date, contact_email, contact_phone, status, notes, exclude_from_stats, job_role, created_at, updated_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
                    [row.id, row.group_id, row.name, row.position, row.skill_level, row.employment_type, row.join_date, row.retirement_date, row.contact_email, row.contact_phone, row.status, row.notes, row.exclude_from_stats, row.job_role, row.created_at, row.updated_at]
                );
                console.log(`  ✅ Inserted employee ${row.id}: ${row.name}`);
            } catch (err) {
                console.log(`  ❌ Failed employee ${row.id} (${row.name}): ${err.message}`);
            }
        }
        
        await pool.end();
        sqlite.close();
    } catch (err) {
        console.error(err);
    }
}

run();
