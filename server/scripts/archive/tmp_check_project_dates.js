import { get, query, initializeDatabase } from './db.js';

async function check() {
    await initializeDatabase();

    console.log('--- Project Dates ---');
    const projects = query("SELECT * FROM projects WHERE name LIKE '%휴직%'");
    console.log(projects);
}

check();
