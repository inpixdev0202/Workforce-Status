import express from 'express';
import { query, run, get } from '../db.js';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get all projects (simple list)
router.get('/', async (req, res) => {
    try {
        const projects = await query('SELECT * FROM projects ORDER BY name ASC');
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all projects with assignments and allocations (Matrix Data)
router.get('/matrix', authenticateToken, async (req, res) => {
    try {
        // Single query for projects + assignments + employee/group info
        const [projects, rows] = await Promise.all([
            query(`
                SELECT * FROM projects
                ORDER BY COALESCE(display_order, id) ASC
            `),
            query(`
                SELECT
                    pa.id, pa.project_id, pa.employee_id, pa.role,
                    pa.input_start_date, pa.input_end_date, pa.display_order, pa.work_location,
                    e.name AS employee_name,
                    e.position AS employee_position,
                    e.skill_level AS employee_grade,
                    e.employment_type AS employee_employment_type,
                    e.retirement_date,
                    g.name AS group_name,
                    g.color AS group_color,
                    alloc.period_date,
                    alloc.value AS alloc_value
                FROM project_assignments pa
                JOIN employees e ON pa.employee_id = e.id
                LEFT JOIN groups g ON e.group_id = g.id
                LEFT JOIN project_allocations alloc ON alloc.assignment_id = pa.id
                ORDER BY COALESCE(pa.display_order, pa.id) ASC, alloc.period_date ASC
            `)
        ]);

        // Build assignment map with allocations using Map for O(1) lookup
        const assignmentMap = new Map();
        for (const row of rows) {
            if (!assignmentMap.has(row.id)) {
                assignmentMap.set(row.id, {
                    id: row.id,
                    project_id: row.project_id,
                    employee_id: row.employee_id,
                    role: row.role,
                    input_start_date: row.input_start_date,
                    input_end_date: row.input_end_date,
                    display_order: row.display_order,
                    work_location: row.work_location,
                    employee_name: row.employee_name,
                    employee_position: row.employee_position,
                    employee_grade: row.employee_grade,
                    employee_employment_type: row.employee_employment_type,
                    retirement_date: row.retirement_date,
                    group_name: row.group_name,
                    group_color: row.group_color,
                    allocations: {}
                });
            }
            if (row.period_date) {
                assignmentMap.get(row.id).allocations[row.period_date] = parseFloat(row.alloc_value) || 0;
            }
        }

        // Group assignments by project using Map for O(1) lookup
        const projectAssignmentsMap = new Map();
        for (const assignment of assignmentMap.values()) {
            if (!projectAssignmentsMap.has(assignment.project_id)) {
                projectAssignmentsMap.set(assignment.project_id, []);
            }
            projectAssignmentsMap.get(assignment.project_id).push(assignment);
        }

        let matrix = projects.map(project => ({
            ...project,
            members: projectAssignmentsMap.get(project.id) || []
        }));

        res.json(matrix);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create Project
router.post('/', async (req, res) => {
    try {
        const { name, start_date, end_date, status, note, type, pd, pm, project_group, count_in_stats } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        // Get max order
        const maxOrder = (await get('SELECT MAX(display_order) as max_order FROM projects'))?.max_order || 0;

        // Internal projects default to excluded from stats unless explicitly set
        const resolvedType = type || 'Client';
        const resolvedCountInStats = count_in_stats !== undefined ? count_in_stats : (resolvedType === 'Internal' ? false : true);

        const result = await run(`
      INSERT INTO projects (name, start_date, end_date, status, note, type, display_order, pd, pm, project_group, count_in_stats)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [name, start_date || null, end_date || null, status || '진행중', note || '', resolvedType, maxOrder + 1, pd || '', pm || '', project_group || null, resolvedCountInStats]);

        const newProject = await get('SELECT * FROM projects WHERE id = ?', [result.rows[0].id]);
        res.status(201).json(newProject);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reorder Projects
router.put('/reorder', async (req, res) => {
    try {
        const { projectIds } = req.body; // Array of IDs in new order
        if (!Array.isArray(projectIds)) return res.status(400).json({ error: 'Invalid projectIds' });

        try {
            for (let index = 0; index < projectIds.length; index++) {
                const id = projectIds[index];
                await run('UPDATE projects SET display_order = ? WHERE id = ?', [index, id]);
            }
            res.json({ success: true });
        } catch (e) {
            throw e;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reorder Assignments within a project
router.put('/assignments/reorder', async (req, res) => {
    try {
        const { assignmentIds } = req.body; // Array of IDs in new order
        if (!Array.isArray(assignmentIds)) return res.status(400).json({ error: 'Invalid assignmentIds' });

        try {
            for (let index = 0; index < assignmentIds.length; index++) {
                const id = assignmentIds[index];
                await run('UPDATE project_assignments SET display_order = ? WHERE id = ?', [index, id]);
            }
            res.json({ success: true });
        } catch (e) {
            throw e;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Project
router.put('/:id', async (req, res) => {
    try {
        const { name, start_date, end_date, status, note, type, pd, pm, project_group, count_in_stats } = req.body;

        // Get old name before update to detect rename
        const existing = await get('SELECT name FROM projects WHERE id = ?', [req.params.id]);
        const oldName = existing?.name;

        const updateParams = [name, start_date || null, end_date || null, status || '진행중', note || '', type || 'Client', pd || '', pm || '', project_group || null];
        const countInStatsClause = count_in_stats !== undefined ? ', count_in_stats = ?' : '';
        if (count_in_stats !== undefined) updateParams.push(count_in_stats);
        updateParams.push(req.params.id);

        await run(`
      UPDATE projects
      SET name = ?, start_date = ?, end_date = ?, status = ?, note = ?, type = ?, pd = ?, pm = ?, project_group = ?${countInStatsClause}
      WHERE id = ?
    `, updateParams);

        // Propagate name change to all project_reports JSON
        if (oldName && name && oldName !== name) {
            const allReports = await query('SELECT week_date, data_json FROM project_reports');
            for (const report of allReports) {
                let rows;
                try { rows = JSON.parse(report.data_json); } catch { continue; }
                if (!Array.isArray(rows)) continue;

                let changed = false;
                const updatedRows = rows.map(row => {
                    if ((row.projectName || '').trim() === oldName.trim()) {
                        changed = true;
                        return { ...row, projectName: name };
                    }
                    return row;
                });

                if (changed) {
                    await run(
                        'UPDATE project_reports SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE week_date = ?',
                        [JSON.stringify(updatedRows), report.week_date]
                    );
                }
            }
            console.log(`[PROJECT RENAME] "${oldName}" → "${name}" propagated to project_reports`);
        }

        const updated = await get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Project
router.delete('/:id', async (req, res) => {
    try {
        // Get project name before deleting for cascade to project_reports
        const existing = await get('SELECT name FROM projects WHERE id = ?', [req.params.id]);
        const projectName = existing?.name;

        await run('DELETE FROM projects WHERE id = ?', [req.params.id]);

        // Cascade: remove matching rows from all project_reports JSON
        if (projectName) {
            const normalize = (name) => (name || '').replace(/\s*\(.*?\)\s*/g, '').replace(/\s*\[.*?\]\s*/g, '').replace(/\s+/g, '').trim().toUpperCase();
            const normalizedName = normalize(projectName);
            const allReports = await query('SELECT week_date, data_json FROM project_reports');
            for (const report of allReports) {
                let rows;
                try { rows = JSON.parse(report.data_json); } catch { continue; }
                if (!Array.isArray(rows)) continue;

                const filtered = rows.filter(row => normalize(row.projectName) !== normalizedName);
                if (filtered.length !== rows.length) {
                    await run(
                        'UPDATE project_reports SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE week_date = ?',
                        [JSON.stringify(filtered), report.week_date]
                    );
                }
            }
            console.log(`[PROJECT DELETE] "${projectName}" removed from project_reports`);
        }

        res.json({ message: 'Project deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Assign Employee to Project
router.post('/:id/assign', async (req, res) => {
    try {
        const { employee_id, role, input_start_date, input_end_date } = req.body;

        // Check if already assigned
        const exists = await get(
            'SELECT id FROM project_assignments WHERE project_id = ? AND employee_id = ?',
            [req.params.id, employee_id]
        );

        if (exists) {
            return res.status(400).json({ error: 'Employee already assigned to this project' });
        }

        // Get max order
        const maxOrder = (await get('SELECT MAX(display_order) as max_order FROM project_assignments WHERE project_id = ?', [req.params.id]))?.max_order || 0;

        const result = await run(`
      INSERT INTO project_assignments (project_id, employee_id, role, input_start_date, input_end_date, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING id
    `, [req.params.id, employee_id, role || '', input_start_date || null, input_end_date || null, maxOrder + 1]);

        const insertedId = result.rows[0].id;
        console.log(`[ASSIGN] Inserted ID: ${insertedId}`);

        const newAssignment = await get(`
      SELECT pa.*, e.name as employee_name, e.position as employee_position, e.skill_level as employee_grade, e.employment_type as employee_employment_type, g.name as group_name, g.color as group_color
      FROM project_assignments pa
      LEFT JOIN employees e ON pa.employee_id = e.id
      LEFT JOIN groups g ON e.group_id = g.id
      WHERE pa.id = ?
    `, [insertedId]);

        console.log(`[ASSIGN] Fetched object:`, newAssignment ? 'SUCCESS' : 'NULL');

        if (!newAssignment) {
            throw new Error(`Failed to retrieve newly created assignment (ID: ${insertedId})`);
        }

        res.status(201).json(newAssignment);
    } catch (error) {
        console.error(`[ASSIGN] Error:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Update Assignment (Role, Dates, Employee)
router.put('/assignments/:id', async (req, res) => {
    try {
        const { role, input_start_date, input_end_date, employee_id, work_location } = req.body;
        console.log(`[ASSIGN UPDATE] ID: ${req.params.id}, role: ${role}, start: ${input_start_date}, end: ${input_end_date}, emp: ${employee_id}, loc: ${work_location}`);

        const updates = [];
        const params = [];

        if (role !== undefined) { updates.push('role = ?'); params.push(role); }
        if (input_start_date !== undefined) { 
            updates.push('input_start_date = ?'); 
            params.push(input_start_date === '' ? null : input_start_date); 
        }
        if (input_end_date !== undefined) { 
            updates.push('input_end_date = ?'); 
            params.push(input_end_date === '' ? null : input_end_date); 
        }
        if (employee_id !== undefined) { 
            updates.push('employee_id = ?'); 
            params.push(employee_id === '' ? null : employee_id); 
        }
        if (work_location !== undefined) { updates.push('work_location = ?'); params.push(work_location); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(req.params.id);

        const result = await run(`
      UPDATE project_assignments 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);
        console.log(`[ASSIGN UPDATE] DB Result:`, result);

        // Fetch updated info with joins to return full object
        const updated = await get(`
            SELECT pa.*, e.name as employee_name, e.position as employee_position, e.skill_level as employee_grade, e.employment_type as employee_employment_type, g.name as group_name, g.color as group_color
            FROM project_assignments pa
            LEFT JOIN employees e ON pa.employee_id = e.id
            LEFT JOIN groups g ON e.group_id = g.id
            WHERE pa.id = ?
        `, [req.params.id]);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove Assignment
router.delete('/assignments/:id', async (req, res) => {
    try {
        await run('DELETE FROM project_assignments WHERE id = ?', [req.params.id]);
        res.json({ message: 'Member removed from project' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Allocation (Single or Bulk)
router.post('/allocations', async (req, res) => {
    try {
        const { assignment_id, date, value } = req.body; // Single update for simplicity first

        // Check existing
        const existing = await get(
            'SELECT id FROM project_allocations WHERE assignment_id = ? AND period_date = ?',
            [assignment_id, date]
        );

        if (existing) {
            if (value === '' || value === null) {
                // Delete if empty
                await run('DELETE FROM project_allocations WHERE id = ?', [existing.id]);
            } else {
                // Update
                await run('UPDATE project_allocations SET value = ? WHERE id = ?', [value, existing.id]);
            }
        } else if (value !== '' && value !== null) {
            // Insert
            await run(`
        INSERT INTO project_allocations (assignment_id, period_date, value)
        VALUES (?, ?, ?)
      `, [assignment_id, date, value]);
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk Update Allocations
router.post('/allocations/batch', async (req, res) => {
    try {
        const { updates } = req.body; // Expects array of { assignment_id, date, value }

        if (!Array.isArray(updates)) {
            return res.status(400).json({ error: 'Updates must be an array' });
        }

        for (const update of updates) {
            const { assignment_id, date, value } = update;

            if (value === '' || value === null) {
                await run('DELETE FROM project_allocations WHERE assignment_id = ? AND period_date = ?', [assignment_id, date]);
            } else {
                await run(`
                    INSERT INTO project_allocations (assignment_id, period_date, value) 
                    VALUES (?, ?, ?)
                    ON CONFLICT (assignment_id, period_date) 
                    DO UPDATE SET value = EXCLUDED.value
                `, [assignment_id, date, value]);
            }
        }

        res.json({ success: true, count: updates.length });
    } catch (error) {
        console.error('[BATCH UPDATE ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
