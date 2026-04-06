import Database from 'better-sqlite3';
import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
        const rows = sqlite.prepare('SELECT * FROM project_allocations').all();
        console.log(`Total allocations in SQLite: ${rows.length}`);
        
        const BATCH_SIZE = 100;
        let success = 0, failed = 0, updated = 0;
        
        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batch = rows.slice(i, i + BATCH_SIZE);
            const placeholders = batch.map((_, ri) => 
                `($${ri * 5 + 1}, $${ri * 5 + 2}, $${ri * 5 + 3}, $${ri * 5 + 4}, $${ri * 5 + 5})`
            ).join(', ');
            
            const values = batch.flatMap(row => [
                row.id, row.assignment_id, row.period_date, 
                row.value !== '' ? row.value : 0, 
                row.created_at || null
            ]);
            
            try {
                const query = `
                    INSERT INTO project_allocations (id, assignment_id, period_date, value, created_at)
                    VALUES ${placeholders}
                    ON CONFLICT (id) DO UPDATE SET
                        assignment_id = EXCLUDED.assignment_id,
                        period_date = EXCLUDED.period_date,
                        value = EXCLUDED.value,
                        created_at = EXCLUDED.created_at
                `;
                await pool.query(query, values);
                success += batch.length;
                process.stdout.write(`\r  Progress: ${success}/${rows.length}`);
            } catch (err) {
                // Individual fallback
                for (const row of batch) {
                    try {
                        await pool.query(
                            `INSERT INTO project_allocations (id, assignment_id, period_date, value, created_at)
                             VALUES ($1, $2, $3, $4, $5)
                             ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`,
                            [row.id, row.assignment_id, row.period_date, row.value !== '' ? row.value : 0, row.created_at || null]
                        );
                        success++;
                    } catch (e2) {
                        failed++;
                    }
                }
            }
        }
        
        console.log(`\n\n=== Restoration Finished ===`);
        console.log(`✅ Success: ${success}`);
        console.log(`❌ Failed (FK Orphaned): ${failed}`);
        
        // Final count check
        const finalRes = await pool.query('SELECT count(*) FROM project_allocations');
        console.log(`Final Neon count: ${finalRes.rows[0].count}`);
        
        await pool.end();
        sqlite.close();
    } catch (err) {
        console.error(err);
    }
}

run();
