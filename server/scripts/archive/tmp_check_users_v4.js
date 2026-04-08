const { query, initializeDatabase } = require('./server/db.js');

async function check() {
    try {
        await initializeDatabase();
        const cols = await query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'");
        console.log('Columns:', JSON.stringify(cols, null, 2));
        
        const users = await query("SELECT id, name, permissions FROM users LIMIT 1");
        if (users.length > 0) {
            console.log('Sample User Permissions:', users[0].permissions);
            console.log('Type of Permissions:', typeof users[0].permissions);
        }
    } catch (err) {
        console.error(err);
    }
}

check();
