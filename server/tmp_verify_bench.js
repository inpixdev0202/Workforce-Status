import { query, initializeDatabase } from './db.js';

async function verify() {
    await initializeDatabase();
    const todayStr = new Date().toISOString().split('T')[0];

    console.log('--- Verifying Bench List with Leave Status ---');
    const benchList = query(`
        SELECT DISTINCT e.id, e.name, e.position, e.skill_level, e.employment_type, g.name as group_name, g.color as group_color,
        (SELECT p.name FROM project_assignments pa JOIN projects p ON pa.project_id = p.id 
         WHERE pa.employee_id = e.id AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
         AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL) AND p.type IN ('Leave', 'Annual') LIMIT 1) as leave_status
        FROM employees e 
        LEFT JOIN groups g ON e.group_id = g.id
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
        AND (e.exclude_from_stats IS NULL OR e.exclude_from_stats = 0)
    `, [todayStr, todayStr, todayStr, todayStr]);

    const seo = benchList.find(b => b.name === '서선희');
    console.log('Seo Sun-hee:', seo);

    const leaveEmployees = benchList.filter(b => b.leave_status);
    console.log('Total Bench:', benchList.length);
    console.log('Bench with Leave Status:', leaveEmployees.map(e => `${e.name}: ${e.leave_status}`));
}

verify();
