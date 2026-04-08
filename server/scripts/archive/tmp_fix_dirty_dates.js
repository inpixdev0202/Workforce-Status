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

function isValidDate(val) {
    if (!val) return false;
    // Basic YYYY-MM-DD check
    return /^\d{4}-\d{2}-\d{2}$/.test(val);
}

function sanitizeDate(val) {
    if (!val || val === '' || val === 'undefined') return null;
    const clean = val.replace(/^"|"$/g, '').trim();
    if (isValidDate(clean)) return clean;
    return null;
}

// If date is invalid but has content, move it to note
function getNote(p) {
    let note = p.note || '';
    if (p.start_date && !isValidDate(p.start_date.replace(/^"|"$/g, ''))) {
        note = `[Old StartDate: ${p.start_date}] ` + note;
    }
    if (p.end_date && !isValidDate(p.end_date.replace(/^"|"$/g, ''))) {
        note = `[Old EndDate: ${p.end_date}] ` + note;
    }
    return note.trim();
}

async function run() {
    try {
        const { rows: neonProjs } = await pool.query('SELECT id FROM projects');
        const neonProjIds = new Set(neonProjs.map(r => r.id));
        const allSqliteProjs = sqlite.prepare('SELECT * FROM projects').all();
        const missingProjs = allSqliteProjs.filter(p => !neonProjIds.has(p.id));

        console.log(`Sanitizing and inserting ${missingProjs.length} projects...`);
        for (const p of missingProjs) {
            try {
                const note = getNote(p);
                const start = sanitizeDate(p.start_date);
                const end = sanitizeDate(p.end_date);
                
                await pool.query(
                    'INSERT INTO projects (id, name, start_date, end_date, status, note, display_order, type, pd, pm, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
                    [p.id, p.name, start, end, p.status, note, p.display_order, p.type, p.pd, p.pm, sanitizeDate(p.created_at) || p.created_at]
                );
                console.log(`  ✅ Project ${p.id}: ${p.name}`);
            } catch (err) {
                console.log(`  ❌ Project ${p.id} FAILED: ${err.message}`);
            }
        }

        // Assignments and Allocations after this
        console.log('\nRunning assignments... (Already confirmed 219/박원규 is okay)');

        await pool.end();
        sqlite.close();
    } catch (err) {
        console.error(err);
    }
}

run();
