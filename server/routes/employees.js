import express from 'express';
import { query, run, get } from '../db.js';
import { requireRoles } from '../middleware/auth.js';

const router = express.Router();

// Employees can be viewed/managed by Admin, GroupLeader, PD, TeamLeader, and GM
router.use(requireRoles(['Admin', 'GroupLeader', 'PD', 'TeamLeader', 'GM']));

// Get all employees with filters
router.get('/', (req, res) => {
    try {
        const { group_id, status, search } = req.query;
        let sql = `
      SELECT e.*, g.name as group_name, g.color as group_color
      FROM employees e
      LEFT JOIN groups g ON e.group_id = g.id
      WHERE 1=1
    `;
        const params = [];

        if (group_id) {
            sql += ' AND e.group_id = ?';
            params.push(group_id);
        }

        if (status) {
            sql += ' AND e.status = ?';
            params.push(status);
        }

        if (search) {
            sql += ' AND (e.name LIKE ? OR e.position LIKE ?)';
            params.push(`%${search}%`, `%${search}%`);
        }

        sql += ' ORDER BY g.display_order, e.name';

        const employees = query(sql, params);
        res.json(employees);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single employee
router.get('/:id', (req, res) => {
    try {
        const employee = get(`
      SELECT e.*, g.name as group_name, g.color as group_color
      FROM employees e
      LEFT JOIN groups g ON e.group_id = g.id
      WHERE e.id = ?
    `, [req.params.id]);

        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        res.json(employee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new employee
router.post('/', (req, res) => {
    try {
        const {
            group_id,
            name,
            position,
            skill_level,
            employment_type,
            join_date,
            retirement_date,
            contact_email,
            contact_phone,
            status,
            notes,
            exclude_from_stats
        } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Employee name is required' });
        }

        const result = run(`
      INSERT INTO employees (
        group_id, name, position, skill_level, employment_type, join_date, retirement_date,
        contact_email, contact_phone, status, notes, exclude_from_stats
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
            group_id || null,
            name,
            position || null,
            skill_level || null,
            employment_type || null,
            join_date || null,
            retirement_date || null,
            contact_email || null,
            contact_phone || null,
            status || 'active',
            notes || null,
            exclude_from_stats || 0
        ]);

        const newEmployee = get(`
      SELECT e.*, g.name as group_name, g.color as group_color
      FROM employees e
      LEFT JOIN groups g ON e.group_id = g.id
      WHERE e.id = ?
    `, [result.lastInsertRowid]);

        res.status(201).json(newEmployee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update employee
router.put('/:id', (req, res) => {
    try {
        const allowedFields = [
            'group_id', 'name', 'position', 'skill_level', 'employment_type', 'join_date', 'retirement_date',
            'contact_email', 'contact_phone', 'status', 'notes', 'exclude_from_stats'
        ];

        const updates = [];
        const values = [];

        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates.push(`${field} = ?`);

                // Handle nullable integer fields
                if (field === 'group_id' && req.body[field] === '') {
                    values.push(null);
                } else {
                    values.push(req.body[field]);
                }
            }
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        // Add updated_at
        updates.push('updated_at = CURRENT_TIMESTAMP');

        const employeeId = parseInt(req.params.id);
        values.push(employeeId);

        // Debug: Check if employee exists first
        const check = get('SELECT id FROM employees WHERE id = ?', [employeeId]);
        console.log(`Pre-update check for ID ${employeeId}:`, check);

        console.log(`Updating employee ID ${employeeId} with values:`, values);

        const result = run(`
      UPDATE employees 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

        console.log('Update result:', result);

        if (result.changes === 0) {
            return res.status(404).json({ error: `Employee not found (ID: ${employeeId})` });
        }

        const updatedEmployee = get(`
      SELECT e.*, g.name as group_name, g.color as group_color
      FROM employees e
      LEFT JOIN groups g ON e.group_id = g.id
      WHERE e.id = ?
    `, [req.params.id]);

        res.json(updatedEmployee);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete employee
router.delete('/:id', (req, res) => {
    try {
        const result = run('DELETE FROM employees WHERE id = ?', [req.params.id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
