import pkg from 'pg';
const { Pool, types } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from server directory
dotenv.config({ path: join(__dirname, '.env') });

// GLOBALLY OVERRIDE TYPE PARSERS TO MIRROR SQLITE (Prevents Vercel Frontend UI crashes)
types.setTypeParser(types.builtins.DATE, val => val); // Keeps raw dates (e.g. '2025-07-06') without timezones
types.setTypeParser(types.builtins.NUMERIC, val => parseFloat(val)); // Parses DECIMAL columns to native Floats
types.setTypeParser(types.builtins.INT8, val => parseInt(val, 10)); // Parses COUNT(*) integers from BigInt

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
});

// Helper to normalize params (SQLite allowed passing array or spread)
function normalizeParams(params) {
    if (params.length === 1 && Array.isArray(params[0])) {
        return params[0];
    }
    return params;
}

// Convert SQLite ? to Postgres $1, $2
function convertQuery(sql) {
    let i = 1;
    return sql.replace(/\?/g, () => `$${i++}`);
}

export async function initializeDatabase() {
    try {
        console.log('Initializing Postgres Database...');

        await pool.query(`
            CREATE TABLE IF NOT EXISTS groups (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                color VARCHAR(7) DEFAULT '#3B82F6',
                display_order INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

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

        await pool.query(`
            CREATE TABLE IF NOT EXISTS attendance (
                id SERIAL PRIMARY KEY,
                employee_id INTEGER NOT NULL REFERENCES employees(id),
                date DATE NOT NULL,
                status VARCHAR(20),
                hours DECIMAL(4,2),
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, date)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS projects (
                id SERIAL PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                start_date DATE,
                end_date DATE,
                status VARCHAR(20) DEFAULT '진행중',
                note TEXT,
                display_order INTEGER,
                type VARCHAR(20) DEFAULT 'Client',
                pd VARCHAR(100),
                pm VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Add project_group column if it doesn't exist
        try {
            await pool.query('ALTER TABLE projects ADD COLUMN project_group VARCHAR(50)');
            console.log('Added project_group column to projects table');
        } catch (error) {
            // Error code 42701 means duplicate_column, which is expected if the column already exists
            if (error.code !== '42701') {
                console.error('Error adding project_group column:', error);
            }
        }

        await pool.query(`
            CREATE TABLE IF NOT EXISTS project_assignments (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
                role VARCHAR(50), 
                input_start_date DATE,
                input_end_date DATE,
                display_order INTEGER,
                work_location VARCHAR(20),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, employee_id)
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS project_allocations (
                id SERIAL PRIMARY KEY,
                assignment_id INTEGER NOT NULL REFERENCES project_assignments(id) ON DELETE CASCADE,
                period_date DATE NOT NULL,
                value DECIMAL(4, 2),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(assignment_id, period_date)
            )
        `);

        // Indexes
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_employees_group ON employees(group_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_assignments_project ON project_assignments(project_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_assignments_employee ON project_assignments(employee_id)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_allocations_assignment ON project_allocations(assignment_id)`);

        // Check groups
        const { rows: groups } = await pool.query('SELECT COUNT(*) as count FROM groups');
        if (parseInt(groups[0].count) === 0) {
            const defaultGroups = [
                ['SCG', '#3B82F6', 1], ['CDG', '#10B981', 2], ['FDG', '#F59E0B', 3],
                ['ISG1', '#8B5CF6', 4], ['ISD', '#EF4444', 5], ['소셜미디어', '#EC4899', 6],
                ['CDT', '#6366F1', 7], ['PDG', '#14B8A6', 8]
            ];
            for (const g of defaultGroups) {
                await pool.query('INSERT INTO groups (name, color, display_order) VALUES ($1, $2, $3)', g);
            }
        }

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

        // Admin seeding disabled to prevent race conditions during migrations.
        // Use a manual script if needed.
        /*
        const { rows: users } = await pool.query('SELECT COUNT(*) as count FROM users');
        if (parseInt(users[0].count) === 0) {
            try {
                const bcrypt = await import('bcryptjs');
                const salt = bcrypt.default.genSaltSync(10);
                const hash = bcrypt.default.hashSync('admin123', salt);
                await pool.query(
                    'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4)',
                    ['Total Admin', 'admin@admin.com', hash, 'Admin']
                );
                console.log('✅ Default admin user created (admin@admin.com / admin123)');
            } catch (e) {
                console.error('Failed to seed default admin user', e);
            }
        }
        */

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

        const { rows: missingIntegrations } = await pool.query('SELECT COUNT(*) as count FROM integrations');
        if (parseInt(missingIntegrations[0].count) === 0) {
            const defaults = [
                ['Career System', '전사 통합 인재 관리 및 경력 개발 시스템', 'https://career.inpix.com', '🎓', 1],
                ['Technical Support', 'IT 지원 및 기술 문의 접수 채널', 'https://support.inpix.com', '🛡️', 2],
                ['Internal Docs', '프로젝트 가이드 및 전사 표준 문서함', 'https://docs.inpix.com', '📚', 3]
            ];
            for (const item of defaults) {
                await pool.query('INSERT INTO integrations (name, description, url, icon_emoji, display_order) VALUES ($1, $2, $3, $4, $5)', item);
            }
        }

        // Ensure project_reports has an 'id' column for the run() polyfill compatibility
        await pool.query(`
            CREATE TABLE IF NOT EXISTS project_reports (
                id SERIAL PRIMARY KEY,
                week_date DATE UNIQUE NOT NULL,
                data_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create Sales Data Table (Single-document style to store the entire spreadsheet state)
        await pool.query(`
            CREATE TABLE IF NOT EXISTS sales_data (
                id SERIAL PRIMARY KEY,
                key_name VARCHAR(50) UNIQUE NOT NULL,
                data_json TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Migration: Add id column to legacy project_reports if missing
        try {
            const { rows: columns } = await pool.query(`
                SELECT column_name FROM information_schema.columns 
                WHERE table_name = 'project_reports' AND column_name = 'id'
            `);
            if (columns.length === 0) {
                console.log('Migrating project_reports to include id column...');
                await pool.query('ALTER TABLE project_reports ADD COLUMN id SERIAL');
                await pool.query('ALTER TABLE project_reports DROP CONSTRAINT IF EXISTS project_reports_pkey');
                await pool.query('ALTER TABLE project_reports ADD PRIMARY KEY (id)');
                await pool.query('ALTER TABLE project_reports ADD CONSTRAINT project_reports_week_date_key UNIQUE (week_date)');
            }
        } catch (migErr) {
            console.warn('Project reports migration warning (likely already migrated):', migErr.message);
        }

        console.log('✅ Postgres Database initialized successfully');
    } catch (e) {
        console.error('Failed to initialize Postgres tables', e);
    }
}

export async function query(sql, ...params) {
    const normParams = normalizeParams(params);
    const text = convertQuery(sql);
    try {
        const res = await pool.query(text, normParams);
        return res.rows;
    } catch (error) {
        console.error('Query error:', error, 'SQL:', text, 'Params:', normParams);
        throw error;
    }
}

export async function run(sql, ...params) {
    const normParams = normalizeParams(params);
    let text = convertQuery(sql);
    
    // SQLite polyfill: append RETURNING id for inserts if not present, to emulate lastInsertRowid
    const isInsert = text.trim().toUpperCase().startsWith('INSERT');
    if (isInsert && !text.toUpperCase().includes('RETURNING')) {
        // Only append RETURNING id if it doesn't look like an UPSERT (ON CONFLICT) that might have issues
        // or specifically for tables we know have 'id'
        text += ' RETURNING id';
    }

    try {
        const res = await pool.query(text, normParams);
        return { 
            changes: res.rowCount, 
            lastInsertRowid: isInsert && res.rows.length > 0 ? res.rows[0].id : undefined 
        };
    } catch (error) {
        console.error('Run error:', error, 'SQL:', text, 'Params:', normParams);
        throw error;
    }
}

export async function get(sql, ...params) {
    const normParams = normalizeParams(params);
    const text = convertQuery(sql);
    try {
        const res = await pool.query(text, normParams);
        return res.rows[0] || null;
    } catch (error) {
        console.error('Get error:', error, 'SQL:', text, 'Params:', normParams);
        throw error;
    }
}

export async function getDB() {
    return pool;
}

export function saveDatabase() {
    // no-op
}

export default { initializeDatabase, query, run, get, saveDatabase, getDB };
