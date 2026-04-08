import Database from 'better-sqlite3';
const db = new Database('./database.db');
const results = db.prepare(`
    SELECT pa.id, e.name, p.name as proj_name, pa.input_start_date, pa.input_end_date 
    FROM project_assignments pa 
    JOIN employees e ON pa.employee_id = e.id 
    JOIN projects p ON pa.project_id = p.id 
    WHERE e.name = '박혜리'
`).all();
console.table(results);
db.close();
