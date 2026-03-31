import express from 'express';
import { get, run } from '../db.js';

const router = express.Router();

// Get the central sales data
router.get('/', async (req, res) => {
    try {
        const row = await get("SELECT data_json FROM sales_data WHERE key_name = 'main'");
        if (row) {
            // Return parsed JSON payload
            const parsed = typeof row.data_json === 'string' ? JSON.parse(row.data_json) : row.data_json;
            res.json(parsed);
        } else {
            // Respond with empty indicating frontend should initialize (or migrate)
            res.json(null);
        }
    } catch (err) {
        console.error('Failed to fetch sales data:', err);
        res.status(500).json({ error: 'Database query error while loading sales data' });
    }
});

// Upsert (Insert or Update) the central sales data
router.post('/', async (req, res) => {
    try {
        // req.body contains the entire state: rows, columns, widths, heights
        const dataJson = JSON.stringify(req.body);
        
        await run(`
            INSERT INTO sales_data (key_name, data_json, updated_at) 
            VALUES ('main', ?, CURRENT_TIMESTAMP)
            ON CONFLICT (key_name) 
            DO UPDATE SET data_json = EXCLUDED.data_json, updated_at = CURRENT_TIMESTAMP
        `, [dataJson]);

        res.json({ success: true });
    } catch (err) {
        console.error('Failed to save sales data:', err);
        res.status(500).json({ error: 'Database update error while saving sales data' });
    }
});

export default router;
