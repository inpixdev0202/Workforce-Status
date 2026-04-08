
import { initializeDatabase, query } from './db.js';

(async () => {
    await initializeDatabase();

    const types = query("SELECT DISTINCT employment_type FROM employees");
    console.log("Distinct employment types:", types);

    const scgEmployees = query("SELECT name, employment_type FROM employees WHERE group_id = (SELECT id FROM groups WHERE name = 'SCG')");
    console.log("SCG Employees:", scgEmployees);
})();
