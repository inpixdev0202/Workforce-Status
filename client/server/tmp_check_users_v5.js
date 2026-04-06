import { query, initializeDatabase } from './db.js';

async function check() {
    try {
        await initializeDatabase();
        const cols = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
        console.log('Columns:', JSON.stringify(cols, null, 2));
        
        const users = await query("SELECT id, name, permissions FROM users LIMIT 5");
        console.log('Users found:', users.length);
        users.forEach(u => {
            console.log(`ID: ${u.id}, Name: ${u.name}`);
            console.log(`  Permissions Raw: ${u.permissions}`);
            console.log(`  Permissions Type: ${typeof u.permissions}`);
            try {
                if (typeof u.permissions === 'string') {
                    JSON.parse(u.permissions);
                    console.log('  JSON.parse: Success');
                } else {
                    console.log('  Permissions is already an object/null');
                }
            } catch (e) {
                console.log(`  JSON.parse: FAILED (${e.message})`);
            }
        });
    } catch (err) {
        console.error(err);
    } finally {
        process.exit();
    }
}

check();
