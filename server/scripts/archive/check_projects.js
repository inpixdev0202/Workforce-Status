import { query } from './db.js';
(async () => {
    try {
        const row = await query('SELECT name, updated_at FROM projects ORDER BY updated_at DESC LIMIT 5');
        console.log(JSON.stringify(row, null, 2));
    } catch (e) {
        console.error(e);
    }
    process.exit();
})();
