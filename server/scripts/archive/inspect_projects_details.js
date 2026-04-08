import db from './db.js';

async function inspect() {
    const projects = await db.query('SELECT name, start_date, end_date, pd, pm FROM projects');
    console.log(JSON.stringify(projects, null, 2));
    process.exit(0);
}

inspect();
