import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

async function init() {
    try {
        console.log('🚀 Starting PostgreSQL Schema Initialization on Neon...');
        
        // 1. Groups table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                color VARCHAR(7) DEFAULT '#3B82F6',
                display_order INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 2. Employees table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS employees (
                id SERIAL PRIMARY KEY,
                group_id INTEGER REFERENCES groups(id),
                name VARCHAR(100) NOT NULL,
                position VARCHAR(50),
                skill_level VARCHAR(20),
                employment_type VARCHAR(50),
                join_date DATE,
                retirement_date DATE,
                contact_email VARCHAR(100),
                contact_phone VARCHAR(20),
                status VARCHAR(20) DEFAULT 'active',
                notes TEXT,
                exclude_from_stats INTEGER DEFAULT 0,
                job_role VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 3. Users table (for Auth)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                role VARCHAR(20) DEFAULT 'GroupLeader',
                group_id INTEGER REFERENCES groups(id),
                permissions TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 4. Attendance table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
                date DATE NOT NULL,
                status VARCHAR(20),
                hours DECIMAL(4,2),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, date)
            )
        `);

        // 5. Projects table
        await pool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                start_date DATE,
                end_date DATE,
                status VARCHAR(20) DEFAULT 'active',
                note TEXT,
                display_order INTEGER,
                type VARCHAR(20) DEFAULT 'Client',
                pd VARCHAR(100),
                pm VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 6. Project Assignments
        await pool.query(`
            CREATE TABLE IF NOT EXISTS project_assignments (
                id SERIAL PRIMARY KEY,
                project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
                employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
                role VARCHAR(50),
                input_start_date DATE,
                input_end_date DATE,
                display_order INTEGER,
                work_location VARCHAR(50),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, employee_id)
            )
        `);

        // 7. Project Allocations
        await pool.query(`
            CREATE TABLE IF NOT EXISTS project_allocations (
                id SERIAL PRIMARY KEY,
                assignment_id INTEGER REFERENCES project_assignments(id) ON DELETE CASCADE,
                period_date DATE NOT NULL,
                value DECIMAL(4, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(assignment_id, period_date)
            )
        `);

        // 8. Integrations
        await pool.query(`
            CREATE TABLE IF NOT EXISTS integrations (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                url TEXT,
                icon_emoji VARCHAR(10) DEFAULT '🔗',
                display_order INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // 9. Project Reports
        await pool.query(`
            CREATE TABLE IF NOT EXISTS project_reports (
                week_date DATE PRIMARY KEY,
                data_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        console.log('✅ All tables created successfully!');
        
        // Add Indexes
        console.log('📊 Creating indexes...');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_employees_group ON employees(group_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_assignments_project ON project_assignments(project_id)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_allocations_period ON project_allocations(period_date)');

        console.log('🎉 Schema initialization complete!');
    } catch (err) {
        console.error('❌ Schema initialization failed:', err.message);
    } finally {
        await pool.end();
    }
}

init();
