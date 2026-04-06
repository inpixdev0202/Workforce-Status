
import { initializeDatabase, run, get, query } from './db.js';

async function seedProjects() {
    await initializeDatabase();

    // Clean up if needed or just add
    // run('DELETE FROM projects');
    // run('DELETE FROM project_assignments');

    console.log('Seeding Project Data...');

    // Create Project 1
    try {
        const existing = get("SELECT id FROM projects WHERE name = '비대면 교체 어플리케이션 프로젝트'");
        let projectId;

        if (!existing) {
            const res = run(
                "INSERT INTO projects (name, start_date, end_date, status) VALUES (?, ?, ?, ?)",
                ['비대면 교체 어플리케이션 프로젝트', '2025-05-10', '2026-01-30', 'active']
            );
            projectId = res.lastInsertRowid;
            console.log('Created project: 비대면 교체 어플리케이션 프로젝트');
        } else {
            projectId = existing.id;
            console.log('Project exists:', projectId);
        }

        // Assign some employees
        const employees = query("SELECT id, name FROM employees LIMIT 5");

        if (employees.length > 0) {
            const roles = ['PM', 'PL', 'Developer', 'Developer', 'Designer'];

            for (let i = 0; i < employees.length; i++) {
                const emp = employees[i];
                const role = roles[i] || 'Member';

                const assignExists = get(
                    "SELECT id FROM project_assignments WHERE project_id = ? AND employee_id = ?",
                    [projectId, emp.id]
                );

                if (!assignExists) {
                    const assignRes = run(
                        "INSERT INTO project_assignments (project_id, employee_id, role) VALUES (?, ?, ?)",
                        [projectId, emp.id, role]
                    );

                    // Add some random allocations for next 4 weeks
                    const allocId = assignRes.lastInsertRowid;
                    const dates = ['2026-02-09', '2026-02-16', '2026-02-23', '2026-03-02'];

                    for (const d of dates) {
                        run(
                            "INSERT INTO project_allocations (assignment_id, period_date, value) VALUES (?, ?, ?)",
                            [allocId, d, 1.0]
                        );
                    }

                    console.log(`Assigned ${emp.name} to project`);
                }
            }
        }

    } catch (err) {
        console.error('Error seeding projects:', err);
    }
}

seedProjects();
