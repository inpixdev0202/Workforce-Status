import { initializeDatabase, query, get } from './db.js';

async function main() {
    await initializeDatabase();
    console.log('DB initialized');

    const group = get("SELECT * FROM groups WHERE name LIKE '%소셜미디어%'");
    console.log('Group:', group);
    if (!group) return;

    const emps = query(`SELECT id, name, employment_type FROM employees WHERE group_id = ${group.id}`);
    console.log('Employees in this group:', emps);

    // Check allocations for these employees
    const empIds = emps.map(e => e.id);
    if (empIds.length > 0) {
        const assigns = query(`SELECT pa.*, p.name as project_name FROM project_assignments pa JOIN projects p ON pa.project_id = p.id WHERE pa.employee_id IN (${empIds.join(',')})`);

        console.log(`\nAssignments found: ${assigns.length}`);
        for (const assign of assigns) {
            console.log(`- Assign ${assign.id}: Employee ID ${assign.employee_id} -> Project ${assign.project_name} (${assign.input_start_date} to ${assign.input_end_date}) MM: ${assign.mm_allocation}`);
        }

        const assignIds = assigns.map(a => a.id);
        if (assignIds.length > 0) {
            const allocs = query(`
                SELECT a.assignment_id, a.period_date, a.value, e.name 
                FROM project_allocations a
                JOIN project_assignments pa ON a.assignment_id = pa.id
                JOIN employees e ON pa.employee_id = e.id
                WHERE a.assignment_id IN (${assignIds.join(',')}) 
            `);
            console.log(`\nTotal allocation records found: ${allocs.length}`);

            // Just sum by employee for February
            const febAllocs = allocs.filter(a => a.period_date.startsWith('2026-02'));
            const byEmp = {};
            febAllocs.forEach(al => {
                if (!byEmp[al.name]) byEmp[al.name] = 0;
                byEmp[al.name] += parseFloat(al.value);
            });
            console.log('\nTotal MM Allocated per employee in February 2026:');
            console.log(byEmp);
        }
    }
}
main();
