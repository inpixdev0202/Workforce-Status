import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
files.push('../server.js');

for (const file of files) {
    const filePath = file === '../server.js' ? path.join(process.cwd(), 'server.js') : path.join(routesDir, file);
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    content = content.replace(/router\.await get\(/g, 'router.get(');
    content = content.replace(/router\.await post\(/g, 'router.post(');
    content = content.replace(/router\.await put\(/g, 'router.put(');
    content = content.replace(/router\.await delete\(/g, 'router.delete(');

    fs.writeFileSync(filePath, content);
}
console.log('Syntax fix done.');
