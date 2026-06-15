const { execSync } = require('child_process');
try {
    const out = execSync('git log -n 5 -p client/src/components/ProjectStatus.jsx', { encoding: 'utf8' });
    require('fs').writeFileSync('git_log_out.txt', out);
    console.log('Success');
} catch (e) {
    require('fs').writeFileSync('git_log_out.txt', e.message);
    console.log('Fail:', e.message);
}
