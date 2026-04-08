import { initializeDatabase, query } from './db.js';

async function check() {
    await initializeDatabase();
    const rows = query("SELECT DISTINCT employment_type FROM employees");
    console.log('Unique Employment Types:', rows);

    const allEmps = query("SELECT name, employment_type FROM employees LIMIT 20");
    console.log('Sample Employees:', allEmps);
}

check();
