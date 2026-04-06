import { initializeDatabase, query, get } from './db.js';
import { startOfMonth, endOfMonth, format, eachDayOfInterval, isWeekend, startOfWeek, addWeeks } from 'date-fns';

async function main() {
    await initializeDatabase();

    // Test for 'SCG' which had 19.8% discrepancy
    const group = get("SELECT * FROM groups WHERE name LIKE '%SCG%'");

    // Fetch Employees
    const employees = query(`SELECT id, group_id, name, employment_type FROM employees WHERE status = 'active' AND group_id = ${group.id}`);
    const regularEmployees = employees.filter(e => e.employment_type === 'Regular' || e.employment_type === '정규직' || e.employment_type === 'Permanent');
    let headcount = regularEmployees.length;

    const now = new Date('2026-02-23T10:00:00+09:00');

    // We need up to 12 weeks of allocations
    const rangeStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd');
    const rangeEnd = format(addWeeks(startOfWeek(now, { weekStartsOn: 1 }), 14), 'yyyy-MM-dd');

    const allAllocations = query(`
        SELECT pa.assignment_id, pa.period_date, pa.value, e.id as employee_id
        FROM project_allocations pa
        JOIN project_assignments pass ON pa.assignment_id = pass.id
        JOIN employees e ON pass.employee_id = e.id
        WHERE pa.period_date BETWEEN '${rangeStart}' AND '${rangeEnd}' AND e.status = 'active' AND e.group_id = ${group.id}
    `);

    const allocMap = {};
    allAllocations.forEach(row => {
        if (!allocMap[row.employee_id]) allocMap[row.employee_id] = {};
        allocMap[row.employee_id][row.period_date] = parseFloat(row.value);
    });

    // Mirror calculateGroupStats from ProjectStatus.jsx
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });

    // Generate an array of 14 weeks from this week 
    const weeksArr = [];
    for (let i = 0; i < 15; i++) {
        weeksArr.push(addWeeks(thisWeekStart, i));
    }

    const weeklyStatus = {};
    weeksArr.forEach(week => {
        const dateStr = format(week, 'yyyy-MM-dd');
        const empTotals = {};

        // Sum allocations for the week for each employee
        allAllocations.forEach(a => {
            if (a.period_date === dateStr) {
                if (!empTotals[a.employee_id]) empTotals[a.employee_id] = 0;
                empTotals[a.employee_id] += parseFloat(a.value || 0);
            }
        });

        const zeroContext = [];
        regularEmployees.forEach(emp => {
            const total = empTotals[emp.id] || 0;
            // The frontend logic considers 0 total as "zero" 
            if (total === 0) zeroContext.push(emp.name);
        });

        weeklyStatus[dateStr] = { zero: zeroContext };
    });

    const monthWeeks = (offset) => {
        const start = addWeeks(thisWeekStart, offset);
        const end = addWeeks(start, 3);
        const mWs = weeksArr.filter(w => w >= start && w <= end);
        if (mWs.length === 0) return { count: 0, rate: 0 };

        const avgIdleCount = mWs.reduce((sum, w) => sum + (weeklyStatus[format(w, 'yyyy-MM-dd')]?.zero?.length || 0), 0) / mWs.length;
        const regularCount = headcount || 1;
        return { count: Math.round(avgIdleCount), rate: ((avgIdleCount / regularCount) * 100).toFixed(1) };
    };

    console.log("=== SCG REPLICATED FRONTEND STATS ===");
    console.log("This Month (Avg):", monthWeeks(0));
    console.log("Month +1 (Avg):", monthWeeks(4));
    console.log("Month +2 (Avg):", monthWeeks(8));
    console.log("Month +3 (Avg):", monthWeeks(12));

}

main().catch(console.error);
