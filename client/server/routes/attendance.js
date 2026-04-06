import express from 'express';
import { query, run, get } from '../db.js';

const router = express.Router();

// Get attendance records
router.get('/', async (req, res) => {
    try {
        const { employee_id, start_date, end_date, month } = req.query;
        let sql = `
      SELECT a.*, e.name as employee_name, e.group_id, g.name as group_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      LEFT JOIN groups g ON e.group_id = g.id
      WHERE 1=1
    `;
        const params = [];

        if (employee_id) {
            sql += ' AND a.employee_id = ?';
            params.push(employee_id);
        }

        if (start_date && end_date) {
            sql += ' AND a.date BETWEEN ? AND ?';
            params.push(start_date, end_date);
        } else if (month) {
            // Format: YYYY-MM
            sql += ' AND strftime("%Y-%m", a.date) = ?';
            params.push(month);
        }

        sql += ' ORDER BY a.date DESC, e.name';

        const records = await query(sql, params);
        res.json(records);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get attendance for specific employee and date
router.get('/employee/:employee_id/date/:date', async (req, res) => {
    try {
        const record = await get(`
      SELECT a.*, e.name as employee_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.employee_id = ? AND a.date = ?
    `, [req.params.employee_id, req.params.date]);

        res.json(record || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Create or update attendance record
router.post('/', async (req, res) => {
    try {
        const { employee_id, date, status, hours, notes } = req.body;

        if (!employee_id || !date) {
            return res.status(400).json({ error: 'employee_id and date are required' });
        }

        // Check if employee exists
        const employee = await get('SELECT id FROM employees WHERE id = ?', [employee_id]);
        if (!employee) {
            return res.status(404).json({ error: 'Employee not found' });
        }

        // Check if record exists
        const existing = await get(
            'SELECT id FROM attendance WHERE employee_id = ? AND date = ?',
            [employee_id, date]
        );

        if (existing) {
            // Update
            await run(`
        UPDATE attendance 
        SET status = ?, hours = ?, notes = ?, created_at = CURRENT_TIMESTAMP
        WHERE employee_id = ? AND date = ?
      `, [status || null, hours || null, notes || null, employee_id, date]);
        } else {
            // Insert
            await run(`
        INSERT INTO attendance (employee_id, date, status, hours, notes)
        VALUES (?, ?, ?, ?, ?)
      `, [employee_id, date, status || null, hours || null, notes || null]);
        }

        const record = await get(`
      SELECT a.*, e.name as employee_name
      FROM attendance a
      JOIN employees e ON a.employee_id = e.id
      WHERE a.employee_id = ? AND a.date = ?
    `, [employee_id, date]);

        res.status(201).json(record);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bulk create/update attendance
router.post('/bulk', async (req, res) => {
    try {
        const { records } = req.body;

        if (!Array.isArray(records) || records.length === 0) {
            return res.status(400).json({ error: 'records array is required' });
        }

        for (const record of records) {
            const existing = await get(
                'SELECT id FROM attendance WHERE employee_id = ? AND date = ?',
                [record.employee_id, record.date]
            );

            if (existing) {
                await run(`
          UPDATE attendance 
          SET status = ?, hours = ?, notes = ?, created_at = CURRENT_TIMESTAMP
          WHERE employee_id = ? AND date = ?
        `, [
                    record.status || null,
                    record.hours || null,
                    record.notes || null,
                    record.employee_id,
                    record.date
                ]);
            } else {
                await run(`
          INSERT INTO attendance (employee_id, date, status, hours, notes)
          VALUES (?, ?, ?, ?, ?)
        `, [
                    record.employee_id,
                    record.date,
                    record.status || null,
                    record.hours || null,
                    record.notes || null
                ]);
            }
        }

        res.json({ message: `${records.length} records processed successfully` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Delete attendance record
router.delete('/:id', async (req, res) => {
    try {
        const result = await run('DELETE FROM attendance WHERE id = ?', [req.params.id]);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Attendance record not found' });
        }

        res.json({ message: 'Attendance record deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get monthly summary
router.get('/summary/monthly', async (req, res) => {
    try {
        const { month } = req.query; // Format: YYYY-MM

        if (!month) {
            return res.status(400).json({ error: 'month parameter is required (format: YYYY-MM)' });
        }

        const summary = await query(`
      SELECT 
        g.name as group_name,
        g.color as group_color,
        COUNT(DISTINCT e.id) as total_employees,
        COUNT(a.id) as total_records,
        SUM(CASE WHEN a.status = 'present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN a.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN a.status = 'leave' THEN 1 ELSE 0 END) as leave_count,
        ROUND(AVG(a.hours), 2) as avg_hours
      FROM groups g
      LEFT JOIN employees e ON g.id = e.group_id AND e.status = 'active'
      LEFT JOIN attendance a ON e.id = a.employee_id 
        AND strftime('%Y-%m', a.date) = ?
      GROUP BY g.id
      ORDER BY g.display_order
    `, [month]);

        res.json(summary);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
