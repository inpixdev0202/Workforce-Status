import { initializeDatabase, query, get } from './db.js';
import { startOfWeek, endOfWeek, addWeeks, startOfMonth, endOfMonth, addMonths, format, eachDayOfInterval, isWeekend, parseISO } from 'date-fns';

async function main() {
    await initializeDatabase();

    const employees = query("SELECT id, group_id, name, employment_type FROM employees WHERE status = 'active' AND group_id = 6"); // 6 is 소셜미디어
    const groups = query("SELECT id, name FROM groups WHERE id = 6");

    const now = new Date('2026-02-23T10:00:00+09:00'); // Simulated current date
    const period = { key: 'thisMonth', label: '이번 달', start: startOfMonth(now), end: endOfMonth(now) };

    const rangeStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const rangeEnd = format(endOfMonth(addMonths(now, 3)), 'yyyy-MM-dd');

    console.log(`Querying allocations between ${rangeStart} and ${rangeEnd}`);

    const allAllocations = query(`
        SELECT pa.assignment_id, pa.period_date, pa.value, e.id as employee_id, e.group_id
        FROM project_allocations pa
        JOIN project_assignments pass ON pa.assignment_id = pass.id
        JOIN employees e ON pass.employee_id = e.id
        WHERE pa.period_date BETWEEN '${rangeStart}' AND '${rangeEnd}' AND e.status = 'active' AND e.group_id = 6
    `);

    const allocMap = {};
    allAllocations.forEach(row => {
        if (!allocMap[row.employee_id]) allocMap[row.employee_id] = {};
        allocMap[row.employee_id][row.period_date] = parseFloat(row.value);
    });

    const getWorkingDays = (start, end) => {
        const days = eachDayOfInterval({ start, end });
        return days.filter(d => !isWeekend(d)).map(d => format(d, 'yyyy-MM-dd'));
    };

    const periodWorkingDays = getWorkingDays(period.start, period.end);
    const workingDayCount = periodWorkingDays.length;
    const maxPersonMM = workingDayCount * 0.2;

    console.log(`Period ${period.label}: Working Days=${workingDayCount}, Max Person MM=${maxPersonMM}`);

    const groupStats = { 6: { totalCapacity: 0, totalAllocated: 0, idleCount: 0, headcount: 0 } };

    employees.forEach(emp => {
        const isRegular = emp.employment_type === 'Regular' || emp.employment_type === '정규직' || emp.employment_type === 'Permanent';
        if (!isRegular) return;

        const empAllocations = allocMap[emp.id] || {};
        let empTotalAllocated = 0;

        periodWorkingDays.forEach(dateStr => {
            if (empAllocations[dateStr]) {
                empTotalAllocated += empAllocations[dateStr];
                console.log(`  - Found allocation for ${emp.name} on ${dateStr}: ${empAllocations[dateStr]}`);
            }
        });

        console.log(`Emp ${emp.name}: Total Allocated = ${empTotalAllocated} / ${maxPersonMM}`);

        const isIdle = empTotalAllocated < 0.1;

        groupStats[6].totalCapacity += maxPersonMM;
        groupStats[6].totalAllocated += empTotalAllocated;
        groupStats[6].headcount += 1;
        if (isIdle) groupStats[6].idleCount += 1;
    });

    const s = groupStats[6];
    const utilization = s.totalCapacity > 0 ? (s.totalAllocated / s.totalCapacity) * 100 : 0;
    const idleRate = s.totalCapacity > 0 ? (100 - utilization) : 0;

    console.log(`\nGroup Stats for thisMonth:`);
    console.log(`Total Capacity: ${s.totalCapacity}, Total Allocated: ${s.totalAllocated}`);
    console.log(`Utilization: ${utilization.toFixed(1)}%, Idle Rate: ${idleRate.toFixed(1)}%`);
}
main();
