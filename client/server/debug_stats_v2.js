import { query, initializeDatabase } from './db.js';

async function test() {
    await initializeDatabase();
    const todayStr = new Date().toISOString().split('T')[0];
    const groups = query("SELECT id, name FROM groups");

    const groupWorkforceDetails = groups.map(g => {
        const groupEmployees = query(`
            SELECT e.id, e.employment_type, e.exclude_from_stats,
            (SELECT p.type FROM project_assignments pa JOIN projects p ON pa.project_id = p.id 
             WHERE pa.employee_id = e.id AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
             AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL) LIMIT 1) as current_project_type
            FROM employees e
            WHERE e.group_id = ? AND e.status = 'active'
        `, [todayStr, todayStr, g.id]);

        let client = 0;
        let bench = 0;
        let other = 0;

        groupEmployees.forEach(emp => {
            const isRegular = ['Regular', '정규직', 'Permanent'].includes(emp.employment_type);
            const isExcluded = !!emp.exclude_from_stats;
            const projectType = emp.current_project_type;

            if (isExcluded) {
                other++;
            } else if (projectType === 'Client') {
                client++;
            } else if (isRegular && (!projectType || projectType === 'Internal' || projectType === 'Bench')) {
                bench++;
            } else {
                other++;
            }
        });

        return {
            name: g.name,
            client,
            bench,
            other
        };
    });

    console.log(JSON.stringify(groupWorkforceDetails, null, 2));
}

test().catch(console.error);
