import { query, initializeDatabase } from './db.js';

(async () => {
    await initializeDatabase();
    const res = await query("SELECT id, name, employment_type, status FROM employees WHERE name IN ('오지혜', '송시아')");
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
})();
