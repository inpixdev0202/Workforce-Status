import { query, initializeDatabase } from './db.js';

async function check() {
    await initializeDatabase();

    console.log('--- All projects with "휴직" in name ---');
    const projects = query("SELECT * FROM projects WHERE name LIKE '%휴직%'");
    console.log(projects);

    console.log('\n--- All assignments for these projects ---');
    const projectIds = projects.map(p => p.id);
    if (projectIds.length > 0) {
        const assignments = query(`
            SELECT pa.*, e.name as employee_name, p.name as project_name
            FROM project_assignments pa
            JOIN projects p ON pa.project_id = p.id
            JOIN employees e ON pa.employee_id = e.id
            WHERE pa.project_id IN (${projectIds.join(',')})
        `);
        console.log(assignments);
    }
}

check();
