import Database from 'better-sqlite3';

const db = new Database('database.db');
const todayStr = new Date().toISOString().split('T')[0];

const emps = db.prepare(`SELECT id, name FROM employees WHERE name IN ('박두완', '설성학', '오허정', '권지영')`).all();

for (const emp of emps) {
    console.log(`\n================= ${emp.name} =================`);
    const assignments = db.prepare(`
        SELECT p.name as project_name, p.type, pa.input_start_date, pa.input_end_date
        FROM project_assignments pa
        JOIN projects p ON pa.project_id = p.id
        WHERE pa.employee_id = ?
          AND (pa.input_start_date <= ? OR pa.input_start_date IS NULL)
          AND (pa.input_end_date >= ? OR pa.input_end_date IS NULL)
    `).all(emp.id, todayStr, todayStr);

    console.log(assignments);
}
