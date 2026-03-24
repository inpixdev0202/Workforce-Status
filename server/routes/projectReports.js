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

// Update column widths for ALL reports
router.post('/update-all-column-widths', authenticateToken, (req, res) => {
    try {
        const { columnWidths } = req.body;
        if (!columnWidths) {
            return res.status(400).json({ message: 'Missing columnWidths' });
        }

        const allReports = query('SELECT * FROM project_reports');
        
        allReports.forEach(report => {
            let data = JSON.parse(report.data_json);
            
            if (Array.isArray(data)) {
                // Migrate legacy array to new object format
                data = {
                    rows: data,
                    columnWidths: columnWidths
                };
            } else {
                // Update existing object's columnWidths
                data.columnWidths = columnWidths;
            }
            
            run(
                'UPDATE project_reports SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE week_date = ?',
                JSON.stringify(data),
                report.week_date
            );
        });

        res.json({ message: `Successfully updated column widths for ${allReports.length} reports.` });
    } catch (error) {
        console.error('Error updating all column widths:', error);
        res.status(500).json({ message: 'Error updating column widths' });
    }
});

// Global Metadata Sync: Update a specific field for a project across ALL weekly reports
router.post('/sync-project-field', authenticateToken, (req, res) => {
    try {
        const { projectName, field, value } = req.body;
        if (!projectName || !field) {
            return res.status(400).json({ message: 'Missing projectName or field' });
        }

        // 1. Update Projects Master Table if field matches
        // Map UI keys to DB columns
        const dbFieldMap = {
            'pd': 'pd',
            'pm': 'pm',
            'kickoff': 'start_date' // Heuristic: update start_date if kickoff is modified? 
                                   // User specifically asked for pd, pm, start_date, end_date. 
                                   // I'll check exactly what fields they use in UI.
        };

        const dbColumn = dbFieldMap[field.toLowerCase()];
        if (dbColumn) {
            run(`UPDATE projects SET ${dbColumn} = ? WHERE name = ?`, value, projectName);
        }

        // 2. Update ALL Project Reports
        const allReports = query('SELECT * FROM project_reports');
        let updateCount = 0;

        allReports.forEach(report => {
            let data = JSON.parse(report.data_json);
            let rows = Array.isArray(data) ? data : (data.rows || []);
            let modified = false;

            rows = rows.map(row => {
                if (row.projectName && row.projectName.trim() === projectName.trim()) {
                    if (row[field] !== value) {
                        modified = true;
                        return { ...row, [field]: value };
                    }
                }
                return row;
            });

            if (modified) {
                if (Array.isArray(data)) {
                    data = rows;
                } else {
                    data.rows = rows;
                }

                run(
                    'UPDATE project_reports SET data_json = ?, updated_at = CURRENT_TIMESTAMP WHERE week_date = ?',
                    JSON.stringify(data),
                    report.week_date
                );
                updateCount++;
            }
        });

        res.json({ message: `Successfully synced '${field}' for project '${projectName}' across ${updateCount} weeks.` });
    } catch (error) {
        console.error('Error syncing project field:', error);
        res.status(500).json({ message: 'Error syncing project field' });
    }
});

export default router;
