import http from 'http';

http.get('http://localhost:5000/api/dashboard/stats', (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const details = json.groupWorkforceDetails;
            console.log('Group Workforce Details:');
            details.forEach(g => {
                console.log(`Group: ${g.name}`);
                console.log(`  Bench: ${g.bench} (${g.benchNames?.length || 0}) -> ${g.benchNames?.join(', ')}`);
                console.log(`  Other: ${g.other} (${g.otherNames?.length || 0}) -> ${g.otherNames?.join(', ')}`);
            });
        } catch (e) {
            console.error('Error parsing JSON:', e.message);
        }
    });
}).on('error', (err) => {
    console.error('Error:', err.message);
});
