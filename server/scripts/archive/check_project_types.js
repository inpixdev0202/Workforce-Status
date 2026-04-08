
import { initializeDatabase, query } from './db.js';

(async () => {
    await initializeDatabase();
    const projects = query("SELECT id, name, type, status FROM projects");
    console.log("Projects:", projects);
})();
