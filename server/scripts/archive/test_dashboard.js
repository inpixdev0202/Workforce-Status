import jwt from 'jsonwebtoken';

async function testDashboard() {
    const token = jwt.sign({ id: 1, role: 'Admin' }, 'your-super-secret-key');
    const res = await fetch('http://localhost:5000/api/dashboard/stats', {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });
    
    if (!res.ok) {
        console.error('Failed with status:', res.status);
        const text = await res.text();
        console.error(text);
    } else {
        console.log('Success!', await res.json());
    }
}
testDashboard().catch(console.error);
