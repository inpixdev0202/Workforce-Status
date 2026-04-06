import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env') });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log('--- Headcount Distribution ---');
        
        const res = await pool.query(`
            SELECT 
                status, 
                exclude_from_stats, 
                COUNT(*) as count 
            FROM employees 
            GROUP BY status, exclude_from_stats
            ORDER BY status, exclude_from_stats
        `);
        console.table(res.rows);

        const summary = await pool.query(`
            SELECT 
                COUNT(*) as overall_total,
                COUNT(*) FILTER (WHERE status = 'active') as active_total,
                COUNT(*) FILTER (WHERE status = 'active' AND (exclude_from_stats IS NULL OR exclude_from_stats = 0)) as dashboard_total
            FROM employees
        `);
        console.log('\nSummary:');
        console.table(summary.rows);

        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
