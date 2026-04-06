const Database = require('better-sqlite3');
const db = new Database('workforce.db');

const rows = db.prepare("SELECT DISTINCT employment_type FROM employees").all();
console.log(rows);
