import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

async function test() {
    try {
        console.log('--- TESTING ASSIGN (Lim Geun-hye ID 83) ---');
        const res = await axios.post(`${API_URL}/projects/1/assign`, {
            employee_id: 83
        });
        console.log('Response Status:', res.status);
        console.log('Response Data:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Error Status:', err.response?.status);
        console.error('Error Data:', err.response?.data);
    }
}

test();
