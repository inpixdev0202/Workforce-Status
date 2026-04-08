import axios from 'axios';

async function testStats() {
    try {
        const response = await axios.get('http://localhost:5000/api/dashboard/stats');
        const benchList = response.data.benchList;
        const seo = benchList.find(b => b.name === '서선희');
        console.log('Seo Sun-hee from Bench List:', seo);

        const leaveEmployees = benchList.filter(b => b.leave_status);
        console.log('Employees with leave status:', leaveEmployees.map(e => `${e.name}: ${e.leave_status}`));
    } catch (error) {
        console.error('Error fetching stats:', error.message);
    }
}

testStats();
