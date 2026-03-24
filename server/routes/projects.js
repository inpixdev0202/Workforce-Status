import express from 'express';
import { query, run, get } from '../db.js';

const router = express.Router();

// Get all projects (simple list)
router.get('/', (req, res) => {
    try {
        const projects = query('SELECT * FROM projects ORDER BY name ASC');
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get all projects with assignments and allocations (Matrix Data)
router.get('/matrix', (req, res) => {
    try {
        // 1. Get Projects
        const projects = query(`
      SELECT * FROM projects 
      ORDER BY COALESCE(display_order, id) ASC
    `);

        // 2. Get Assignments with Employee info
        const assignments = query(`
      SELECT 
        pa.*,
        e.name as employee_name,
        e.position as employee_position,
        e.skill_level as employee_grade,
        e.employment_type as employee_employment_type,
        e.retirement_date,
        g.name as group_name,
        g.color as group_color
      FROM project_assignments pa
      JOIN employees e ON pa.employee_id = e.id
      LEFT JOIN groups g ON e.group_id = g.id
      ORDER BY COALESCE(pa.display_order, pa.id) ASC
    `);

        // 3. Get Allocations
        const allocations = query(`
      SELECT * FROM project_allocations
    `);

        // Organize data: Projects -> Assignments -> Allocations
        const matrix = projects.map(project => {
            const projAssignments = assignments.filter(a => a.project_id === project.id);

            const assignmentsWithAllocations = projAssignments.map(assignment => {
                const assignAllocations = allocations.filter(alloc => alloc.assignment_id === assignment.id);
                const allocationMap = {};
                assignAllocations.forEach(alloc => {
                    allocationMap[alloc.period_date] = alloc.value;
                });

                return {
                    ...assignment,
                    allocations: allocationMap
                };
            });

            return {
                ...project,
                members: assignmentsWithAllocations
            };
        });

        res.json(matrix);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create Project
router.post('/', (req, res) => {
    try {
        const { name, start_date, end_date, status, note, type, pd, pm } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Project name is required' });
        }

        // Get max order
        const maxOrder = get('SELECT MAX(display_order) as max_order FROM projects')?.max_order || 0;

        const result = run(`
      INSERT INTO projects (name, start_date, end_date, status, note, type, display_order, pd, pm)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [name, start_date || null, end_date || null, status || 'active', note || '', type || 'Client', maxOrder + 1, pd || '', pm || '']);

        const newProject = get('SELECT * FROM projects WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(newProject);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reorder Projects
router.put('/reorder', (req, res) => {
    try {
        const { projectIds } = req.body; // Array of IDs in new order
        if (!Array.isArray(projectIds)) return res.status(400).json({ error: 'Invalid projectIds' });

        run('BEGIN TRANSACTION');
        try {
            projectIds.forEach((id, index) => {
                run('UPDATE projects SET display_order = ? WHERE id = ?', [index, id]);
            });
            run('COMMIT');
            res.json({ success: true });
        } catch (e) {
            run('ROLLBACK');
            throw e;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Reorder Assignments within a project
router.put('/assignments/reorder', (req, res) => {
    try {
        const { assignmentIds } = req.body; // Array of IDs in new order
        if (!Array.isArray(assignmentIds)) return res.status(400).json({ error: 'Invalid assignmentIds' });

        run('BEGIN TRANSACTION');
        try {
            assignmentIds.forEach((id, index) => {
                run('UPDATE project_assignments SET display_order = ? WHERE id = ?', [index, id]);
            });
            run('COMMIT');
            res.json({ success: true });
        } catch (e) {
            run('ROLLBACK');
            throw e;
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Project
router.put('/:id', (req, res) => {
    try {
        const { name, start_date, end_date, status, note, type, pd, pm } = req.body;

        run(`
      UPDATE projects 
      SET name = ?, start_date = ?, end_date = ?, status = ?, note = ?, type = ?, pd = ?, pm = ?
      WHERE id = ?
    `, [name, start_date || null, end_date || null, status || 'active', note || '', type || 'Client', pd || '', pm || '', req.params.id]);

        const updated = get('SELECT * FROM projects WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete Project
router.delete('/:id', (req, res) => {
    try {
        run('DELETE FROM projects WHERE id = ?', [req.params.id]);
        res.json({ message: 'Project deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Assign Employee to Project
router.post('/:id/assign', (req, res) => {
    try {
        const { employee_id, role, input_start_date, input_end_date } = req.body;

        // Check if already assigned
        const exists = get(
            'SELECT id FROM project_assignments WHERE project_id = ? AND employee_id = ?',
            [req.params.id, employee_id]
        );

        if (exists) {
            return res.status(400).json({ error: 'Employee already assigned to this project' });
        }

        // Get max order
        const maxOrder = get('SELECT MAX(display_order) as max_order FROM project_assignments WHERE project_id = ?', [req.params.id])?.max_order || 0;

        const result = run(`
      INSERT INTO project_assignments (project_id, employee_id, role, input_start_date, input_end_date, display_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.params.id, employee_id, role || '', input_start_date || null, input_end_date || null, maxOrder + 1]);

        console.log(`[ASSIGN] Inserted ID: ${result.lastInsertRowid}`);

        const newAssignment = get(`
      SELECT pa.*, e.name as employee_name, e.position as employee_position, e.skill_level as employee_grade, e.employment_type as employee_employment_type, g.name as group_name, g.color as group_color
      FROM project_assignments pa
      LEFT JOIN employees e ON pa.employee_id = e.id
      LEFT JOIN groups g ON e.group_id = g.id
      WHERE pa.id = ?
    `, [result.lastInsertRowid]);

        console.log(`[ASSIGN] Fetched object:`, newAssignment ? 'SUCCESS' : 'NULL');

        if (!newAssignment) {
            throw new Error(`Failed to retrieve newly created assignment (ID: ${result.lastInsertRowid})`);
        }

        res.status(201).json(newAssignment);
    } catch (error) {
        console.error(`[ASSIGN] Error:`, error);
        res.status(500).json({ error: error.message });
    }
});

// Update Assignment (Role, Dates, Employee)
router.put('/assignments/:id', (req, res) => {
    try {
        const { role, input_start_date, input_end_date, employee_id, work_location } = req.body;
        console.log(`[ASSIGN UPDATE] ID: ${req.params.id}, role: ${role}, start: ${input_start_date}, end: ${input_end_date}, emp: ${employee_id}, loc: ${work_location}`);

        const updates = [];
        const params = [];

        if (role !== undefined) { updates.push('role = ?'); params.push(role); }
        if (input_start_date !== undefined) { updates.push('input_start_date = ?'); params.push(input_start_date); }
        if (input_end_date !== undefined) { updates.push('input_end_date = ?'); params.push(input_end_date); }
        if (employee_id !== undefined) { updates.push('employee_id = ?'); params.push(employee_id); }
        if (work_location !== undefined) { updates.push('work_location = ?'); params.push(work_location); }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(req.params.id);

        const result = run(`
      UPDATE project_assignments 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, params);
        console.log(`[ASSIGN UPDATE] DB Result:`, result);

        // Fetch updated info with joins to return full object
        const updated = get(`
            SELECT pa.*, e.name as employee_name, e.position as employee_position, e.skill_level as employee_grade, e.employment_type as employee_employment_type, g.name as group_name, g.color as group_color
            FROM project_assignments pa
            JOIN employees e ON pa.employee_id = e.id
            LEFT JOIN groups g ON e.group_id = g.id
            WHERE pa.id = ?
        `, [req.params.id]);

        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Remove Assignment
router.delete('/assignments/:id', (req, res) => {
    try {
        run('DELETE FROM project_assignments WHERE id = ?', [req.params.id]);
        res.json({ message: 'Member removed from project' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update Allocation (Single or Bulk)
router.post('/allocations', (req, res) => {
    try {
        const { assignment_id, date, value } = req.body; // Single update for simplicity first

        // Check existing
        const existing = get(
            'SELECT id FROM project_allocations WHERE assignment_id = ? AND period_date = ?',
            [assignment_id, date]
        );

        if (existing) {
            if (value === '' || value === null) {
                // Delete if empty
                run('DELETE FROM project_allocations WHERE id = ?', [existing.id]);
            } else {
                // Update
                run('UPDATE project_allocations SET value = ? WHERE id = ?', [value, existing.id]);
            }
        } else if (value !== '' && value !== null) {
            // Insert
            run(`
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

        // Use direct DB access to avoid saveDatabase() on every step
        const { getDB, saveDatabase } = await import('../db.js');
        const db = await getDB();

        // Prepare statements for performance inside the loop
        const checkStmt = db.prepare('SELECT id FROM project_allocations WHERE assignment_id = ? AND period_date = ?');
        const updateStmt = db.prepare('UPDATE project_allocations SET value = ? WHERE id = ?');
        const deleteStmt = db.prepare('DELETE FROM project_allocations WHERE id = ?');
        const insertStmt = db.prepare('INSERT INTO project_allocations (assignment_id, period_date, value) VALUES (?, ?, ?)');

        db.transaction((updates) => {
            for (const update of updates) {
                const { assignment_id, date, value } = update;

                // Check existing
                const existing = checkStmt.get(assignment_id, date);

                if (existing) {
                    if (value === '' || value === null) {
                        deleteStmt.run(existing.id);
                    } else {
                        updateStmt.run(value, existing.id);
                    }
                } else if (value !== '' && value !== null) {
                    insertStmt.run(assignment_id, date, value);
                }
            }
        })(updates);

        saveDatabase(); // Save once at the end
        res.json({ success: true, count: updates.length });
    } catch (error) {
        console.error('[BATCH UPDATE ERROR]', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
