import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const pool = new pg.Pool({
    connectionString: process.env.FINAL_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_assignments_employee ON project_assignments(employee_id)',
    'CREATE INDEX IF NOT EXISTS idx_assignments_project_order ON project_assignments(project_id, display_order)',
    'CREATE INDEX IF NOT EXISTS idx_allocations_assignment ON project_allocations(assignment_id)',
    'CREATE INDEX IF NOT EXISTS idx_allocations_assignment_date ON project_allocations(assignment_id, period_date)',
    'CREATE INDEX IF NOT EXISTS idx_projects_order ON projects(display_order)',
    'CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)',
];

try {
    for (const sql of indexes) {
        await pool.query(sql);
        console.log('✅', sql.split(' ON ')[1]);
    }
    console.log('\n🎉 All indexes created successfully!');
} catch (err) {
    console.error('❌ Error:', err.message);
} finally {
    await pool.end();
}
