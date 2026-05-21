import express from 'express';
import { query, run, get, saveDatabase } from '../db.js';
import { requireRoles } from '../middleware/auth.js';

const router = express.Router();

// Groups can be viewed/managed by Admin, GroupLeader, PD, TeamLeader, and GM
router.use(requireRoles(['Admin', 'GroupLeader', 'PD', 'TeamLeader', 'GM']));

// Get all groups
router.get('/', async (req, res) => {
    try {
        const groups = await query(`
      SELECT g.*, 
             COUNT(e.id) as employee_count
      FROM groups g
      LEFT JOIN employees e ON g.id = e.group_id AND e.status = 'active'
      GROUP BY g.id
      ORDER BY g.display_order
    `);

        res.json(groups);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get single group
router.get('/:id', async (req, res) => {
    try {
        const group = await get('SELECT * FROM groups WHERE id = ?', [req.params.id]);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        res.json(group);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new group
router.post('/', async (req, res) => {
    try {
        const { name, color } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Group name is required' });
        }

        // Get max display_order
        const maxOrderResult = await get('SELECT MAX(display_order) as max FROM groups');
        const displayOrder = (maxOrderResult?.max || 0) + 1;

        const result = await run(`
      INSERT INTO groups (name, color, display_order)
      VALUES (?, ?, ?)
      RETURNING id
    `, [name, color || '#3B82F6', displayOrder]);

        const newGroup = await get('SELECT * FROM groups WHERE id = ?', [result.rows[0].id]);
        res.status(201).json(newGroup);
    } catch (error) {
        if (error.message.includes('UNIQUE constraint failed')) {
            res.status(400).json({ error: 'Group name already exists' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Update group
router.put('/:id', async (req, res) => {
    try {
        const { name, color, display_order } = req.body;
        const updates = [];
        const values = [];

        if (name !== undefined) {
            updates.push('name = ?');
            values.push(name);
        }
        if (color !== undefined) {
            updates.push('color = ?');
            values.push(color);
        }
        if (display_order !== undefined) {
            updates.push('display_order = ?');
            values.push(display_order);
        }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id);

        const result = await run(`
      UPDATE groups 
      SET ${updates.join(', ')}
      WHERE id = ?
    `, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }

        const updatedGroup = await get('SELECT * FROM groups WHERE id = ?', [req.params.id]);
        res.json(updatedGroup);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete group
router.delete('/:id', async (req, res) => {
    try {
        // Check if group has employees
        const employeeCountResult = await get(
            'SELECT COUNT(*) as count FROM employees WHERE group_id = ?',
            [req.params.id]
        );

        if (employeeCountResult?.count > 0) {
            return res.status(400).json({
                error: 'Cannot delete group with employees. Please reassign or delete employees first.'
            });
        }

        const result = await run('DELETE FROM groups WHERE id = ?', [req.params.id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Group not found' });
        }

        res.json({ message: 'Group deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
