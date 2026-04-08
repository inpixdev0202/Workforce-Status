import sqlite3 from 'sqlite3';
const db = new sqlite3.Database('d:/Workforce-Status/server/database.db');

const todayStr = new Date().toISOString().split('T')[0];

db.serialize(() => {
    db.get("SELECT COUNT(*) as count FROM employees WHERE status = 'active' AND (exclude_from_stats IS NULL OR exclude_from_stats = 0)", (err, row) => {
        if (err) console.error(err);
        console.log('Total Employees (active):', row?.count);
    });

    db.get('SELECT COUNT(*) as count FROM groups', (err, row) => {
        if (err) console.log(err);
        console.log('Total Groups:', row?.count);
    });

    db.get(`
        SELECT COUNT(DISTINCT pa.employee_id) as count 
        FROM project_assignments pa
        JOIN projects p ON pa.project_id = p.id
        WHERE p.status = 'active'
          AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL)
          AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL)
          AND p.type = 'Client'
    `, [todayStr, todayStr], (err, row) => {
        if (err) console.error(err);
        console.log('Active Client Assignments today:', row?.count);
    });
    
    db.all("SELECT id, name, status, type FROM projects WHERE status = 'active'", (err, rows) => {
        if (err) console.error(err);
        console.log('Active Projects:', rows);
    });
});
