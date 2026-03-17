const http = require('http');

const putData = JSON.stringify({
    input_end_date: "2026-03-10"
});

const options = {
    hostname: 'localhost',
    port: 5000,
    path: '/api/projects/assignments/21', // 정하빈(or testing target)
    method: 'PUT',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(putData)
    }
};

console.log('--- Testing PUT /api/projects/assignments/21 ---');

const req = http.request(options, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    let responseBody = '';
    res.on('data', (chunk) => {
        responseBody += chunk;
    });
    res.on('end', () => {
        console.log('RESPONSE BODY:', responseBody);
    });
});

req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
});

req.write(putData);
req.end();
