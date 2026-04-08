import { get, query, initializeDatabase } from './db.js';

async function check() {
    await initializeDatabase();

    console.log('--- Leave/Annual Projects ---');
    const projects = query("SELECT * FROM projects WHERE type IN ('Leave', 'Annual')");
    console.log(projects);
}

check();
