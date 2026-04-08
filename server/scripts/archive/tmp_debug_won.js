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

async function debugData() {
    try {
        console.log('--- Searching Project ---');
        const projRes = await pool.query("SELECT id, name FROM projects WHERE name LIKE '%우리은행%'");
        console.table(projRes.rows);

        console.log('--- Searching Employee ---');
        const empRes = await pool.query("SELECT id, name FROM employees WHERE name = '박원규'");
        console.table(empRes.rows);

        if (projRes.rows.length === 0 || empRes.rows.length === 0) {
            console.log('❌ Project or Employee not found.');
            return;
        }

        const projectId = projRes.rows[0].id;
        const employeeId = empRes.rows[0].id;

        console.log(`--- Searching Assignments for Proj:${projectId}, Emp:${employeeId} ---`);
        const assignRes = await pool.query(
            "SELECT * FROM project_assignments WHERE project_id = $1 AND employee_id = $2",
            [projectId, employeeId]
        );
        console.table(assignRes.rows);

        if (assignRes.rows.length > 0) {
            const assignmentId = assignRes.rows[0].id;
            console.log(`--- Searching Allocations for Assignment:${assignmentId} ---`);
            const allocRes = await pool.query(
                "SELECT * FROM project_allocations WHERE assignment_id = $1 ORDER BY period_date ASC",
                [assignmentId]
            );
            console.table(allocRes.rows);
        } else {
            console.log('❌ No assignment found for this pair.');
        }

        await pool.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

debugData();
