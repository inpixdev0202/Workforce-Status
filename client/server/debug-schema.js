import { initializeDatabase, getDB } from './db.js';

async function checkSchema() {
    try {
        await initializeDatabase();
        const db = await getDB();

        console.log("Checking 'employees' table schema...");
        const result = db.exec("PRAGMA table_info(employees)");

        if (result.length > 0 && result[0].values) {
            console.log("Columns:");
            result[0].values.forEach(col => {
                console.log(`- ${col[1]} (${col[2]})`);
            });
        } else {
            console.log("Could not retrieve table info.");
        }
    } catch (err) {
        console.error("Error:", err);
    }
}

checkSchema();
