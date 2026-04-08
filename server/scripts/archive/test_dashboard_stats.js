
async function testStats() {
    try {
        const response = await fetch('http://localhost:5000/api/dashboard/stats');
        console.log('Status:', response.status);
        const data = await response.json();

        if (data.idleStats) {
            console.log('✅ idleStats found');
            console.log('Periods:', data.idleStats.map(p => p.key).join(', '));
            console.log('First Period Sample:', JSON.stringify(data.idleStats[0], null, 2));
        } else {
            console.error('❌ idleStats MISSING in response');
        }

        if (data.monthlyTrend) {
            console.log('✅ monthlyTrend found');
            console.log('Sample:', data.monthlyTrend[0]);
        }

    } catch (error) {
        console.error('Error fetching stats:', error.message);
    }
}

testStats();
