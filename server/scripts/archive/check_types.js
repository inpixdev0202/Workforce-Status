const db = require('better-sqlite3')('workforce.db');

const rows = db.prepare("SELECT DISTINCT employment_type FROM employees").all();
console.log(rows);
