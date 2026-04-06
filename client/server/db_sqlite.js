import Database from 'better-sqlite3';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || join(__dirname, 'database.db');
let db;

// Initialize Database
export async function initializeDatabase() {
  if (!db) {
    db = new Database(dbPath, {
      // verbose: console.log 
    });
    // Performance tuning for SQLite
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  }

  // Groups table
  db.exec(`
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(50) UNIQUE NOT NULL,
      color VARCHAR(7) DEFAULT '#3B82F6',
      display_order INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Employees table
  db.exec(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      group_id INTEGER,
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    )
  `);

  // Migration: Add skill_level if missing
  try {
    db.exec('ALTER TABLE employees ADD COLUMN skill_level VARCHAR(20)');
  } catch (e) {
    // Column likely exists
  }

  // Migration: Add exclude_from_stats if missing
  try {
    db.exec('ALTER TABLE employees ADD COLUMN exclude_from_stats INTEGER DEFAULT 0');
  } catch (e) {
    // Column likely exists
  }

  // Migration: Add retirement_date if missing
  try {
    db.exec('ALTER TABLE employees ADD COLUMN retirement_date DATE');
  } catch (e) {
    // Column likely exists
  }

  // Migration: Add job_role if missing
  try {
    db.exec('ALTER TABLE employees ADD COLUMN job_role VARCHAR(50)');
  } catch (e) {
    // Column likely exists
  }

  // Cleanup: Remove duplicate employees (keep lowest ID)
  // SQLite doesn't support DELETE with JOIN/Subquery easily in one go for some versions,
  // so we'll do it in steps or use a specific syntax if supported.
  // Safe approach: Find duplicates and delete them by ID.
  try {
    const duplicates = db.prepare(`
      SELECT id 
      FROM employees 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM employees 
        GROUP BY name, group_id
      )
    `).all();

    if (duplicates.length > 0) {
      const idsToDelete = duplicates.map(v => v.id);
      if (idsToDelete.length > 0) {
        db.prepare(`DELETE FROM employees WHERE id IN (${idsToDelete.join(',')})`).run();
        console.log(`🧹 Removed ${idsToDelete.length} duplicate employees.`);
      }
    }
  } catch (e) {
    console.error('Deduplication failed:', e);
  }

  // Attendance table
  db.exec(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      date DATE NOT NULL,
      status VARCHAR(20),
      hours DECIMAL(4,2),
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      UNIQUE(employee_id, date)
    )
  `);

  // --- NEW TABLES FOR PROJECT MANAGEMENT ---

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL,
      start_date DATE,
      end_date DATE,
      status VARCHAR(20) DEFAULT 'active',
      note TEXT,
      display_order INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Migration: Add display_order to projects if missing
  try {
    db.exec('ALTER TABLE projects ADD COLUMN display_order INTEGER');
  } catch (e) { }

  // Migration: Add type to projects if missing
  try {
    db.exec("ALTER TABLE projects ADD COLUMN type VARCHAR(20) DEFAULT 'Client'");
  } catch (e) { }

  // Migration: Add pd and pm to projects if missing
  try {
    db.exec('ALTER TABLE projects ADD COLUMN pd VARCHAR(100)');
  } catch (e) { }
  try {
    db.exec('ALTER TABLE projects ADD COLUMN pm VARCHAR(100)');
  } catch (e) { }

  // Project Assignments table (Employee <-> Project)
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      employee_id INTEGER NOT NULL,
      role VARCHAR(50), 
      input_start_date DATE,
      input_end_date DATE,
      display_order INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      UNIQUE(project_id, employee_id)
    )
  `);

  // Migration: Add display_order to assignments if missing
  try {
    db.exec('ALTER TABLE project_assignments ADD COLUMN display_order INTEGER');
  } catch (e) { }

  // Migration: Add work_location to assignments if missing
  try {
    db.exec('ALTER TABLE project_assignments ADD COLUMN work_location VARCHAR(20)');
  } catch (e) { }

  // Project Allocations (Weekly MM)
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      period_date DATE NOT NULL,
      value DECIMAL(4, 2),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (assignment_id) REFERENCES project_assignments(id) ON DELETE CASCADE,
      UNIQUE(assignment_id, period_date)
    )
  `);

  // Migration: Ensure value is DECIMAL(4,2) (standardizing)
  try {
    db.exec('ALTER TABLE project_allocations MODIFY COLUMN value DECIMAL(4, 2)');
  } catch (e) {
    // ALTER TABLE MODIFY might not be supported in all SQL variants, 
    // but sql.js/sqlite will handle the DECIMAL(3,1) -> (4,2) transition gracefully on next insert if type is loose
  }

  // Indexes
  db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_group ON employees(group_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_employee ON attendance(employee_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_assignments_project ON project_assignments(project_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_assignments_employee ON project_assignments(employee_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_allocations_assignment ON project_allocations(assignment_id)`);

  // Default groups check
  const groupCountRow = db.prepare('SELECT COUNT(*) as count FROM groups').get();
  const groupCount = groupCountRow?.count || 0;

  if (groupCount === 0) {
    const defaultGroups = [
      ['SCG', '#3B82F6', 1],
      ['CDG', '#10B981', 2],
      ['FDG', '#F59E0B', 3],
      ['ISG1', '#8B5CF6', 4],
      ['ISD', '#EF4444', 5],
      ['소셜미디어', '#EC4899', 6],
      ['CDT', '#6366F1', 7],
      ['PDG', '#14B8A6', 8]
    ];

    const insertGroup = db.prepare('INSERT INTO groups (name, color, display_order) VALUES (?, ?, ?)');
    for (const group of defaultGroups) {
      insertGroup.run(group);
    }
  }

  // Users table for Authentication
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(100) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'GroupLeader',
      group_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (group_id) REFERENCES groups(id)
    )
  `);

  // Migration: Add permissions to users if missing
  try {
    db.exec('ALTER TABLE users ADD COLUMN permissions TEXT');
  } catch (e) {
    // Column likely exists
  }

  // Default Admin User Check
  const userCountRow = db.prepare('SELECT COUNT(*) as count FROM users').get();
  const userCount = userCountRow?.count || 0;

  if (userCount === 0) {
    // NOTE: bcryptjs hashing should be done outside, but for seed we can do it here. 
    // We will hardcode the hash for "admin123" to avoid top-level await imports block if not strictly needed,
    // or we can import bcryptjs dynamically.
    import('bcryptjs').then(bcrypt => {
      const salt = bcrypt.genSaltSync(10);
      const hash = bcrypt.hashSync('admin123', salt);
      const insertUser = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)');
      insertUser.run('Total Admin', 'admin@admin.com', hash, 'Admin');
      console.log('✅ Default admin user created (admin@admin.com / admin123)');
    }).catch(err => console.error('Failed to seed admin', err));
  }

  // Integrations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      url TEXT,
      icon_emoji VARCHAR(10) DEFAULT '🔗',
      display_order INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  // Default Integrations check
  const integrationCountRow = db.prepare('SELECT COUNT(*) as count FROM integrations').get();
  const integrationCount = integrationCountRow?.count || 0;

  if (integrationCount === 0) {
    const defaultIntegrations = [
      ['Career System', '전사 통합 인재 관리 및 경력 개발 시스템', 'https://career.inpix.com', '🎓', 1],
      ['Technical Support', 'IT 지원 및 기술 문의 접수 채널', 'https://support.inpix.com', '🛡️', 2],
      ['Internal Docs', '프로젝트 가이드 및 전사 표준 문서함', 'https://docs.inpix.com', '📚', 3]
    ];

    const insertIntegration = db.prepare('INSERT INTO integrations (name, description, url, icon_emoji, display_order) VALUES (?, ?, ?, ?, ?)');
    for (const item of defaultIntegrations) {
      insertIntegration.run(item);
    }
  }

  // Project Reports table for shared weekly reporting
  db.exec(`
    CREATE TABLE IF NOT EXISTS project_reports (
      week_date DATE PRIMARY KEY,
      data_json TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log('✅ Database initialized successfully');
}

export function query(sql, ...params) {
  try {
    return db.prepare(sql).all(...params);
  } catch (error) {
    console.error('Query error:', error);
    throw error;
  }
}

export function run(sql, ...params) {
  try {
    const info = db.prepare(sql).run(...params);
    return info;
  } catch (error) {
    console.error('Run error:', error);
    throw error;
  }
}

export function get(sql, ...params) {
  try {
    return db.prepare(sql).get(...params);
  } catch (error) {
    console.error('Get error:', error);
    throw error;
  }
}

export async function getDB() {
  if (!db) {
    await initializeDatabase();
  }
  return db;
}

export function saveDatabase() {
  // better-sqlite3 is persistence-by-default, no-op for compatibility
}

export default { initializeDatabase, query, run, get, saveDatabase, getDB };
