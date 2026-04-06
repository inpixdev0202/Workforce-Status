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

const todayStr = new Date().toISOString().split('T')[0];

async function run() {
    try {
        console.log('--- Database Stats ---');
        
        const totalEmps = await pool.query("SELECT COUNT(*) as count FROM employees WHERE status = 'active' AND (exclude_from_stats IS NULL OR exclude_from_stats = 0)");
        console.log('Total Active Employees:', totalEmps.rows[0].count);

        const projectTypes = await pool.query("SELECT type, COUNT(*) as count FROM projects GROUP BY type");
        console.log('Project Types in DB:', projectTypes.rows);

        const activeAssignments = await pool.query(`
            SELECT p.type, COUNT(DISTINCT pa.employee_id) as count
            FROM project_assignments pa
            JOIN projects p ON pa.project_id = p.id
            WHERE (p.status = 'active' OR p.status = '진행중')
              AND (pa.input_start_date <= $1 OR pa.input_start_date IS NULL)
              AND (pa.input_end_date >= $1 OR pa.input_end_date IS NULL)
            GROUP BY p.type
        `, [todayStr]);
        console.log('Active Assignments by Project Type:', activeAssignments.rows);

        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

run();
