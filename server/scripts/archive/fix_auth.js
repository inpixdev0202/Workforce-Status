import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, 'database.db');

const db = new Database(dbPath);

async function fixAuth() {
    console.log('Checking users in database:', dbPath);
    
    const users = db.prepare('SELECT id, email, role FROM users').all();
    console.log('Current users:', users);

    const email = 'admin@admin.com';
    const password = 'admin123';
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(password, salt);

    const admin = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (admin) {
        console.log('Updating existing admin user...');
        db.prepare('UPDATE users SET password_hash = ?, role = ? WHERE email = ?')
          .run(hash, 'Admin', email);
        console.log('✅ Admin user updated successfully.');
    } else {
        console.log('Creating new admin user...');
        db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
          .run('System Admin', email, hash, 'Admin');
        console.log('✅ Admin user created successfully.');
    }

    // Verify
    const updatedAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    const isValid = bcrypt.compareSync(password, updatedAdmin.password_hash);
    console.log('Verification check (password "admin123"):', isValid ? 'PASSED' : 'FAILED');

    db.close();
}

fixAuth().catch(console.error);
