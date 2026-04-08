import db from './db.js';

async function migrate() {
    try {
        console.log('--- STARTING STATUS MIGRATION ---');
        
        // 1. Update all 'active' or 'Active' to '진행중'
        const result = await db.run(`
            UPDATE projects 
            SET status = '진행중' 
            WHERE status = 'active' OR status = 'Active' OR status IS NULL OR status = ''
        `);
        
        console.log(`Successfully migrated ${result.changes} projects to "진행중".`);
        
        // 2. Verify Result
        const projects = await db.query("SELECT name, status FROM projects WHERE status = '진행중'");
        console.log(`\nVerification: Total projects with status "진행중": ${projects.length}`);
        projects.forEach((p, i) => {
            console.log(`${i+1}. ${p.name}`);
        });

        console.log('\n--- MIGRATION COMPLETED ---');
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        process.exit();
    }
}

migrate();
