import { query, initializeDatabase } from './db.js';

async function check() {
    await initializeDatabase();

    console.log('--- Project Types ---');
    console.log(query("SELECT DISTINCT type FROM projects"));

    console.log('\n--- Projects with Annual (연차) in name ---');
    console.log(query("SELECT * FROM projects WHERE name LIKE '%연차%'"));

    const todayStr = new Date().toISOString().split('T')[0];

    console.log('\n--- Bench List and Status ---');
    const benchList = query(`
        SELECT e.id, e.name,
        (SELECT p.name FROM project_assignments pa JOIN projects p ON pa.project_id = p.id 
         WHERE pa.employee_id = e.id AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
         AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL) AND p.type IN ('Leave', 'Annual') LIMIT 1) as leave_status,
        (SELECT p.type FROM project_assignments pa JOIN projects p ON pa.project_id = p.id 
         WHERE pa.employee_id = e.id AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
         AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL) LIMIT 1) as any_status
        FROM employees e 
        WHERE e.status = 'active' 
          AND e.employment_type IN ('Regular', '정규직', 'Permanent')
          AND e.id NOT IN (
            SELECT employee_id 
            FROM project_assignments pa
            JOIN projects p ON pa.project_id = p.id
            WHERE (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
              AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL)
              AND p.type = 'Client'
        )
    `, [todayStr, todayStr, todayStr, todayStr, todayStr, todayStr]);

    console.log(benchList);
}

check();
