import axios from 'axios';

async function testApi() {
    try {
        const response = await axios.get('http://localhost:5000/api/dashboard/stats');
        const details = response.data.groupWorkforceDetails;
        console.log('Group Workforce Details count:', details.length);
        details.forEach(g => {
            console.log(`Group: ${g.name}`);
            console.log(`  Bench Names (${g.benchNames?.length || 0}): ${g.benchNames?.join(', ') || 'N/A'}`);
            console.log(`  Other Names (${g.otherNames?.length || 0}): ${g.otherNames?.join(', ') || 'N/A'}`);
        });
    } catch (error) {
        console.error('Error fetching API:', error.message);
    }
}

testApi();
