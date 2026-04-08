import http from 'http';

const data = JSON.stringify({
    assignment_id: 10,
    date: '2026-02-16',
    value: '1.0'
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/projects/allocations',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('BODY:', body);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(data);
req.end();
