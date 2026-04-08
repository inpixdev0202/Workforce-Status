import fs from 'fs';
import path from 'path';

const routesDir = path.join(process.cwd(), 'routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
files.push('../server.js');

for (const file of files) {
    const filePath = file === '../server.js' ? path.join(process.cwd(), 'server.js') : path.join(routesDir, file);
    if (!fs.existsSync(filePath)) continue;
    
    let content = fs.readFileSync(filePath, 'utf8');
    
    // 1. Simple replace for router.(method)(..., (req, res) => {
    // Only replacing the exact '(req, res) => {' or '(req, res, next) => {' 
    // to 'async (req, res) => {'
    content = content.replace(/\(req,\s*res\)\s*=>\s*\{/g, 'async (req, res) => {');
    content = content.replace(/\(req,\s*res,\s*next\)\s*=>\s*\{/g, 'async (req, res, next) => {');
    
    // Prevent double async if already async
    content = content.replace(/async\s+async/g, 'async');

    // 2. Await query, get, run
    content = content.replace(/([^a-zA-Z0-9_])query\s*\(/g, '$1await query(');
    content = content.replace(/([^a-zA-Z0-9_])get\s*\(/g, '$1await get(');
    content = content.replace(/([^a-zA-Z0-9_])run\s*\(/g, '$1await run(');
    
    // Clean up double awaits
    content = content.replace(/await\s+await/g, 'await');
    
    fs.writeFileSync(filePath, content);
    console.log(`Processed ${file}`);
}
console.log('Done refactoring!');
