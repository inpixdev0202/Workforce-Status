import db from './db.js';

async function checkDuplicates() {
    try {
        await db.initializeDatabase();
        const todayStr = new Date().toISOString().split('T')[0];

        const assignmentsCount = db.get(`
            SELECT COUNT(*) as count 
            FROM project_assignments pa 
            JOIN projects p ON pa.project_id = p.id 
            WHERE p.status = 'active' 
              AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL) 
              AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
              AND p.type = 'Client'
        `, [todayStr, todayStr]).count;

        const distinctEmpCount = db.get(`
            SELECT COUNT(DISTINCT pa.employee_id) as count 
            FROM project_assignments pa 
            JOIN projects p ON pa.project_id = p.id 
            WHERE p.status = 'active' 
              AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL) 
              AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
              AND p.type = 'Client'
        `, [todayStr, todayStr]).count;

        console.log('Total Assignments (Active/Client):', assignmentsCount);
        console.log('Distinct Employees (Active/Client):', distinctEmpCount);

        if (assignmentsCount !== distinctEmpCount) {
            const duplicates = db.query(`
                SELECT e.name, pa.employee_id, COUNT(*) as count 
                FROM project_assignments pa 
                JOIN projects p ON pa.project_id = p.id 
                JOIN employees e ON pa.employee_id = e.id
                WHERE p.status = 'active' 
                  AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL) 
                  AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
                  AND p.type = 'Client' 
                GROUP BY pa.employee_id 
                HAVING COUNT(*) > 1
            `, [todayStr, todayStr]);
            console.log('Employees with multiple assignments:', JSON.stringify(duplicates, null, 2));
        }

        const totalActiveEmployees = db.get("SELECT COUNT(*) as count FROM employees WHERE status = 'active'").count;
        console.log('Total Active Employees:', totalActiveEmployees);

        const benchCount = db.query(`
            SELECT DISTINCT e.id
            FROM employees e 
            WHERE e.status = 'active' AND e.id NOT IN (
                SELECT employee_id 
                FROM project_assignments pa
                JOIN projects p ON pa.project_id = p.id
                WHERE (pa.input_end_date >= ? OR pa.input_end_date IS NULL) 
                  AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL)
                  AND p.type = 'Client'
            )
        `, [todayStr, todayStr]).length;
        console.log('Bench Count:', benchCount);
        console.log('Sum (Distinct Client Emps + Bench):', distinctEmpCount + benchCount);

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

checkDuplicates();
