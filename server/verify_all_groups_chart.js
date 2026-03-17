async function verifyAllGroups() {
    try {
        const res = await fetch('http://localhost:5000/api/dashboard/stats');
        const data = await res.json();
        const details = data.groupWorkforceDetails;

        console.log("=== Group Workforce Details Verification ===");
        details.forEach(g => {
            console.log(`\n[${g.name}]`);
            console.log(`  Client: ${g.client}`);
            console.log(`  Bench:  ${g.bench}`);
            if (g.bench > 0) {
                console.log(`    -> Names: ${g.benchNames.join(', ')}`);
            }
            console.log(`  Other:  ${g.other}`);
            if (g.other > 0) {
                console.log(`    -> Names: ${g.otherNames.join(', ')}`);
            }
        });
    } catch (err) {
        console.error("Failed to fetch dashboard stats", err.message);
    }
}

verifyAllGroups();
