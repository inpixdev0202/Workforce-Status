import express from 'express';
import { query, run, get } from '../db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// Get report for a specific date
router.get('/:date', authenticateToken, (req, res) => {
    try {
        const { date } = req.params;
        const report = get('SELECT * FROM project_reports WHERE week_date = ?', date);
        
        if (report) {
            res.json(JSON.parse(report.data_json));
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('Error fetching project report:', error);
        res.status(500).json({ message: 'Error fetching report' });
    }
});

// Save report for a specific date
router.post('/', authenticateToken, (req, res) => {
    try {
        const { week_date, data } = req.body;
        if (!week_date || !data) {
            return res.status(400).json({ message: 'Missing date or data' });
        }

        const dataJson = JSON.stringify(data);
        
        // Use REPLACE INTO for SQLite to handle insert or update
        run(
            'INSERT OR REPLACE INTO project_reports (week_date, data_json, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
            week_date,
            dataJson
        );
        
        res.json({ message: 'Report saved successfully' });
    } catch (error) {
        console.error('Error saving project report:', error);
        res.status(500).json({ message: 'Error saving report' });
    }
});

export default router;
