import axios from 'axios';

async function test() {
    try {
        const res = await axios.post('http://localhost:5000/api/projects/allocations', {
            assignment_id: 10,
            date: '2026-02-16',
            value: '1.0'
        });
        console.log('Response:', res.data);
    } catch (err) {
        console.error('Error:', err.response?.data || err.message);
    }
}

test();
