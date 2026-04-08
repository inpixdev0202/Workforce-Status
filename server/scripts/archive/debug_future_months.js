import { initializeDatabase, query, get } from './db.js';
import { startOfMonth, endOfMonth, addMonths, format, eachDayOfInterval, isWeekend } from 'date-fns';

async function main() {
    await initializeDatabase();

    // 6 is 소셜미디어
    const employees = query("SELECT id, group_id, name, employment_type FROM employees WHERE status = 'active' AND group_id = 6");

    const now = new Date('2026-02-23T10:00:00+09:00'); // Fixed date
    const periods = [
        { key: 'month2', label: '+2개월 (April)', start: startOfMonth(addMonths(now, 2)), end: endOfMonth(addMonths(now, 2)) },
        { key: 'month3', label: '+3개월 (May)', start: startOfMonth(addMonths(now, 3)), end: endOfMonth(addMonths(now, 3)) }
    ];

    // Get all allocations for April and May
    const rangeStart = format(startOfMonth(addMonths(now, 2)), 'yyyy-MM-dd');
    const rangeEnd = format(endOfMonth(addMonths(now, 3)), 'yyyy-MM-dd');

    const allAllocations = query(`
        SELECT pa.assignment_id, pa.period_date, pa.value, e.id as employee_id, e.name as emp_name
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

    for (const period of periods) {
        const periodWorkingDays = getWorkingDays(period.start, period.end);
        const workingDayCount = periodWorkingDays.length;
        const maxPersonMM = workingDayCount * 0.2;

        console.log(`\n===========================================`);
        console.log(`Period ${period.label}: Working Days=${workingDayCount}, Max Person MM=${maxPersonMM.toFixed(2)}`);
        console.log(`===========================================`);

        let totalGroupCapacity = 0;
        let totalGroupAllocated = 0;

        employees.forEach(emp => {
            const isRegular = emp.employment_type === 'Regular' || emp.employment_type === '정규직' || emp.employment_type === 'Permanent';
            if (!isRegular) return;

            const empAllocations = allocMap[emp.id] || {};
            let empTotalAllocated = 0;

            periodWorkingDays.forEach(dateStr => {
                if (empAllocations[dateStr]) {
                    empTotalAllocated += empAllocations[dateStr];
                }
            });

            console.log(`Emp ${emp.name}: Total Allocated = ${empTotalAllocated.toFixed(2)} / ${maxPersonMM.toFixed(2)}`);

            totalGroupCapacity += maxPersonMM;
            totalGroupAllocated += empTotalAllocated;
        });

        const utilization = totalGroupCapacity > 0 ? (totalGroupAllocated / totalGroupCapacity) * 100 : 0;
        const idleRate = totalGroupCapacity > 0 ? (100 - utilization) : 0;

        console.log(`\nGroup Stats for ${period.label}:`);
        console.log(`Total Capacity: ${totalGroupCapacity.toFixed(2)}, Total Allocated: ${totalGroupAllocated.toFixed(2)}`);
        console.log(`Utilization: ${utilization.toFixed(1)}%, Idle Rate: ${idleRate.toFixed(1)}%`);
    }
}
main();
