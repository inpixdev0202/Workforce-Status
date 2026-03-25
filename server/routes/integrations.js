import express from 'express';
import { query, run, get } from '../db.js';
import { requireRoles } from '../middleware/auth.js';

const router = express.Router();

// Integrations can be managed by Admin, GroupLeader, PD, TeamLeader, and GM (same as groups)
router.use(requireRoles(['Admin', 'GroupLeader', 'PD', 'TeamLeader', 'GM']));

// Get all integrations
router.get('/', async (req, res) => {
    try {
        const integrations = await query('SELECT * FROM integrations ORDER BY display_order');
        res.json(integrations);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create new integration
router.post('/', async (req, res) => {
    try {
        const { name, description, url, icon_emoji } = req.body;

        if (!name || !url) {
            return res.status(400).json({ error: 'Name and URL are required' });
        }

        const maxOrderResult = await get('SELECT MAX(display_order) as max FROM integrations');
        const displayOrder = (maxOrderResult?.max || 0) + 1;

        const result = await run(`
            INSERT INTO integrations (name, description, url, icon_emoji, display_order)
            VALUES (?, ?, ?, ?, ?)
        `, [name, description, url, icon_emoji || '🔗', displayOrder]);

        const newIntegration = await get('SELECT * FROM integrations WHERE id = ?', [result.lastInsertRowid]);
        res.status(201).json(newIntegration);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update integration
router.put('/:id', async (req, res) => {
    try {
        const { name, description, url, icon_emoji, display_order } = req.body;
        const updates = [];
        const values = [];

        if (name !== undefined) { updates.push('name = ?'); values.push(name); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (url !== undefined) { updates.push('url = ?'); values.push(url); }
        if (icon_emoji !== undefined) { updates.push('icon_emoji = ?'); values.push(icon_emoji); }
        if (display_order !== undefined) { updates.push('display_order = ?'); values.push(display_order); }

        if (updates.length === 0) {
            return res.status(400).json({ error: 'No fields to update' });
        }

        values.push(req.params.id);

        const result = await run(`
            UPDATE integrations 
            SET ${updates.join(', ')}
            WHERE id = ?
        `, values);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Integration not found' });
        }

        const updated = await get('SELECT * FROM integrations WHERE id = ?', [req.params.id]);
        res.json(updated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete integration
router.delete('/:id', async (req, res) => {
    try {
        const result = await run('DELETE FROM integrations WHERE id = ?', [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Integration not found' });
        }
        res.json({ message: 'Integration deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
