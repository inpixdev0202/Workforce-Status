import db from './db.js';

async function inspect() {
    try {
        const projects = await db.query('SELECT id, name, status, type FROM projects');
        console.log('--- ALL PROJECTS IN DB ---');
        projects.forEach((p, i) => {
            console.log(`${i+1}. [${p.type}] ${p.name} (ID: ${p.id}) - Status: "${p.status}"`);
        });
        
        const ongoingClient = projects.filter(p => {
            const status = String(p.status || '').normalize('NFC').trim();
            // Checking common status variants
            return (status === '진행중' || status === '수행' || status === 'active' || status === 'Active') && p.type === 'Client';
        });
        
        console.log('\n--- ONGOING CLIENT PROJECTS (Potential matches) ---');
        ongoingClient.forEach((p, i) => {
            const normalizedStatus = String(p.status || '').normalize('NFC').trim();
            const willMatchCurrentLogic = (normalizedStatus === '진행중' || normalizedStatus === '수행');
            console.log(`${i+1}. ${p.name} | Status: "${p.status}" | Will match current logic: ${willMatchCurrentLogic}`);
        });
        
        console.log(`\nTotal Ongoing Client Potential: ${ongoingClient.length}`);
    } catch (e) {
        console.error('Inspection failed:', e);
    } finally {
        process.exit();
    }
}

inspect();
