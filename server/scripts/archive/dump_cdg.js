import Database from 'better-sqlite3';

const db = new Database('database.db');

const cdg = db.prepare('SELECT id FROM groups WHERE name = ?').get('CDG');
const emps = db.prepare(`SELECT name, employment_type, exclude_from_stats FROM employees WHERE group_id = ? AND status='active'`).all(cdg.id);

console.log(`CDG Active Employees: ${emps.length}`);
emps.forEach(e => console.log(`- ${e.name} (${e.employment_type}, exclude: ${e.exclude_from_stats})`));
