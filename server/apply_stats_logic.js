import fs from 'fs';

const targetFile = 'd:\\Workforce-Status\\server\\server.js';
let content = fs.readFileSync(targetFile, 'utf8');

const regex = /\/\/ Define Periods[\s\S]*?return \{\s*key: period\.key,\s*label: period\.label,\s*totalIdleCount: totalStats\.idleCount,\s*totalIdleRate: Math\.max\(0, totalIdleRate\)\.toFixed\(1\),\s*byGroup: byGroup\s*\};\s*\}\);/g;

const newLogic = `// Define Periods
        const now = new Date();
        const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
        
        const periods = [
            { key: 'thisWeek', label: '이번 주', type: 'week', weeks: [thisWeekStart] },
            { key: 'nextWeek', label: '다음 주', type: 'week', weeks: [addWeeks(thisWeekStart, 1)] },
            { key: 'thisMonth', label: '이번 달', type: 'month', weeks: [thisWeekStart, addWeeks(thisWeekStart, 1), addWeeks(thisWeekStart, 2), addWeeks(thisWeekStart, 3)] },
            { key: 'month1', label: '+1개월', type: 'month', weeks: [addWeeks(thisWeekStart, 4), addWeeks(thisWeekStart, 5), addWeeks(thisWeekStart, 6), addWeeks(thisWeekStart, 7)] },
            { key: 'month2', label: '+2개월', type: 'month', weeks: [addWeeks(thisWeekStart, 8), addWeeks(thisWeekStart, 9), addWeeks(thisWeekStart, 10), addWeeks(thisWeekStart, 11)] },
            { key: 'month3', label: '+3개월', type: 'month', weeks: [addWeeks(thisWeekStart, 12), addWeeks(thisWeekStart, 13), addWeeks(thisWeekStart, 14), addWeeks(thisWeekStart, 15)] }
        ];

        // Fetch allocations for the entire required range
        const rangeStart = format(thisWeekStart, 'yyyy-MM-dd');
        const rangeEnd = format(addWeeks(thisWeekStart, 16), 'yyyy-MM-dd');

        const allAllocations = query(\`
            SELECT pa.assignment_id, pa.period_date, pa.value, e.id as employee_id, e.group_id
            FROM project_allocations pa
            JOIN project_assignments pass ON pa.assignment_id = pass.id
            JOIN employees e ON pass.employee_id = e.id
            WHERE pa.period_date BETWEEN ? AND ? AND e.status = 'active'
        \`, [rangeStart, rangeEnd]);

        // Build a map of employee allocations
        const allocMap = {};
        allAllocations.forEach(row => {
            if (!allocMap[row.employee_id]) allocMap[row.employee_id] = {};
            if (!allocMap[row.employee_id][row.period_date]) allocMap[row.employee_id][row.period_date] = 0;
            allocMap[row.employee_id][row.period_date] += parseFloat(row.value);
        });

        // Precalculate Regular Employee base per group
        const groupRegulars = {};
        let totalRegularHeadcount = 0;
        groups.forEach(g => {
            const regularsInGroup = employees.filter(e => 
                e.group_id === g.id && (e.employment_type === 'Regular' || e.employment_type === '정규직' || e.employment_type === 'Permanent')
            );
            groupRegulars[g.id] = regularsInGroup;
            totalRegularHeadcount += regularsInGroup.length;
        });

        // Calculate Stats for each Period
        const idleStats = periods.map(period => {
            const totalWeeklyZeroCounts = [];
            const groupWeeklyZeroCounts = {};
            groups.forEach(g => groupWeeklyZeroCounts[g.id] = []);

            period.weeks.forEach(weekStart => {
                const weekEnd = addDays(weekStart, 4); // Mon to Fri
                const workingDays = getWorkingDays(weekStart, weekEnd);
                
                let weeklyGlobalZero = 0;

                groups.forEach(g => {
                    const regulars = groupRegulars[g.id] || [];
                    let weeklyGroupZero = 0;

                    regulars.forEach(emp => {
                        let totalMMForWeek = 0;
                        workingDays.forEach(dateStr => {
                            totalMMForWeek += (allocMap[emp.id]?.[dateStr] || 0);
                        });

                        // Logic exactly matches ProjectStatus.jsx
                        if (totalMMForWeek < 0.1) {
                            weeklyGroupZero++;
                            weeklyGlobalZero++;
                        }
                    });

                    groupWeeklyZeroCounts[g.id].push(weeklyGroupZero);
                });

                totalWeeklyZeroCounts.push(weeklyGlobalZero);
            });

            // Averages across the mapped weeks
            const numWeeks = period.weeks.length || 1;
            const avgTotalIdle = totalWeeklyZeroCounts.reduce((a, b) => a + b, 0) / numWeeks;
            const totalIdleRate = totalRegularHeadcount > 0 ? (avgTotalIdle / totalRegularHeadcount) * 100 : 0;

            const byGroup = groups.map(g => {
                const avgGroupIdle = groupWeeklyZeroCounts[g.id].reduce((a, b) => a + b, 0) / numWeeks;
                const hc = groupRegulars[g.id]?.length || 1; // avoid div by zero
                const groupIdleRate = (groupRegulars[g.id]?.length > 0) ? (avgGroupIdle / hc) * 100 : 0;

                return {
                    id: g.id,
                    name: g.name,
                    idleCount: Math.round(avgGroupIdle),
                    idleRate: Math.max(0, groupIdleRate).toFixed(1)
                };
            });

            return {
                key: period.key,
                label: period.label,
                totalIdleCount: Math.round(avgTotalIdle),
                totalIdleRate: Math.max(0, totalIdleRate).toFixed(1),
                byGroup: byGroup
            };
        });`;

const updatedContent = content.replace(regex, newLogic);
fs.writeFileSync(targetFile, updatedContent, 'utf8');

if (content !== updatedContent) {
    console.log("Successfully replaced matched block.");
} else {
    console.log("Failed to match regex. No changes made.");
}
