async function test() {
    try {
        const res = await fetch('http://localhost:5000/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'admin@admin.com', password: 'admin123' })
        });
        const data = await res.json();
        console.log('Login Response:', data);

        if (data.token) {
            console.log('Token acquired. Testing verify endpoint...');
            const verifyRes = await fetch('http://localhost:5000/api/auth/verify', {
                headers: { 'Authorization': `Bearer ${data.token}` }
            });
            const verifyData = await verifyRes.json();
            console.log('Verify Response:', verifyData);
        }
    } catch (err) {
        console.error('Test failed', err);
    }
}
test();
