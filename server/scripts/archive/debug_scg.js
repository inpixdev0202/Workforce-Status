import { initializeDatabase, query, get } from './db.js';
import { startOfMonth, endOfMonth, format, eachDayOfInterval, isWeekend } from 'date-fns';

async function main() {
    await initializeDatabase();
    const group = get("SELECT * FROM groups WHERE name LIKE '%SCG%'");
    const employees = query(`SELECT id, group_id, name, employment_type FROM employees WHERE status = 'active' AND group_id = ${group.id}`);

    const now = new Date('2026-02-23T10:00:00+09:00');
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const rangeStart = format(start, 'yyyy-MM-dd');
    const rangeEnd = format(end, 'yyyy-MM-dd');

    const allAllocations = query(`SELECT pa.assignment_id, pa.period_date, pa.value, e.id as employee_id FROM project_allocations pa JOIN project_assignments pass ON pa.assignment_id = pass.id JOIN employees e ON pass.employee_id = e.id WHERE pa.period_date BETWEEN '${rangeStart}' AND '${rangeEnd}' AND e.status = 'active' AND e.group_id = ${group.id}`);

    const allocMap = {};
    allAllocations.forEach(row => {
        if (!allocMap[row.employee_id]) allocMap[row.employee_id] = {};
        allocMap[row.employee_id][row.period_date] = parseFloat(row.value);
    });

    const getWorkingDays = (s, e) => {
        const days = eachDayOfInterval({ start: s, end: e });
        return days.filter(d => !isWeekend(d)).map(d => format(d, 'yyyy-MM-dd'));
    };

    const periodWorkingDays = getWorkingDays(start, end);
    const workingDayCount = periodWorkingDays.length;
    const maxPersonMM = workingDayCount * 0.2;

    let totalCapacity = 0;
    let totalAllocated = 0;
    let idleCount = 0;

    console.log("=== SCG EMPLOYEES ===");
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

        let effectiveAllocated = empTotalAllocated;
        if (effectiveAllocated >= 4.0) {
            effectiveAllocated = Math.max(effectiveAllocated, maxPersonMM);
        } else if (effectiveAllocated > maxPersonMM) {
            effectiveAllocated = maxPersonMM;
        }

        const isIdle = empTotalAllocated < (maxPersonMM * 0.5);

        console.log(`Emp: ${emp.name} | Raw: ${empTotalAllocated} | Effective: || ${effectiveAllocated} | IsIdle: ${isIdle}`);

        totalCapacity += maxPersonMM;
        totalAllocated += effectiveAllocated;
        if (isIdle) idleCount += 1;
    });

    const utilization = totalCapacity > 0 ? (totalAllocated / totalCapacity) * 100 : 0;
    const idleRate = totalCapacity > 0 ? (100 - utilization) : 0;

    console.log("=== SCG SUMMARY ===");
    console.log(`Total Capacity: ${totalCapacity}`);
    console.log(`Total Allocated: ${totalAllocated}`);
    console.log(`Idle Rate: ${idleRate}%`);
    console.log(`Idle Count: ${idleCount}`);
}
main();
