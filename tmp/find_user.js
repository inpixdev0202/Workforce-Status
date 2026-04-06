import { query } from '../server/db.js';

async function findUser() {
    try {
        const users = await query('SELECT email FROM users LIMIT 1');
        console.log('USER_LIST:', JSON.stringify(users));
    } catch (e) {
        console.error(e);
    }
    process.exit();
}

findUser();
